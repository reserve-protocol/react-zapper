import mixpanel from 'mixpanel-browser/src/loaders/loader-module-core'
import { MIXPANEL_TOKEN } from './constants'

// Initialize Mixpanel with the hardcoded token
mixpanel.init(MIXPANEL_TOKEN, {
  track_pageview: true,
})

export interface TrackingData {
  page?: string
  subpage?: string
  cta?: string
  ca?: string
  ticker?: string
  chain?: string | number
  input?: string
  output?: string
  error?: string
  txHash?: string
  slippage?: number
  amount?: string
  quote?: string
  setting?: string
  value?: string | number | boolean
  tab?: string
  endpoint?: string
  errorType?: string
  gas?: string
  truePriceImpact?: string
  outputAmount?: string
}

// Main tracking function
export const track = (event: string, data?: TrackingData) => {
  try {
    mixpanel.track(event, data)
  } catch (error) {
    console.warn('Mixpanel tracking failed:', error)
  }
}

// Track page views - UNUSED, kept for future page tracking needs
export const trackPageView = (
  page: string,
  subpage?: string,
  additionalData?: TrackingData
) => {
  try {
    mixpanel.track('page_view', {
      page,
      subpage,
      ...additionalData,
    })
  } catch (error) {
    console.warn('Mixpanel page view tracking failed:', error)
  }
}

// Track user clicks/taps
export const trackClick = (
  page: string,
  ctaLabel: string,
  ca?: string,
  ticker?: string,
  chain?: string | number,
  additionalData?: TrackingData
) => {
  track('tap', {
    page,
    cta: ctaLabel,
    ca,
    ticker,
    chain,
    ...additionalData,
  })
}

// Track zapper modal open/close
export const trackZapperModal = (
  action: 'open' | 'close',
  ticker?: string,
  ca?: string,
  chain?: string | number
) => {
  track('zapper_modal', {
    page: 'zapper',
    cta: action,
    ticker,
    ca,
    chain,
  })
}

// Track tab switches
export const trackTabSwitch = (
  tab: 'buy' | 'sell',
  ticker?: string,
  ca?: string,
  chain?: string | number
) => {
  track('zapper_tab_switch', {
    page: 'zapper',
    cta: tab,
    ticker,
    ca,
    chain,
  })
}

// Track settings interactions
export const trackSettings = (
  action: 'open' | 'close' | 'change',
  setting?: string,
  value?: string | number | boolean,
  ticker?: string,
  ca?: string,
  chain?: string | number
) => {
  track('zapper_settings', {
    page: 'zapper',
    subpage: 'settings',
    cta: action,
    setting,
    value,
    ticker,
    ca,
    chain,
  })
}

// Track quote refresh
export const trackQuoteRefresh = (
  type: 'manual' | 'auto',
  ticker?: string,
  ca?: string,
  chain?: string | number,
  additionalData?: TrackingData
) => {
  track('zapper_quote_refresh', {
    page: 'zapper',
    cta: type,
    ticker,
    ca,
    chain,
    ...additionalData,
  })
}

// Track transaction submission
export const trackTransactionSubmit = (
  type: 'buy' | 'sell',
  inputSymbol?: string,
  outputSymbol?: string,
  amount?: string,
  ticker?: string,
  ca?: string,
  chain?: string | number,
  additionalData?: TrackingData
) => {
  track('zapper_transaction_submit', {
    page: 'zapper',
    cta: type,
    input: inputSymbol,
    output: outputSymbol,
    amount,
    ticker,
    ca,
    chain,
    ...additionalData,
  })
}

// Track transaction success
export const trackTransactionSuccess = (
  type: 'buy' | 'sell',
  txHash: string,
  inputSymbol?: string,
  outputSymbol?: string,
  amount?: string,
  ticker?: string,
  ca?: string,
  chain?: string | number,
  additionalData?: TrackingData
) => {
  track('zapper_transaction_success', {
    page: 'zapper',
    cta: type,
    txHash,
    input: inputSymbol,
    output: outputSymbol,
    amount,
    ticker,
    ca,
    chain,
    ...additionalData,
  })
}

// Track transaction error
export const trackTransactionError = (
  type: 'buy' | 'sell',
  error: string,
  inputSymbol?: string,
  outputSymbol?: string,
  amount?: string,
  ticker?: string,
  ca?: string,
  chain?: string | number,
  additionalData?: TrackingData
) => {
  track('zapper_transaction_error', {
    page: 'zapper',
    cta: type,
    error,
    input: inputSymbol,
    output: outputSymbol,
    amount,
    ticker,
    ca,
    chain,
    ...additionalData,
  })
}

// Track token selection
export const trackTokenSelection = (
  tokenSymbol: string,
  type: 'input' | 'output',
  ticker?: string,
  ca?: string,
  chain?: string | number
) => {
  track('zapper_token_select', {
    page: 'zapper',
    cta: type,
    input: type === 'input' ? tokenSymbol : undefined,
    output: type === 'output' ? tokenSymbol : undefined,
    ticker,
    ca,
    chain,
  })
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
}) => {
  mixpanel.track('index-dtf-zap-swap', {
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
}) => {
  mixpanel.track('index-dtf-zap-swap', {
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
  })
}
