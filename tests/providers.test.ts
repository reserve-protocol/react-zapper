/**
 * Provider registry: 1inch joins the tx-based aggregators on every chain and
 * is fetched through the Reserve API proxy (`{apiUrl}1inch/swap`), never from
 * the browser — the 1inch key and quota live server-side.
 */
import { describe, expect, it } from 'vitest'

import { ChainId } from '../src/utils/chains'
import { getEnabledAggregators, PROVIDERS } from '../src/utils/providers'

const params = {
  url: 'https://api.reserve.org/',
  chainId: ChainId.Base,
  tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  tokenOut: '0x4200000000000000000000000000000000000006',
  amountIn: '1000000',
  slippage: 100,
  signer: '0x000000000000000000000000000000000000dEaD',
} as const

describe('1inch provider', () => {
  it('is an enabled aggregator on every supported chain', () => {
    for (const chainId of [
      ChainId.Mainnet,
      ChainId.Base,
      ChainId.Arbitrum,
      ChainId.BSC,
    ]) {
      expect(getEnabledAggregators(chainId).map((p) => p.id)).toContain('1inch')
    }
  })

  it('quotes through the Reserve API 1inch proxy with the shared query shape', () => {
    const endpoint = PROVIDERS['1inch'].buildEndpoint(params)
    expect(endpoint).toBe(
      'https://api.reserve.org/1inch/swap?chainId=8453&tokenIn=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&tokenOut=0x4200000000000000000000000000000000000006&amountIn=1000000&slippage=100&signer=0x000000000000000000000000000000000000dEaD'
    )
    expect(PROVIDERS['1inch'].buildEndpoint({ ...params, amountIn: '0' })).toBeNull()
  })
})
