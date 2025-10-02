import mixpanel from 'mixpanel-browser/src/loaders/loader-module-core'
import { MIXPANEL_TOKEN } from './constants'
import { chainIdAtom, indexDTFAtom, walletAtom } from '@/state/atoms'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import {
  zapperCurrentTabAtom,
  zapSwapEndpointAtom,
} from '@/components/zap-mint/atom'

// Initialize Mixpanel with the hardcoded token
mixpanel.init(MIXPANEL_TOKEN, {
  track_pageview: true,
})

export const mixpanelTrack = (
  event: string,
  data?: Record<string, unknown>
) => {
  try {
    mixpanel.track(event, data)
  } catch (error) {
    console.warn('Mixpanel tracking failed:', error)
  }
}

export const mixpanelRegister = (key: string, value?: string) => {
  try {
    mixpanel.register({
      [key]: value,
    })
  } catch (error) {
    console.warn('Mixpanel registration failed:', error)
  }
}

export const resetTempRegistrations = () => {
  mixpanelRegister('quoteId', undefined)
  mixpanelRegister('retryId', undefined)
  mixpanelRegister('source', undefined)
  mixpanelRegister('sourceId', undefined)
}

export const trackIndexDTFQuoteError = ({
  account,
  tokenIn,
  tokenOut,
  dtfTicker,
  chainId,
  type,
  endpoint,
  error,
  source,
}: {
  dtfTicker: string
  chainId: number
  type: string
  endpoint: string
  status: string
  account?: string
  tokenIn?: string
  tokenOut?: string
  error: number
  source?: 'zap' | 'odos'
}) => {
  mixpanelTrack('index-dtf-zap-swap', {
    event: 'index-dtf-zap-swap',
    wa: account,
    ca: tokenIn,
    ticker: dtfTicker,
    chainId,
    type,
    endpoint,
    status: 'error',
    tokenIn,
    tokenOut,
    error,
    source,
  })
}

export const trackIndexDTFQuoteRequested = ({
  account,
  tokenIn,
  tokenOut,
  dtfTicker,
  chainId,
  type,
  endpoint,
  source,
}: {
  dtfTicker: string
  chainId: number
  type: string
  endpoint: string
  account?: string
  tokenIn?: string
  tokenOut?: string
  source?: 'zap' | 'odos'
}) => {
  mixpanelTrack('index-dtf-zap-swap', {
    event: 'index-dtf-zap-swap',
    wa: account,
    ca: tokenIn,
    ticker: dtfTicker,
    chainId,
    type,
    endpoint,
    status: 'requested',
    tokenIn,
    tokenOut,
    source,
  })
}

export const trackIndexDTFQuote = ({
  account,
  tokenIn,
  tokenOut,
  dtfTicker,
  chainId,
  type,
  endpoint,
  status,
  amountInValue,
  amountOutValue,
  dustValue,
  truePriceImpact,
  source,
}: {
  dtfTicker: string
  chainId: number
  type: string
  endpoint: string
  status: string
  account?: string
  tokenIn?: string
  tokenOut?: string
  amountInValue?: string
  amountOutValue?: string
  dustValue?: string
  truePriceImpact?: string
  source?: 'zap' | 'odos'
}) => {
  mixpanelTrack('index-dtf-zap-swap', {
    event: 'index-dtf-zap-swap',
    wa: account,
    ca: tokenIn,
    ticker: dtfTicker,
    chainId,
    type,
    endpoint,
    status: status,
    tokenIn,
    tokenOut,
    amountInValue: amountInValue,
    amountOutValue: amountOutValue,
    dustValue: dustValue,
    truePriceImpact: truePriceImpact,
    source,
  })
}

export const useTrackIndexDTFZap = (
  event: string,
  page: string,
  subpage?: string
) => {
  const indexDTF = useAtomValue(indexDTFAtom)

  const track = (
    ctaLabel: string,
    inputSymbol: string,
    outputSymbol: string,
    source?: 'zap' | 'odos'
  ) => {
    if (!indexDTF) return
    mixpanelTrack(event, {
      page,
      subpage,
      cta: ctaLabel,
      ca: indexDTF.id,
      ticker: indexDTF.token.symbol,
      chain: indexDTF.chainId,
      input: inputSymbol,
      output: outputSymbol,
      source,
    })
  }

  return { track }
}

export const useTrackIndexDTFZapClick = (page: string, subpage?: string) => {
  const { track } = useTrackIndexDTFZap('tap', page, subpage)
  return { trackClick: track }
}

export const useTrackQuoteErrorUX = ({
  tokenIn,
  tokenOut,
  zapError,
  source,
}: {
  tokenIn: string
  tokenOut: string
  zapError: string
  source?: 'zap' | 'odos'
}) => {
  const chainId = useAtomValue(chainIdAtom)
  const account = useAtomValue(walletAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const endpoint = useAtomValue(zapSwapEndpointAtom)

  useEffect(() => {
    if (zapError) {
      mixpanelTrack('index-dtf-zap-swap', {
        event: 'index-dtf-zap-swap',
        wa: account,
        ca: tokenIn,
        ticker: indexDTF?.token.symbol || '',
        chainId,
        type: currentTab,
        endpoint,
        status: 'user_error',
        tokenIn,
        tokenOut,
        userError: zapError,
        source,
      })
    }
  }, [
    zapError,
    account,
    tokenIn,
    tokenOut,
    indexDTF,
    currentTab,
    endpoint,
    chainId,
    source,
  ])
}

export const useTrackIndexDTFZapError = ({
  tokenIn,
  tokenOut,
  zapError,
  source,
}: {
  tokenIn: string
  tokenOut: string
  zapError: string
  source?: 'zap' | 'odos'
}) => {
  const chainId = useAtomValue(chainIdAtom)
  const account = useAtomValue(walletAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const endpoint = useAtomValue(zapSwapEndpointAtom)

  useEffect(() => {
    if (zapError) {
      mixpanelTrack('index-dtf-zap-swap', {
        event: 'index-dtf-zap-swap',
        wa: account,
        ca: tokenIn,
        ticker: indexDTF?.token.symbol || '',
        chainId,
        type: currentTab,
        endpoint,
        status: 'user_tx_error',
        tokenIn,
        tokenOut,
        userError: zapError,
        source,
      })
    }
  }, [
    zapError,
    account,
    tokenIn,
    tokenOut,
    indexDTF,
    currentTab,
    endpoint,
    chainId,
    source,
  ])
}
