import { Skeleton } from '@/components/ui/skeleton'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo, useRef } from 'react'
import { formatEther, parseUnits } from 'viem'
import useLoadingAfterRefetch from '../../../hooks/useLoadingAfterRefetch'
import { usePrice } from '../../../hooks/usePrice'
import useZapSwapQuery from '../../../hooks/useZapSwapQuery'
import {
  chainIdAtom,
  indexDTFAtom,
  indexDTFPriceAtom,
  walletAtom,
} from '../../../state/atoms'
import { Token } from '../../../types'
import {
  formatCurrency,
  resetTempRegistrations,
  useTrackQuoteErrorUX,
} from '../../../utils'
import { getReceivedAmount } from '../../../utils/receipt'
import Swap from '../../ui/swap'
import {
  forceMintAtom,
  openingFromSimpleModeAtom,
  selectedTokenAtom,
  selectedTokenBalanceAtom,
  selectedTokenOrDefaultAtom,
  slippageAtom,
  tokensAtom,
  zapFetchingAtom,
  zapMintInputAtom,
  zapOngoingTxAtom,
  zapperCurrentTabAtom,
  zapperDebugAtom,
  zapQuoteStateAtom,
  zapRefetchAtom,
  zapTxReceiptAtom,
} from '../atom'
import { Debug } from '../debug/debug'
import SubmitZap from '../submit-zap'
import ZapDetails, { ZapPriceImpact } from '../zap-details'

interface BuyProps {
  mode?: 'modal' | 'inline' | 'simple'
  disabled?: boolean
}

