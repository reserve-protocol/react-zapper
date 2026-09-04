import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'
import { chainIdAtom } from '../src/state/atoms'
import { ChainId } from '../src/utils/chains'
import { reducedZappableTokens } from '../src/utils/constants'
import {
  selectedTokenAtom,
  selectedTokenOrDefaultAtom,
  tokenInAtom,
  zapperCurrentTabAtom,
} from '../src/components/zap-mint/atom'

const baseUsdc = reducedZappableTokens[ChainId.Base].find(
  (token) => token.symbol === 'USDC'
)!

describe('selected token across a chain switch', () => {
  it('keeps a selection that belongs to the current chain', () => {
    const store = createStore()
    store.set(chainIdAtom, ChainId.Base)
    store.set(selectedTokenAtom, baseUsdc)

    expect(store.get(selectedTokenOrDefaultAtom)).toBe(baseUsdc)
  })

  it('falls back to the new chain default the moment the chain changes', () => {
    const store = createStore()
    store.set(chainIdAtom, ChainId.Base)
    store.set(selectedTokenAtom, baseUsdc)
    store.set(zapperCurrentTabAtom, 'buy')

    store.set(chainIdAtom, ChainId.BSC)

    const bscDefault = reducedZappableTokens[ChainId.BSC][0]
    expect(store.get(selectedTokenOrDefaultAtom)).toBe(bscDefault)
    expect(store.get(tokenInAtom)).toBe(bscDefault)
  })
})
