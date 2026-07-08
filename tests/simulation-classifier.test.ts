import { HttpRequestError, RpcRequestError } from 'viem'
import { getEstimateGasError } from 'viem/utils'
import { describe, expect, it } from 'vitest'

import type { ProviderQuote } from '../src/hooks/zap-quote-providers'
import {
  classifyEstimateGasError,
  filterQuotesBySimulation,
  SimulationTimeoutError,
} from '../src/hooks/zap-quote-simulation'

// Builds the exact error shape the wagmi/viem estimateGas action throws for a
// given raw JSON-RPC error
const estimateError = (code: number, message: string) =>
  getEstimateGasError(
    new RpcRequestError({ body: {}, url: 'http://rpc', error: { code, message } }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { account: undefined, chain: undefined } as any
  )

describe('classifyEstimateGasError', () => {
  it('classifies an on-chain revert (rpc code 3) as revert', () => {
    expect(
      classifyEstimateGasError(estimateError(3, 'execution reverted: STALE_QUOTE'))
    ).toBe('revert')
  })

  it('classifies "execution reverted" node messages as revert', () => {
    expect(
      classifyEstimateGasError(estimateError(-32000, 'execution reverted'))
    ).toBe('revert')
  })

  it('treats balance-capped estimation (gas required exceeds allowance) as infra', () => {
    expect(
      classifyEstimateGasError(
        estimateError(-32000, 'gas required exceeds allowance (21000)')
      )
    ).toBe('infra')
  })

  it('treats insufficient funds as infra', () => {
    expect(
      classifyEstimateGasError(
        estimateError(-32000, 'insufficient funds for gas * price + value')
      )
    ).toBe('infra')
  })

  it('treats network/transport errors as infra', () => {
    expect(
      classifyEstimateGasError(new HttpRequestError({ url: 'http://rpc' }))
    ).toBe('infra')
  })

  it('treats simulation timeouts as infra', () => {
    expect(classifyEstimateGasError(new SimulationTimeoutError('timeout'))).toBe(
      'infra'
    )
  })

  it('classifies plain errors by message', () => {
    expect(classifyEstimateGasError(new Error('execution reverted'))).toBe(
      'revert'
    )
    expect(classifyEstimateGasError(new Error('rate limited'))).toBe('infra')
    expect(classifyEstimateGasError('boom')).toBe('infra')
  })
})

const quote = (
  source: string,
  result: Record<string, unknown> | undefined
): ProviderQuote =>
  ({
    status: 'success',
    source,
    endpoint: `https://api/${source}`,
    result,
  }) as unknown as ProviderQuote

const simulatable = (source: string, data: string) =>
  quote(source, {
    approvalNeeded: false,
    tx: { data, to: '0x2000000000000000000000000000000000000002', value: '0' },
  })

describe('filterQuotesBySimulation', () => {
  it('splits reverting quotes from passing ones, preserving order', async () => {
    const quotes = [
      simulatable('zap', '0xaa'),
      simulatable('odos', '0xbb'),
      simulatable('enso', '0xcc'),
    ]
    const { kept, filtered } = await filterQuotesBySimulation(
      quotes,
      async (q) => {
        if (q.source === 'odos') throw estimateError(3, 'execution reverted')
      }
    )
    expect(kept.map((q) => q.source)).toEqual(['zap', 'enso'])
    expect(filtered.map((f) => f.quote.source)).toEqual(['odos'])
  })

  it('keeps quotes that fail for infra reasons', async () => {
    const { kept, filtered } = await filterQuotesBySimulation(
      [simulatable('zap', '0xaa')],
      async () => {
        throw new HttpRequestError({ url: 'http://rpc' })
      }
    )
    expect(kept).toHaveLength(1)
    expect(filtered).toHaveLength(0)
  })

  it('keeps unverifiable quotes (approval needed or no tx) without simulating', async () => {
    let simulations = 0
    const { kept, filtered } = await filterQuotesBySimulation(
      [
        quote('zap', { approvalNeeded: true, tx: { data: '0xaa', to: '0x1', value: '0' } }),
        quote('odos', { approvalNeeded: false, tx: null }),
        quote('enso', undefined),
      ],
      async () => {
        simulations++
        throw estimateError(3, 'execution reverted')
      }
    )
    expect(simulations).toBe(0)
    expect(kept).toHaveLength(3)
    expect(filtered).toHaveLength(0)
  })

  it('keeps quotes whose simulation times out', async () => {
    const { kept, filtered } = await filterQuotesBySimulation(
      [simulatable('zap', '0xaa')],
      () => new Promise(() => {}), // never settles
      100
    )
    expect(kept).toHaveLength(1)
    expect(filtered).toHaveLength(0)
  })
})
