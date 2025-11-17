import { Skeleton } from '@/components/ui/skeleton'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useRef } from 'react'
import { formatEther, formatUnits, parseEther } from 'viem'
import useLoadingAfterRefetch from '../../../hooks/useLoadingAfterRefetch'
import useZapSwapQuery from '../../../hooks/useZapSwapQuery'
import {
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
import Swap from '../../ui/swap'
import {
  forceMintAtom,
  indexDTFBalanceAtom,
  openZapMintModalAtom,
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
  zapRefetchAtom,
} from '../atom'
import { Debug } from '../debug/debug'
import SubmitZap from '../submit-zap'
import ZapDetails, { ZapPriceImpact } from '../zap-details'

interface SellProps {
  mode?: 'modal' | 'inline' | 'simple'
}

const Sell = ({ mode = 'modal' }: SellProps) => {
  const account = useAtomValue(walletAtom)
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
  const slippage = useAtomValue(slippageAtom)
  const forceMint = useAtomValue(forceMintAtom)
  const debug = useAtomValue(zapperDebugAtom)
  const setOutputToken = useSetAtom(selectedTokenAtom)
  const [ongoingTx, setOngoingTx] = useAtom(zapOngoingTxAtom)
  const setZapRefetch = useSetAtom(zapRefetchAtom)
  const setZapFetching = useSetAtom(zapFetchingAtom)
  const setCurrentTab = useSetAtom(zapperCurrentTabAtom)
  const setOpen = useSetAtom(openZapMintModalAtom)
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

  const onSuccess = useCallback(() => {
    setInputAmount('')
    setOpen(false)
  }, [setInputAmount, setOpen])

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
                ? ` + $${formatCurrency(dustValue)} in dust `
                : ' '}
              <ZapPriceImpact data={data?.result} />
            </span>
          ) : undefined,
          value: formatUnits(BigInt(valueTo || 0), selectedToken.decimals),
          tokens,
          onTokenSelect: handleTokenSelect,
        }}
        onSwap={changeTab}
        loading={isLoading || loadingAfterRefetch}
      />
      {mode !== 'simple' && !!data?.result && (
        <ZapDetails data={data.result} source={data.source} />
      )}
      <SubmitZap
        data={data?.result}
        source={data?.source}
        chainId={indexDTF.chainId}
        buttonLabel={`Sell ${indexDTF.token.symbol}`}
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
        onSuccess={onSuccess}
        mode={mode}
      />
      {mode !== 'simple' && debug && !!data?.result?.debug && (
        <Debug data={data.result.debug} />
      )}
    </div>
  )
}

export default Sell
