import { describe, expect, it } from 'vitest'
import { ethAddress } from 'viem'

import { sortTokensByUsdValue } from '../src/utils/token-order'
import { reducedZappableTokens } from '../src/utils/constants'
import { ChainId } from '../src/utils/chains'

const tokens = reducedZappableTokens[ChainId.Mainnet]
const [eth, weth, usdc] = tokens.map((t) => t.address.toLowerCase())

describe('sortTokensByUsdValue', () => {
  it('orders tokens by balance × price, descending', () => {
    const order = sortTokensByUsdValue(
      tokens,
      { [eth]: '0.5', [weth]: '0.1', [usdc]: '5000' },
      { [eth]: 2000, [weth]: 2000, [usdc]: 1 }
    )
    expect(order).toEqual([usdc, eth, weth])
  })

  it('keeps the default order on ties (all balances zero)', () => {
    const order = sortTokensByUsdValue(
      tokens,
      { [eth]: '0', [weth]: '0', [usdc]: '0' },
      { [eth]: 2000, [weth]: 2000, [usdc]: 1 }
    )
    expect(order).toEqual([eth, weth, usdc])
  })

  it('treats missing balances as zero', () => {
    const order = sortTokensByUsdValue(
      tokens,
      { [usdc]: '100' },
      { [eth]: 2000, [weth]: 2000, [usdc]: 1 }
    )
    expect(order).toEqual([usdc, eth, weth])
  })

  it('treats missing prices as zero, preserving default order among them', () => {
    const order = sortTokensByUsdValue(
      tokens,
      { [eth]: '1', [weth]: '2', [usdc]: '100' },
      { [usdc]: 1 }
    )
    expect(order).toEqual([usdc, eth, weth])
  })

  it('falls back to the default order when there is no data at all', () => {
    const order = sortTokensByUsdValue(tokens, {}, {})
    expect(order).toEqual([eth, weth, usdc])
  })

  it('normalizes addresses to lowercase', () => {
    const order = sortTokensByUsdValue(tokens, { [eth]: '1' }, { [eth]: 2000 })
    expect(order[0]).toBe(ethAddress.toLowerCase())
    order.forEach((address) => expect(address).toBe(address.toLowerCase()))
  })
})
