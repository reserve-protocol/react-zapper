import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo } from 'react'
import { Address } from 'viem'
import { useConfig } from 'wagmi'
import {
  zapperDebugAtom,
  zapSwapEndpointAtom,
} from '../components/zap-mint/atom'
import {
  apiUrlAtom,
  chainIdAtom,
  deepLiquidityAtom,
  indexDTFAtom,
  quoteSourceAtom,
  refreshRateAtom,
  walletAtom,
  zapperApiUrlAtom,
} from '../state/atoms'
import {
  quoteIdAtom,
  retryIdAtom,
  sessionIdAtom,
  sourceIdAtom,
} from '../state/tracking-atoms'
import {
  fetchBestZapQuote,
  type ProviderQuote,
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
import { ChainId } from '@/utils/chains'

const MIN_INPUT_VALUE_FOR_ZAP = 1000
const DTFS_WITH_MIN_INPUT_VALUE_FOR_ZAP: Record<number, string[]> = {
  [ChainId.BSC]: ['0x2f8a339b5889ffac4c5a956787cda593b3c36867'].map((address) =>
    address.toLowerCase()
  ),
}

const useZapSwapQuery = ({
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  disabled,
  forceMint,
  dtfTicker,
  type,
  inputValue,
  insufficientBalance,
}: {
  tokenIn?: Address
  tokenOut?: Address
  amountIn: string
  slippage: number
  disabled: boolean
  forceMint: boolean
  dtfTicker: string
  type: 'buy' | 'sell'
  inputValue: number
  insufficientBalance: boolean
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
  const dtf = useAtomValue(indexDTFAtom)
  const refreshRate = useAtomValue(refreshRateAtom)

  const shouldSkipZapper =
    (DTFS_WITH_MIN_INPUT_VALUE_FOR_ZAP[chainId]?.includes(
      dtf?.id?.toLowerCase() ?? ''
    ) ?? false) && inputValue < MIN_INPUT_VALUE_FOR_ZAP

  // Providers available on this chain. The `shouldSkipZapper` rule only
  // affects the parallel `best` pool — when the user explicitly picks a
  // provider, honor that choice regardless of the skip rule.
  const availableProviders = useMemo<ProviderConfig[]>(() => {
    const providers = getEnabledProviders(chainId)
    if (quoteSource !== 'best') return providers
    return shouldSkipZapper
      ? providers.filter((p) => p.id !== 'zap')
      : providers
  }, [chainId, shouldSkipZapper, quoteSource])

  // Cache key for react-query — changes when any swap param changes. We
  // intentionally don't memoize endpoint strings here; `fetchBestZapQuote`
  // rebuilds them per fetch using the latest tracking ids.
  const cacheKey = useDebounce(
    useMemo(() => {
      if (
        !tokenIn ||
        !tokenOut ||
        !account ||
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
        account,
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
      account,
      forceMint,
      deepLiquidity,
      debug,
      availableProviders,
    ]),
    500
  )

  return useQuery({
    queryKey: ['zapDeploy', cacheKey, quoteSource],
    queryFn: async (): Promise<ProviderQuote> => {
      if (!tokenIn || !tokenOut || !account) {
        throw new Error('Invalid tokenIn, tokenOut or account')
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

      // Pre-select simulation only makes sense when the account could
      // actually execute the tx: with insufficient funds every estimate
      // reverts for reasons unrelated to the quotes. Skip too when the host
      // wagmi config doesn't know the target chain.
      const chainConfigured = wagmiConfig.chains.some((c) => c.id === chainId)
      const simulate =
        !insufficientBalance && chainConfigured
          ? makeWagmiSimulator(wagmiConfig, {
              chainId,
              account: account as Address,
            })
          : undefined

      const { selected } = await fetchBestZapQuote({
        providers: availableProviders,
        quoteSource,
        simulate,
        endpointParams: {
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          signer: account as Address,
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

      const newSourceId = generateSourceId(selected.source)
      setSourceId(newSourceId)
      mixpanelRegister('sourceId', newSourceId)
      mixpanelRegister('source', selected.source)

      setZapSwapEndpoint(selected.endpoint)

      trackSubmitButtonReady({
        account,
        tokenIn,
        tokenOut,
        dtfTicker,
        chainId,
        type,
        endpoint: selected.endpoint,
      })

      return selected
    },
    enabled: !disabled && !!cacheKey && availableProviders.length > 0,
    refetchInterval: refreshRate,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
  })
}

export default useZapSwapQuery
