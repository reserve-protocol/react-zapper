import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo, useCallback } from 'react'
import { Address } from 'viem'
import { zapSwapEndpointAtom } from '../components/zap-mint/atom'
import { chainIdAtom, apiUrlAtom, walletAtom, quoteSourceAtom } from '../state/atoms'
import zapper, { ZapResponse } from '../types/api'
import {
  trackIndexDTFQuote,
  trackIndexDTFQuoteError,
  trackIndexDTFQuoteRequested,
} from '../utils/tracking'
import useDebounce from './useDebounce'

const DUST_REFRESH_THRESHOLD = 0.025
const PRICE_IMPACT_THRESHOLD = 2

const useZapSwapQuery = ({
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  disabled,
  forceMint,
  dtfTicker,
  type,
}: {
  tokenIn?: Address
  tokenOut?: Address
  amountIn: string
  slippage: number
  disabled: boolean
  forceMint: boolean
  dtfTicker: string
  type: 'buy' | 'sell'
}) => {
  const api = useAtomValue(apiUrlAtom)
  const chainId = useAtomValue(chainIdAtom)
  const account = useAtomValue(walletAtom)
  const quoteSource = useAtomValue(quoteSourceAtom)
  const setZapSwapEndpoint = useSetAtom(zapSwapEndpointAtom)

  const getZapEndpoint = useCallback((bypassCache = false) =>
    !tokenIn ||
    !tokenOut ||
    isNaN(Number(amountIn)) ||
    Number(amountIn) === 0 ||
    !account
      ? null
      : zapper.zap({
          url: api,
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          signer: account as Address,
          trade: !forceMint,
          bypassCache,
        }), [api, chainId, tokenIn, tokenOut, amountIn, slippage, account, forceMint])

  const getOdosEndpoint = useCallback(() =>
    !tokenIn ||
    !tokenOut ||
    isNaN(Number(amountIn)) ||
    Number(amountIn) === 0 ||
    !account
      ? null
      : zapper.odosZap({
          url: api,
          chainId,
          tokenIn,
          tokenOut,
          amountIn,
          slippage,
          signer: account as Address,
        }), [api, chainId, tokenIn, tokenOut, amountIn, slippage, account])

  const zapEndpoint = useDebounce(
    useMemo(
      () => getZapEndpoint(false),
      [getZapEndpoint]
    ),
    500
  )

  const odosEndpoint = useDebounce(
    useMemo(
      () => getOdosEndpoint(),
      [getOdosEndpoint]
    ),
    500
  )

  useEffect(() => {
    setZapSwapEndpoint(zapEndpoint ?? '')
  }, [zapEndpoint, setZapSwapEndpoint])

  // Fetch Zap quote with dust and price impact retries
  const fetchZapQuote = async (): Promise<ZapResponse & { source: 'zap' }> => {
    const maxDustRetries = 0
    const maxPriceImpactRetries = 0
    let dustAttempt = 0
    let priceImpactAttempt = 0
    let lastData: ZapResponse

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentEndpoint = zapEndpoint

      if (!currentEndpoint) throw new Error('No Zap endpoint available')

      trackIndexDTFQuoteRequested({
        account,
        tokenIn,
        tokenOut,
        dtfTicker,
        chainId,
        type,
        endpoint: currentEndpoint,
        source: 'zap',
      })

      const response = await fetch(currentEndpoint)
      if (!response.ok) {
        const error = response.status
        trackIndexDTFQuoteError({
          account,
          tokenIn,
          tokenOut,
          dtfTicker,
          chainId,
          type,
          endpoint: currentEndpoint,
          status: 'error',
          error,
          source: 'zap',
        })
        throw new Error(`Zap Error: ${error}`)
      }
      const data = await response.json()

      if (data) {
        trackIndexDTFQuote({
          account,
          tokenIn,
          tokenOut,
          dtfTicker,
          chainId,
          type,
          endpoint: currentEndpoint,
          status: data.status,
          amountInValue: data.result?.amountInValue,
          amountOutValue: data.result?.amountOutValue,
          dustValue: data.result?.dustValue,
          truePriceImpact: data.result?.truePriceImpact,
          source: 'zap',
        })
      }

      if (data && data.status === 'error') {
        throw new Error(data.error)
      }

      lastData = data

      if (data && data.result) {
        const amountOut = Number(data.result.amountOutValue)
        const dust = Number(data.result.dustValue)
        const priceImpact = Number(data.result.truePriceImpact)
        const isDustRetry =
          dustAttempt < maxDustRetries &&
          dust > DUST_REFRESH_THRESHOLD * amountOut

        if (isDustRetry) {
          dustAttempt++
          continue
        }

        const isPriceImpactRetry =
          priceImpactAttempt < maxPriceImpactRetries &&
          priceImpact > PRICE_IMPACT_THRESHOLD

        if (isPriceImpactRetry) {
          priceImpactAttempt++
          continue
        }
      }
      break
    }

    return { ...lastData, source: 'zap' }
  }

  // Fetch Odos quote without dust/price impact retries
  const fetchOdosQuote = async (): Promise<ZapResponse & { source: 'odos' }> => {
    const currentEndpoint = odosEndpoint

    if (!currentEndpoint) throw new Error('No Odos endpoint available')

    trackIndexDTFQuoteRequested({
      account,
      tokenIn,
      tokenOut,
      dtfTicker,
      chainId,
      type,
      endpoint: currentEndpoint,
      source: 'odos',
    })

    const response = await fetch(currentEndpoint)
    if (!response.ok) {
      const error = response.status
      trackIndexDTFQuoteError({
        account,
        tokenIn,
        tokenOut,
        dtfTicker,
        chainId,
        type,
        endpoint: currentEndpoint,
        status: 'error',
        error,
        source: 'odos',
      })
      throw new Error(`Odos Error: ${error}`)
    }
    const data = await response.json()

    if (data) {
      trackIndexDTFQuote({
        account,
        tokenIn,
        tokenOut,
        dtfTicker,
        chainId,
        type,
        endpoint: currentEndpoint,
        status: data.status,
        amountInValue: data.result?.amountInValue,
        amountOutValue: data.result?.amountOutValue,
        dustValue: data.result?.dustValue,
        truePriceImpact: data.result?.truePriceImpact,
        source: 'odos',
      })
    }

    if (data && data.status === 'error') {
      throw new Error(data.error)
    }

    return { ...data, source: 'odos' }
  }

  // Select best quote based on minAmountOut
  const selectBestQuote = (
    zapQuote?: ZapResponse & { source: 'zap' },
    odosQuote?: ZapResponse & { source: 'odos' }
  ): (ZapResponse & { source: 'zap' | 'odos' }) | undefined => {
    if (!zapQuote && !odosQuote) return undefined
    if (!zapQuote) return odosQuote
    if (!odosQuote) return zapQuote

    const zapMinAmountOut = zapQuote.result?.minAmountOut ? BigInt(zapQuote.result.minAmountOut) : BigInt(0)
    const odosMinAmountOut = odosQuote.result?.minAmountOut ? BigInt(odosQuote.result.minAmountOut) : BigInt(0)

    // In case of tie, prefer zap
    if (odosMinAmountOut > zapMinAmountOut) {
      return odosQuote
    }
    return zapQuote
  }

  return useQuery({
    queryKey: ['zapDeploy', zapEndpoint, odosEndpoint, quoteSource],
    queryFn: async (): Promise<ZapResponse & { source: 'zap' | 'odos' }> => {
      // Based on quote source preference, fetch the appropriate quotes
      if (quoteSource === 'zap') {
        return await fetchZapQuote()
      } else if (quoteSource === 'odos') {
        return await fetchOdosQuote()
      } else {
        // 'best' - fetch both in parallel and select the best
        const results = await Promise.allSettled([
          fetchZapQuote(),
          fetchOdosQuote()
        ])

        const zapResult = results[0].status === 'fulfilled' ? results[0].value : undefined
        const odosResult = results[1].status === 'fulfilled' ? results[1].value : undefined

        const bestQuote = selectBestQuote(zapResult, odosResult)
        
        if (!bestQuote) {
          // Both failed, throw the first error
          if (results[0].status === 'rejected') {
            throw results[0].reason
          }
          if (results[1].status === 'rejected') {
            throw results[1].reason
          }
          throw new Error('No quotes available')
        }

        return bestQuote
      }
    },
    enabled: (quoteSource === 'best' ? (!!zapEndpoint || !!odosEndpoint) : quoteSource === 'zap' ? !!zapEndpoint : !!odosEndpoint) && !disabled,
    refetchInterval: 12000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * Math.pow(2, attempt), 10000),
  })
}

export default useZapSwapQuery