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
}

export type ZapResponse = {
  status: 'success' | 'error'
  result?: ZapResult
  error?: string
}

export const fetcher = (url: string) => fetch(url).then((res) => res.json())

const zapper = {
  oldZap: ({
    url,
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    signer,
    trade = true,
  }: ZapPayload) =>
    `${getBaseZapApiUrl(
      url,
      chainId
    )}/swap?chainId=${chainId}&signer=${signer}&tokenIn=${tokenIn}&amountIn=${amountIn}&tokenOut=${tokenOut}&slippage=${slippage}&trade=${trade}`,

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
  }: ZapPayload) =>
    `${getBaseZapApiUrl(
      url,
      chainId
    )}/swap?chainId=${chainId}&signer=${signer}&tokenIn=${tokenIn}&amountIn=${amountIn}&tokenOut=${tokenOut}&slippage=${slippage}&trade=${trade}&bypassCache=${bypassCache}`,

  zapDeploy: (url: string, chainId: number) =>
    `${getBaseZapApiUrl(url, chainId)}/deploy?chainId=${chainId}`,

  zapDeployUngoverned: (url: string, chainId: number) =>
    `${getBaseZapApiUrl(url, chainId)}/deploy-ungoverned?chainId=${chainId}`,
}

export default zapper
