import { v4 as uuidv4, v5 as uuidv5, v7 as uuidv7 } from 'uuid'

export type Source = 'Zapper' | 'Odos'

export const generateSessionId = (): string => {
  return uuidv4()
}

export const generateQuoteId = ({
  chainId,
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
}: {
  chainId: number
  tokenIn: string
  tokenOut: string
  amountIn: string
  slippage: number
}): string => {
  return uuidv5(
    `${chainId}-${tokenIn}-${tokenOut}-${amountIn}-${slippage}`,
    uuidv5.URL
  )
}

export const generateSourceId = (source: Source): string => {
  return uuidv5(source, uuidv5.URL)
}

export const generateRetryId = (): string => {
  return uuidv7()
}