const Buy = ({ mode = 'modal', disabled }: BuyProps) => {
  const account = useAtomValue(walletAtom)
  const chainId = useAtomValue(chainIdAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const [inputAmount, setInputAmount] = useAtom(zapMintInputAtom)
  const [openingFromSimple, setOpeningFromSimple] = useAtom(
    openingFromSimpleModeAtom
  )
  const isFirstMount = useRef(true)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const selectedTokenBalance = useAtomValue(selectedTokenBalanceAtom)
  const tokens = useAtomValue(tokensAtom)
  const slippage = useAtomValue(slippageAtom)
  const forceMint = useAtomValue(forceMintAtom)
  const debug = useAtomValue(zapperDebugAtom)
  const setInputToken = useSetAtom(selectedTokenAtom)
  const [ongoingTx, setOngoingTx] = useAtom(zapOngoingTxAtom)
  const setZapRefetch = useSetAtom(zapRefetchAtom)
  const setZapFetching = useSetAtom(zapFetchingAtom)
  const setZapQuoteState = useSetAtom(zapQuoteStateAtom)
  const setCurrentTab = useSetAtom(zapperCurrentTabAtom)
  const selectedTokenPrice = usePrice(chainId, selectedToken.address)
  const dtfPrice = useAtomValue(indexDTFPriceAtom)
  const txReceipt = useAtomValue(zapTxReceiptAtom)
  const inputValue = (selectedTokenPrice || 0) * Number(inputAmount)
  const onMax = () => setInputAmount(selectedTokenBalance?.balance || '0')

  const handleTokenSelect = (token: Token) => {
    setInputToken(token)
  }

  const insufficientBalance =
    parseUnits(inputAmount, selectedToken.decimals) >
    parseUnits(selectedTokenBalance?.balance || '0', selectedToken.decimals)

  const { data, isLoading, isFetching, refetch, failureReason } =
    useZapSwapQuery({
      tokenIn: selectedToken.address,
      tokenOut: indexDTF?.id,
      amountIn: parseUnits(inputAmount, selectedToken.decimals).toString(),
      slippage: isFinite(Number(slippage)) ? Number(slippage) : 10000,
      disabled: ongoingTx,
      forceMint,
      dtfTicker: indexDTF?.token.symbol || '',
      type: 'buy',
      inputValue,
    })

  const zapperErrorMessage = isFetching
    ? ''
    : data?.error || failureReason?.message || ''

  useTrackQuoteErrorUX({
    tokenIn: selectedToken.address,
    tokenOut: indexDTF?.id || '',
    source: data?.source,
    zapError: zapperErrorMessage,
  })

  const { loadingAfterRefetch } = useLoadingAfterRefetch(data)

  const priceFrom = data?.result?.amountInValue
  const priceTo = data?.result?.amountOutValue
  const valueTo = data?.result?.amountOut
  const showTxButton = Boolean(
    data?.status === 'success' &&
      data?.result &&
      !insufficientBalance &&
      !isLoading
  )
  const fetchingZapper = isLoading || isFetching
  const dustValue = data?.result?.dustValue || 0

  const changeTab = () => {
    const newTab = 'sell' // Since this is the Buy component, swapping goes to sell
    setCurrentTab(newTab)
    setInputToken(tokens[0])
    setInputAmount('')
    resetTempRegistrations()
  }

  useEffect(() => {
    setZapRefetch({ fn: refetch })
  }, [refetch, setZapRefetch])

  useEffect(() => {
    setZapFetching(fetchingZapper)
  }, [fetchingZapper, setZapFetching])

  useEffect(() => {
    const succeeded = data?.status === 'success'
    setZapQuoteState({
      data: {
        input: {
          token: selectedToken,
          amount: inputAmount,
          // Prefer the quote's authoritative input value; fall back to the
          // local price-based estimate before the quote resolves.
          value: data?.result?.amountInValue ?? inputValue,
        },
        quote: succeeded ? data.result : undefined,
        source: succeeded ? data.source : undefined,
      },
      loading: fetchingZapper,
      error: zapperErrorMessage || undefined,
    })
  }, [
    selectedToken,
    inputAmount,
    inputValue,
    data,
    fetchingZapper,
    zapperErrorMessage,
    setZapQuoteState,
  ])

  useEffect(
    () => () =>
      setZapQuoteState({ data: undefined, loading: false, error: undefined }),
    [setZapQuoteState]
  )

  useEffect(() => {
    setOngoingTx(false)

    // Skip resetting input on first mount if we're coming from simple mode
    if (isFirstMount.current && openingFromSimple) {
      isFirstMount.current = false
      setOpeningFromSimple(false)
      return
    }

    // For non-simple mode, reset input on mount
    if (isFirstMount.current && mode !== 'simple') {
      setInputAmount('')
    }

    isFirstMount.current = false
  }, [
    setOngoingTx,
    setInputAmount,
    openingFromSimple,
    setOpeningFromSimple,
    mode,
  ])

  // On success, show the DTF actually received (from the receipt logs) with the
  // realized price impact instead of the quoted values.
  const isSuccess = !!txReceipt
  const receivedRaw = useMemo(
    () =>
      txReceipt && indexDTF && account
        ? getReceivedAmount(txReceipt.logs, indexDTF.id, account)
        : 0n,
    [txReceipt, indexDTF, account]
  )
  const receivedAmount = receivedRaw > 0n ? formatEther(receivedRaw) : undefined
  const receivedValue = receivedAmount
    ? Number(receivedAmount) * (dtfPrice || 0)
    : undefined
  const receivedImpact =
    receivedValue !== undefined && inputValue > 0
      ? ((inputValue - receivedValue) / inputValue) * 100
      : undefined

  if (!indexDTF) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-2 h-full">
      <Swap
        from={{
          title: isSuccess ? 'You used:' : undefined,
          price: `$${formatCurrency(priceFrom ?? inputValue)}`,
          address: selectedToken.address,
          symbol: selectedToken.symbol,
          balance: `${formatCurrency(
            Number(selectedTokenBalance?.balance || '0'),
            4
          )}`,
          value: inputAmount,
          onChange: setInputAmount,
          onMax,
          tokens,
          onTokenSelect: handleTokenSelect,
          disabled: !account,
        }}
        to={{
          title: isSuccess ? 'You received:' : undefined,
          address: indexDTF.id,
          symbol: indexDTF.token.symbol,
          price: isSuccess ? (
            <span>
              ${formatCurrency(receivedValue ?? priceTo ?? 0)}{' '}
              <ZapPriceImpact priceImpact={receivedImpact} data={data?.result} />
            </span>
          ) : priceTo ? (
            <span>
              ${formatCurrency(priceTo)}
              {dustValue > 0.01
                ? ` + $${formatCurrency(dustValue)} in dust `
                : ' '}
              <ZapPriceImpact data={data?.result} />
            </span>
          ) : undefined,
          value:
            isSuccess && receivedAmount
              ? receivedAmount
              : formatEther(BigInt(valueTo || 0)),
        }}
        onSwap={changeTab}
        loading={isLoading || loadingAfterRefetch}
        disabled={disabled || ongoingTx}
      />
      {mode !== 'simple' && !isSuccess && !!data?.result && (
        <ZapDetails data={data.result} source={data.source} />
      )}
      <SubmitZap
        data={data?.result}
        source={data?.source}
        chainId={indexDTF.chainId}
        buttonLabel={`Buy ${indexDTF.token.symbol}`}
        inputSymbol={selectedToken.symbol}
        outputSymbol={indexDTF.token.symbol}
        inputAmount={formatCurrency(Number(inputAmount))}
        outputAmount={formatCurrency(Number(formatEther(BigInt(valueTo || 0))))}
        showTxButton={showTxButton}
        fetchingZapper={isLoading}
        insufficientBalance={insufficientBalance}
        zapperErrorMessage={mode === 'simple' ? '' : zapperErrorMessage}
        mode={mode}
        disabled={disabled}
      />
      {mode !== 'simple' && debug && !!data?.result?.debug && (
        <Debug data={data.result.debug} />
      )}
    </div>
  )
}

export default Buy
