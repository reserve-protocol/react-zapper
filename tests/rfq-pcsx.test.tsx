/**
 * End-to-end PCSX (PancakeSwap X) RFQ flow against the harness, with the
 * Reserve API endpoints mocked: quote (ready-to-sign Permit2 order) ->
 * PermitWitnessTransferFrom signature -> POST pcsx/order -> fill polling.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  PCSX_ENCODED_ORDER,
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

describe('pcsx RFQ flow', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('signs the Permit2 order, submits it through the Reserve API and waits for the fill', async () => {
    scenario.pcsxStatuses = ['OPEN', 'FILLED']
    await setup({ quoteSource: 'pcsx', chain: 'bsc', inputToken: 'wbnb' })
    await waitForReadyCta()

    fireEvent.click(getCta())

    // the signed order reaches the Reserve API proxy
    await waitFor(
      () => expect(scenario.pcsxSubmittedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )
    const submitted = scenario.pcsxSubmittedOrders[0]
    expect(submitted.chainId).toBe(56)
    expect(submitted.encodedOrder).toBe(PCSX_ENCODED_ORDER)
    expect(String(submitted.signature)).toMatch(/^0x[0-9a-f]+$/i)
    // the order-handler rejects V3 orders without the quote's id
    expect(submitted.quoteId).toBe('pcsx-quote-1')
    expect(scenario.calls).toContain('eth_signTypedData_v4')

    // FILLED -> the regular success path, tx hash from the fill
    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(true)
        expect(state.receivedAmount).toBe('1000') // quoted amountOut fallback
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
    scenario.pcsxStatuses = ['OPEN', 'EXPIRED']
    await setup({ quoteSource: 'pcsx', chain: 'bsc', inputToken: 'wbnb' })
    await waitForReadyCta()

    const fetchesBefore = scenario.pcsxQuoteFetches
    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.pcsxSubmittedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )

    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(false)
        expect(state.ongoingTx).toBe(false)
        expect(scenario.pcsxQuoteFetches).toBeGreaterThan(fetchesBefore)
      },
      { timeout: 30_000, interval: 200 }
    )
  })

  it('surfaces a clear error when pcsx is selected with a native input', async () => {
    await setup({ quoteSource: 'pcsx', chain: 'bsc' }) // default input: native BNB

    await waitFor(
      () =>
        expect(screen.getByText(/cannot sell the native token/i)).toBeTruthy(),
      { timeout: 60_000, interval: 500 }
    )
  })
})
