import { useLingui } from '@lingui/react/macro'
import { Skeleton } from '@/components/ui/skeleton'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { formatEther, formatUnits, parseEther } from 'viem'
import useLoadingAfterRefetch from '../../../hooks/useLoadingAfterRefetch'
import { usePrice } from '../../../hooks/usePrice'
import useZapSwapQuery from '../../../hooks/useZapSwapQuery'
import {
  chainIdAtom,
  indexDTFAtom,
  indexDTFPriceAtom,
  tokenSelectorLoadingAtom,
  walletAtom,
} from '../../../state/atoms'
import { Token } from '../../../types'
import {
  formatCurrency,
  resetTempRegistrations,
  useTrackQuoteErrorUX,
} from '../../../utils'
import Swap from '../../ui/swap'
import {
  forceMintAtom,
  indexDTFBalanceAtom,
  openingFromSimpleModeAtom,
  selectedTokenAtom,
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
} from '../atom'
import { Debug } from '../debug/debug'
import SubmitZap from '../submit-zap'
import ZapDetails, { ZapPriceImpact } from '../zap-details'

interface SellProps {
  mode?: 'modal' | 'inline' | 'simple'
  sellOnly?: boolean
  disabled?: boolean
}

const Sell = ({ mode = 'modal', sellOnly, disabled }: SellProps) => {
  const { t } = useLingui()
  const account = useAtomValue(walletAtom)
  const chainId = useAtomValue(chainIdAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const indexDTFPrice = useAtomValue(indexDTFPriceAtom)
  const [inputAmount, setInputAmount] = useAtom(zapMintInputAtom)
  const [openingFromSimple, setOpeningFromSimple] = useAtom(
    openingFromSimpleModeAtom
  )
  const isFirstMount = useRef(true)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const indexDTFBalance = useAtomValue(indexDTFBalanceAtom)
  const indxDTFParsedBalance = formatEther(indexDTFBalance)
  const tokens = useAtomValue(tokensAtom)
  const tokensLoading = useAtomValue(tokenSelectorLoadingAtom)
  const slippage = useAtomValue(slippageAtom)
  const forceMint = useAtomValue(forceMintAtom)
  const debug = useAtomValue(zapperDebugAtom)
  const setOutputToken = useSetAtom(selectedTokenAtom)
  const [ongoingTx, setOngoingTx] = useAtom(zapOngoingTxAtom)
  const setZapRefetch = useSetAtom(zapRefetchAtom)
  const setZapFetching = useSetAtom(zapFetchingAtom)
  const setZapQuoteState = useSetAtom(zapQuoteStateAtom)
  const setCurrentTab = useSetAtom(zapperCurrentTabAtom)
  const selectedTokenPrice = usePrice(chainId, selectedToken.address)
  const inputValue = (indexDTFPrice || 0) * Number(inputAmount)
  const onMax = () => setInputAmount(indxDTFParsedBalance)

  const handleTokenSelect = (token: Token) => {
    setOutputToken(token)
  }

  const insufficientBalance = parseEther(inputAmount) > indexDTFBalance

  const { data, isLoading, isFetching, refetch, failureReason } =
    useZapSwapQuery({
      tokenIn: indexDTF?.id,
      tokenOut: selectedToken.address,
      amountIn: parseEther(inputAmount).toString(),
      slippage: Number(slippage),
      disabled: ongoingTx,
      forceMint,
      dtfTicker: indexDTF?.token.symbol || '',
      type: 'sell',
      inputValue,
      insufficientBalance,
      tokenOutPrice: selectedTokenPrice,
      tokenOutDecimals: selectedToken.decimals,
    })

  const zapperErrorMessage = isFetching
    ? ''
    : data?.error || failureReason?.message || ''

  useTrackQuoteErrorUX({
    tokenIn: indexDTF?.id || '',
    tokenOut: selectedToken.address,
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
    const newTab = 'buy' // Since this is the Sell component, swapping goes to buy
    setCurrentTab(newTab)
    setOutputToken(tokens[0])
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
      data: indexDTF
        ? {
            input: {
              token: {
                address: indexDTF.id,
                symbol: indexDTF.token.symbol,
                name: indexDTF.token.name,
                decimals: indexDTF.token.decimals,
              },
              amount: inputAmount,
              // Prefer the quote's authoritative input value; fall back to the
              // local price-based estimate before the quote resolves.
              value: data?.result?.amountInValue ?? inputValue,
            },
            quote: succeeded ? data.result : undefined,
            source: succeeded ? data.source : undefined,
          }
        : undefined,
      loading: fetchingZapper,
      error: zapperErrorMessage || undefined,
    })
  }, [
    indexDTF,
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

  if (!indexDTF) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-2 h-full">
      <Swap
        from={{
          price: `$${formatCurrency(priceFrom ?? inputValue)}`,
          address: indexDTF.id,
          symbol: indexDTF.token.symbol,
          balance: `${formatCurrency(Number(indxDTFParsedBalance))}`,
          value: inputAmount,
          onChange: setInputAmount,
          onMax,
          disabled: !account,
        }}
        to={{
          address: selectedToken.address,
          symbol: selectedToken.symbol,
          price: priceTo ? (
            <span>
              ${formatCurrency(priceTo)}
              {dustValue > 0.01
                ? t` + $${formatCurrency(dustValue)} in dust `
                : ' '}
              <ZapPriceImpact data={data?.result} />
            </span>
          ) : undefined,
          value: formatUnits(BigInt(valueTo || 0), selectedToken.decimals),
          tokens,
          onTokenSelect: handleTokenSelect,
          tokensLoading,
          disabled: disabled || ongoingTx,
        }}
        onSwap={sellOnly ? undefined : changeTab}
        loading={isLoading || loadingAfterRefetch}
        disabled={disabled || ongoingTx}
      />
      {mode !== 'simple' && !!data?.result && (
        <ZapDetails data={data.result} source={data.source} />
      )}
      <SubmitZap
        data={data?.result}
        source={data?.source}
        chainId={indexDTF.chainId}
        buttonLabel={t`Sell ${indexDTF.token.symbol}`}
        inputSymbol={indexDTF.token.symbol}
        outputSymbol={selectedToken.symbol}
        inputAmount={formatCurrency(Number(inputAmount))}
        outputAmount={formatCurrency(
          Number(formatUnits(BigInt(valueTo || 0), selectedToken.decimals))
        )}
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

export default Sell
