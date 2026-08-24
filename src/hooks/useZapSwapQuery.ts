import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import { Address, erc20Abi } from 'viem'
import { useConfig } from 'wagmi'
import { readContract } from 'wagmi/actions'
import {
  zapperDebugAtom,
  zapSwapEndpointAtom,
} from '../components/zap-mint/atom'
import {
  apiUrlAtom,
  chainIdAtom,
  deepLiquidityAtom,
  quoteSourceAtom,
  refreshRateAtom,
  walletAtom,
  zapperApiUrlAtom,
} from '../state/atoms'
import {
  activeQuoteAtom,
  beginQuoteRoundAtom,
  bestSourceAtom,
  completeQuoteRoundAtom,
  earliestValidUntilAtom,
  providerQuoteUpdateAtom,
  resetQuoteListAtom,
} from '../state/quote-list-atoms'
import {
  quoteIdAtom,
  retryIdAtom,
  sessionIdAtom,
  sourceIdAtom,
} from '../state/tracking-atoms'
import {
  fetchBestZapQuote,
  type FetchQuoteResult,
} from './zap-quote-providers'
import { makeWagmiSimulator } from './zap-quote-simulation'
import {
  generateQuoteId,
  generateRetryId,
  generateSourceId,
} from '../utils/ids'
import {
  getEnabledProviders,
  type ProviderConfig,
} from '../utils/providers'
import {
  mixpanelRegister,
  mixpanelTimeEvent,
  SUBMIT_BUTTON_READY_EVENT,
  trackSubmitButtonReady,
} from '../utils/tracking'
import useDebounce from './useDebounce'
import { PLACEHOLDER_SIGNER } from '@/utils/constants'

// Expiry-triggered refetch: the API may cache a provider's quote until its
// validUntil (e.g. enso), so refetch shortly AFTER the earliest quote expires
// (a refetch before expiry would just get the same cached quote back). The
// floor keeps a provider serving already-expired quotes from causing a tight
// refetch loop.
const EXPIRY_REFETCH_BUFFER = 500
const MIN_EXPIRY_REFETCH = 1_000

