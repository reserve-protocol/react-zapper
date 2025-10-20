import { Address } from 'viem'

// Default API URL - can be overridden via config
export const DEFAULT_API_URL = 'https://api.reserve.org/'

const getBaseZapApiUrl = (url: string, chain: number) =>
  url + `api/zapper/${chain}`

export type ZapPayload = {
  url: string
  chainId: number
  tokenIn: Address
  tokenOut: Address
  amountIn: string
  slippage: number
  signer: Address
  trade?: boolean
  bypassCache?: boolean
  debug?: boolean
}

export type ZapResult = {
  tokenIn: Address
  amountIn: string
  amountInValue: number | null

  tokenOut: Address
  amountOut: string
  amountOutValue: number | null
  minAmountOut?: string

  approvalAddress: Address
  approvalNeeded: boolean
  insufficientFunds: boolean

  dust: {
    token: string
    amount: string
  }[]
  dustValue: number | null

  gas: string | null
  priceImpact: number // 0.0% => no impact | 10 => 10% impact
  truePriceImpact: number // -10% => positive impact,  10 => 10% negative impact
  tx: {
    data: string
    to: Address
    value: string
  } | null
  debug?: Debug
}

export type Debug = {
  priceImpactStats: {
    action: string
    address: string[]
    inputToken: string[]
    outputToken: string[]
    impact: number
    input: number
    output: number
    success: boolean
  }[]
}

export type ReportPayload = {
  sessionId: string
  quoteId: string
  retryId: string
  error: string
  tokenIn: {
    address: string
    symbol: string
  }
  tokenOut: {
    address: string
    symbol: string
  }
  amount: string
  value: string
}

export type ZapResponse = {
  status: 'success' | 'error'
  result?: ZapResult
  error?: string
}

export const fetcher = (url: string) => fetch(url).then((res) => res.json())

const zapper = {
  zap: ({
    url,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    signer,
    trade = true,
    bypassCache = false,
    debug = false,
  }: ZapPayload) =>
    `${getBaseZapApiUrl(
      url,
      chainId
    )}/swap?chainId=${chainId}&signer=${signer}&tokenIn=${tokenIn}&amountIn=${amountIn}&tokenOut=${tokenOut}&slippage=${slippage}&trade=${trade}&bypassCache=${bypassCache}${
      debug ? '&debug=true' : ''
    }`,

  odosZap: ({
    url,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    signer,
  }: ZapPayload) =>
    `${url}odos/swap?chainId=${chainId}&tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountIn}&slippage=${slippage}&signer=${signer}`,

  zapDeploy: (url: string, chainId: number) =>
    `${getBaseZapApiUrl(url, chainId)}/deploy?chainId=${chainId}`,

  zapDeployUngoverned: (url: string, chainId: number) =>
    `${getBaseZapApiUrl(url, chainId)}/deploy-ungoverned?chainId=${chainId}`,

  report: (url: string) => `${url}zapper/report`,
}

export default zapper
