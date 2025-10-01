import { Skeleton } from '@/components/ui/skeleton'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import { formatEther, parseUnits } from 'viem'
import useLoadingAfterRefetch from '../../../hooks/useLoadingAfterRefetch'
import { usePrice } from '../../../hooks/usePrice'
import useZapSwapQuery from '../../../hooks/useZapSwapQuery'
import { chainIdAtom, indexDTFAtom, walletAtom } from '../../../state/atoms'
import { Token } from '../../../types'
import {
  formatCurrency,
  resetTempRegistrations,
  useTrackQuoteErrorUX,
} from '../../../utils'
import Swap from '../../ui/swap'
import {
  forceMintAtom,
  openZapMintModalAtom,
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
  zapRefetchAtom,
} from '../atom'
import { Debug } from '../debug/debug'
import SubmitZap from '../submit-zap'
import ZapDetails, { ZapPriceImpact } from '../zap-details'

const Buy = () => {
  const account = useAtomValue(walletAtom)
  const chainId = useAtomValue(chainIdAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const [inputAmount, setInputAmount] = useAtom(zapMintInputAtom)
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
  const setCurrentTab = useSetAtom(zapperCurrentTabAtom)
  const setOpen = useSetAtom(openZapMintModalAtom)
  const selectedTokenPrice = usePrice(chainId, selectedToken.address)
  const inputPrice = (selectedTokenPrice || 0) * Number(inputAmount)
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
    setOngoingTx(false)
    setInputAmount('')
  }, [setOngoingTx, setInputAmount])

  const onSuccess = useCallback(() => {
    setInputAmount('')
    setOpen(false)
  }, [setInputAmount, setOpen])

  if (!indexDTF) return <Skeleton className="h-64" />

  return (
    <div className="flex flex-col gap-2 h-full">
      <Swap
        from={{
          price: `$${formatCurrency(priceFrom ?? inputPrice)}`,
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
          address: indexDTF.id,
          symbol: indexDTF.token.symbol,
          price: priceTo ? (
            <span>
              ${formatCurrency(priceTo)}
              {dustValue > 0.01
                ? ` + $${formatCurrency(dustValue)} in dust `
                : ' '}
              <ZapPriceImpact data={data?.result} />
            </span>
          ) : undefined,
          value: formatEther(BigInt(valueTo || 0)),
        }}
        onSwap={changeTab}
        loading={isLoading || loadingAfterRefetch}
      />
      {!!data?.result && <ZapDetails data={data.result} source={data.source} />}
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
        zapperErrorMessage={zapperErrorMessage}
        onSuccess={onSuccess}
      />
      {debug && !!data?.result?.debug && <Debug data={data.result.debug} />}
    </div>
  )
}

export default Buy
