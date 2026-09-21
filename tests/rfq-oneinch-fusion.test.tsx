/**
 * End-to-end 1inch Fusion flow against the harness, with the Reserve API
 * endpoints mocked (the order is built server-side, the 1inch key never
 * reaches the browser):
 * - ERC-20 input: quote with ready-to-sign typed data -> Order signature ->
 *   POST 1inch/fusion/order -> fill polling.
 * - Native input: the quote carries the factory transaction and the relayer
 *   signature -> POST 1inch/fusion/order (registration, nothing signed) ->
 *   single factory tx -> fill polling; expiry surfaces the refund notice.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  FUSION_EXTENSION,
  FUSION_NATIVE_FACTORY,
  FUSION_NATIVE_SIGNATURE,
  FUSION_ORDER_STRUCT,
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  scenario,
  setup,
  TX_HASH,
  waitForReadyCta,
} from './helpers/harness'

const probe = () =>
  JSON.parse(screen.getByTestId('probe').textContent || '{}') as {
    ongoingTx: boolean
    success: boolean
    receivedAmount?: string
    txHash?: string
  }

describe('1inch Fusion RFQ flow', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('signs the server-built order, relays it through the Reserve API and waits for the fill', async () => {
    scenario.fusionStatuses = ['open', 'fulfilled']
    await setup({ quoteSource: '1inch', chain: 'bsc', inputToken: 'wbnb' })
    await waitForReadyCta()

    const quotesBeforeClick = scenario.fusionQuoteFetches
    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.fusionSubmittedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )
    const submitted = scenario.fusionSubmittedOrders[0]
    expect(submitted.chainId).toBe(56)
    // the struct, extension and quote id go back exactly as quoted
    expect(submitted.order).toEqual(FUSION_ORDER_STRUCT)
    expect(submitted.extension).toBe(FUSION_EXTENSION)
    // ...by the quote taken at click time, not the one that was on screen: a
    // Fusion order's auction starts seconds after it is built
    const relayedQuote = Number(String(submitted.quoteId).split('-').pop())
    expect(relayedQuote).toBeGreaterThan(quotesBeforeClick)
    expect(String(submitted.signature)).toMatch(/^0x[0-9a-f]+$/i)
    expect(submitted.signature).not.toBe(FUSION_NATIVE_SIGNATURE)
    expect(scenario.calls).toContain('eth_signTypedData_v4')

    // fulfilled -> the regular success path, with the amount the fill paid
    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(true)
        expect(state.receivedAmount).toBe('1001')
        expect(state.txHash).toBe(TX_HASH)
      },
      { timeout: 30_000, interval: 200 }
    )

    // gasless: no transaction was ever sent
    expect(
      scenario.calls.filter((c) => c === 'eth_sendTransaction')
    ).toHaveLength(0)
  })

  it('resets and refetches the quote when the order expires unfilled', async () => {
    scenario.fusionStatuses = ['open', 'expired']
    await setup({ quoteSource: '1inch', chain: 'bsc', inputToken: 'wbnb' })
    await waitForReadyCta()

    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.fusionSubmittedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )
    // counted after the click-time re-quote, so only the post-expiry refetch passes
    const fetchesBefore = scenario.fusionQuoteFetches

    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(false)
        expect(state.ongoingTx).toBe(false)
        expect(scenario.fusionQuoteFetches).toBeGreaterThan(fetchesBefore)
      },
      { timeout: 30_000, interval: 200 }
    )
  })

  it('places a native sale on-chain: registers the order, then one factory tx, nothing signed', async () => {
    scenario.fusionStatuses = ['open', 'fulfilled']
    await setup({ quoteSource: '1inch', chain: 'bsc' }) // default input: native BNB
    await waitForReadyCta()

    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.sentTransactions).toHaveLength(1),
      { timeout: 15_000 }
    )
    // the relayer knew the order before the funds moved, with the signature
    // the quote carried
    expect(scenario.fusionSubmittedOrders).toHaveLength(1)
    expect(scenario.fusionSubmittedOrders[0].quoteId).not.toBe('fusion-quote-1')
    expect(scenario.fusionSubmittedOrders[0].signature).toBe(
      FUSION_NATIVE_SIGNATURE
    )
    const tx = scenario.sentTransactions[0]
    expect(String(tx.to).toLowerCase()).toBe(FUSION_NATIVE_FACTORY)
    expect(BigInt(String(tx.value))).toBe(10n ** 18n)
    expect(tx.data).toBe('0xc0ffee')
    expect(scenario.calls).not.toContain('eth_signTypedData_v4')

    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(true)
        expect(state.receivedAmount).toBe('1001')
        expect(state.txHash).toBe(TX_HASH)
      },
      { timeout: 30_000, interval: 200 }
    )
  })

  it('explains the refund when a native order expires unfilled', async () => {
    scenario.fusionStatuses = ['open', 'expired']
    await setup({ quoteSource: '1inch', chain: 'bsc' })
    await waitForReadyCta()

    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.sentTransactions).toHaveLength(1),
      { timeout: 15_000 }
    )

    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(false)
        expect(state.ongoingTx).toBe(false)
        expect(screen.getByText(/refund your BNB/i)).toBeTruthy()
      },
      { timeout: 30_000, interval: 200 }
    )
  })
})