const useZapSwapQuery = ({
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  disabled,
  forceMint,
  dtfTicker,
  type,
  insufficientBalance,
  tokenInPrice,
  tokenInDecimals,
  tokenOutPrice,
  tokenOutDecimals,
}: {
  tokenIn?: Address
  tokenOut?: Address
  amountIn: string
  slippage: number
  disabled: boolean
  forceMint: boolean
  dtfTicker: string
  type: 'buy' | 'sell'
  insufficientBalance: boolean
  // Reserve prices for both sides of the trade: every quote's USD values and
  // price impact are computed from these (uniform across sources); the
  // provider-reported values only remain as fallbacks.
  tokenInPrice?: number | null
  tokenInDecimals?: number
  tokenOutPrice?: number | null
  tokenOutDecimals?: number
}) => {
  const wagmiConfig = useConfig()
  const zapperApi = useAtomValue(zapperApiUrlAtom)
  const reserveApi = useAtomValue(apiUrlAtom)
  const chainId = useAtomValue(chainIdAtom)
  const account = useAtomValue(walletAtom)
  const quoteSource = useAtomValue(quoteSourceAtom)
  const setZapSwapEndpoint = useSetAtom(zapSwapEndpointAtom)
  const debug = useAtomValue(zapperDebugAtom)
  const deepLiquidity = useAtomValue(deepLiquidityAtom)
  const sessionId = useAtomValue(sessionIdAtom)
  const setQuoteId = useSetAtom(quoteIdAtom)
  const setRetryId = useSetAtom(retryIdAtom)
  const setSourceId = useSetAtom(sourceIdAtom)
  const refreshRate = useAtomValue(refreshRateAtom)
  const beginRound = useSetAtom(beginQuoteRoundAtom)
  const updateRow = useSetAtom(providerQuoteUpdateAtom)
  const completeRound = useSetAtom(completeQuoteRoundAtom)
  const resetList = useSetAtom(resetQuoteListAtom)
  const active = useAtomValue(activeQuoteAtom)
  const bestSource = useAtomValue(bestSourceAtom)
  const earliestValidUntil = useAtomValue(earliestValidUntilAtom)

  const availableProviders = useMemo<ProviderConfig[]>(
    () => getEnabledProviders(chainId),
    [chainId]
  )

  // Without a wallet, quotes are still fetched (display-only) using a
  // placeholder signer; anything executable is stripped from the results.
  const signer = account ?? PLACEHOLDER_SIGNER

  // Cache key for react-query — changes when any swap param changes. We
  // intentionally don't memoize endpoint strings here; `fetchBestZapQuote`
  // rebuilds them per fetch using the latest tracking ids.
  const cacheKey = useDebounce(
    useMemo(() => {
      if (
        !tokenIn ||
        !tokenOut ||
        isNaN(Number(amountIn)) ||
        Number(amountIn) === 0
      ) {
        return null
      }
      return [
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
        signer,
        forceMint,
        deepLiquidity,
        debug,
        availableProviders.map((p) => p.id).join(','),
      ].join('|')
    }, [
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
      slippage,
      signer,
      forceMint,
      deepLiquidity,
      debug,
      availableProviders,
    ]),
    500
  )

  const query = useQuery({
    queryKey: ['zapDeploy', cacheKey, quoteSource],
    queryFn: async (): Promise<FetchQuoteResult> => {
      if (!tokenIn || !tokenOut || !cacheKey) {
        throw new Error('Invalid tokenIn or tokenOut')
      }

      mixpanelTimeEvent(SUBMIT_BUTTON_READY_EVENT)

      const newQuoteId = generateQuoteId({
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
        slippage,
      })
      setQuoteId(newQuoteId)
      mixpanelRegister('quoteId', newQuoteId)

      const newRetryId = generateRetryId()
      setRetryId(newRetryId)
      mixpanelRegister('retryId', newRetryId)

      // Pre-select simulation only makes sense when a real account could
      // actually execute the tx: with insufficient funds (or no wallet) every
      // estimate reverts for reasons unrelated to the quotes. Skip too when
      // the host wagmi config doesn't know the target chain.
      const chainConfigured = wagmiConfig.chains.some((c) => c.id === chainId)
      const simulate =
        !!account && !insufficientBalance && chainConfigured
          ? makeWagmiSimulator(wagmiConfig, {
              chainId,
              account: account as Address,
            })
          : undefined

      // RFQ adapters need a chain read for the allowance check; without a
      // configured chain they are skipped (rfq ctx absent).
      const rfq = chainConfigured
        ? {
            readAllowance: (token: Address, owner: Address, spender: Address) =>
              readContract(wagmiConfig, {
                chainId: chainId as (typeof wagmiConfig)['chains'][number]['id'],
                address: token,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [owner, spender],
              }),
          }
        : undefined

      const pricing = {
        tokenInPrice: tokenInPrice ?? null,
        tokenInDecimals: tokenInDecimals ?? 18,
        tokenOutPrice: tokenOutPrice ?? null,
        tokenOutDecimals: tokenOutDecimals ?? 18,
      }

      // Streams per-provider progress into the quote-list atoms as each
      // source settles. Events are stamped with the round number handed out
      // by `beginQuoteRoundAtom` so an abandoned run (react-query never
      // cancels a stale queryFn) can't touch a newer round's rows.
      let round = 0
      return await fetchBestZapQuote({
        providers: availableProviders,
        quoteSource,
        simulate,
        rfq,
        pricing,
        signerIsPlaceholder: !account,
        onUpdate: (event) => {
          switch (event.type) {
            case 'round-start':
              round = beginRound({ key: cacheKey, sources: event.sources })
              break
            case 'quote':
              updateRow({ round, source: event.source, quote: event.quote })
              break
            case 'quote-error':
              updateRow({ round, source: event.source, error: event.error })
              break
            case 'round-complete':
              completeRound({
                round,
                best: event.best,
                reverted: event.reverted,
                failed: event.failed,
              })
              break
          }
        },
        endpointParams: {
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          signer: signer as Address,
          trade: !forceMint,
          bypassCache: false,
          debug,
          deepLiquidity,
          apiUrl: reserveApi,
          zapperApiUrl: zapperApi,
        },
        tracking: {
          sessionId,
          quoteId: newQuoteId,
          retryId: newRetryId,
        },
        analytics: {
          account,
          tokenIn,
          tokenOut,
          dtfTicker,
          chainId,
          type,
        },
      })
    },
    enabled: !disabled && !!cacheKey && availableProviders.length > 0,
    refetchInterval: () => {
      if (earliestValidUntil == null) return refreshRate
      const untilFresh = earliestValidUntil + EXPIRY_REFETCH_BUFFER - Date.now()
      return Math.max(MIN_EXPIRY_REFETCH, Math.min(refreshRate, untilFresh))
    },
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
    // quotes carry short-lived signed calldata — never re-serve an old one
    gcTime: 0,
  })

  // Input cleared/invalid → drop the rows instead of showing a stale list.
  // Only on the non-null → null transition: on first mount the key is always
  // null and resetting would wipe the `defaultSource`-seeded pick.
  const prevCacheKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!cacheKey && prevCacheKeyRef.current) resetList()
    prevCacheKeyRef.current = cacheKey
  }, [cacheKey, resetList])

  // Wallet connect/switch → drop the rows immediately: display-only
  // placeholder quotes (or another account's quotes) must not linger while
  // the new signer's round is in flight.
  const prevAccountRef = useRef(account)
  useEffect(() => {
    if (prevAccountRef.current !== account) resetList()
    prevAccountRef.current = account
  }, [account, resetList])

  // Tracking follows the ACTIVE quote (picked-or-best), not just the round
  // winner: registrations must be right when the user picks a row or when an
  // expired pick falls back — both happen without a new fetch. The endpoint
  // embeds per-round tracking ids, so this re-registers once per round too.
  const activeSource = active?.source
  const activeEndpoint = active?.endpoint
  useEffect(() => {
    if (!activeSource || !activeEndpoint) return
    const newSourceId = generateSourceId(activeSource)
    setSourceId(newSourceId)
    mixpanelRegister('sourceId', newSourceId)
    mixpanelRegister('source', activeSource)
    setZapSwapEndpoint(activeEndpoint)
  }, [activeSource, activeEndpoint, setSourceId, setZapSwapEndpoint])

  useEffect(() => {
    mixpanelRegister('bestSource', bestSource ?? undefined)
  }, [bestSource])

  // Pairs with the `mixpanelTimeEvent` at round start, so it only fires on
  // round completion (a user pick would report a garbage duration). Keeps the
  // historical semantics: the endpoint is the round winner's.
  const roundResult = query.data
  useEffect(() => {
    if (!roundResult?.selected) return
    trackSubmitButtonReady({
      account,
      tokenIn,
      tokenOut,
      dtfTicker,
      chainId,
      type,
      endpoint: roundResult.selected.endpoint,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundResult])

  // Rounds that end with no usable quote resolve successfully with
  // `selected: null`, so there is no error state to show — `sourcing` stays
  // true and the caller keeps the loading treatment up while the query
  // retries on its refresh cadence.
  const sourcing = !disabled && !!cacheKey && !active

  // `data` is the ACTIVE quote (picked-or-best); `roundData` changes once per
  // completed round — use it for round-scoped UI like the refetch loader so a
  // user pick doesn't retrigger it.
  return { ...query, data: active ?? undefined, roundData: query.data, sourcing }
}

export default useZapSwapQuery
