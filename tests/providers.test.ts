/**
 * Provider registry: 1inch is an intent (RFQ) source on every chain. It quotes
 * through 1inch Fusion behind the Reserve API (`{apiUrl}1inch/fusion/*`), never
 * from the browser — the 1inch key and quota live server-side — and no longer
 * through the Classic calldata proxy (`{apiUrl}1inch/swap`).
 */
import { describe, expect, it } from 'vitest'

import { ChainId } from '../src/utils/chains'
import {
  getEnabledAggregators,
  getEnabledProviders,
  PROVIDERS,
} from '../src/utils/providers'
import { isRfqProvider, RFQ_ADAPTERS } from '../src/utils/rfq'

const CHAINS = [ChainId.Mainnet, ChainId.Base, ChainId.Arbitrum, ChainId.BSC]

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
  it('is an enabled intent source, not an aggregator, on every supported chain', () => {
    for (const chainId of CHAINS) {
      expect(getEnabledProviders(chainId).map((p) => p.id)).toContain('1inch')
      expect(getEnabledAggregators(chainId).map((p) => p.id)).not.toContain(
        '1inch'
      )
    }
    expect(PROVIDERS['1inch'].kind).toBe('rfq')
    expect(isRfqProvider('1inch')).toBe(true)
    expect(PROVIDERS['1inch'].rfq).toBe(RFQ_ADAPTERS['1inch'])
  })

  it('has no calldata endpoint: quotes come from its adapter', () => {
    expect(PROVIDERS['1inch'].buildEndpoint(params)).toBeNull()
    expect(PROVIDERS['1inch'].rfq?.describeEndpoint(ChainId.BSC)).toBe(
      'https://api.reserve.org/1inch/fusion/quote?chainId=56'
    )
  })
})
