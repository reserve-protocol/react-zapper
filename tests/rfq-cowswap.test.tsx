/**
 * End-to-end RFQ (CoW Swap) flows against the harness.
 * - Gasless (ERC-20 input): quote -> EIP-712 signature -> order posted to the
 *   mocked order book -> fill polling.
 * - Eth-flow (native input): quote against the wrapped token -> single
 *   createOrder tx to the EthFlow contract -> fill polling; expiry surfaces
 *   the automatic-refund notice.
 */
import { decodeFunctionData, type Abi, type Hex } from 'viem'
import { EthFlowAbi } from '@cowprotocol/cow-sdk'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  COW_UID,
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  scenario,
  setup,
  TX_HASH,
  waitForReadyCta,
  WETH_TOKEN,
} from './helpers/harness'

const ETH_FLOW = '0xba3cb449bd2b4adddbc894d8697f5170800eadec'

const probe = () =>
  JSON.parse(screen.getByTestId('probe').textContent || '{}') as {
    ongoingTx: boolean
    fetching: boolean
    success: boolean
    receivedAmount?: string
    txHash?: string
    orderExplorerUrl?: string
  }

describe('cowswap RFQ flow', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('signs, posts and waits for the fill, then lands on the success path', async () => {
    scenario.cowStatuses = ['open', 'fulfilled']
    await setup({ quoteSource: 'cowswap', inputToken: 'weth' })
    await waitForReadyCta()

    fireEvent.click(getCta())

    // the signed order reaches the order book with the EIP-712 invariants
    await waitFor(
      () => expect(scenario.cowPostedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )
    const posted = scenario.cowPostedOrders[0]
    expect(posted.signingScheme).toBe('eip712')
    expect(posted.feeAmount).toBe('0')
    // fee folded: 0.99 net + 0.01 fee = the 1 WETH input
    expect(posted.sellAmount).toBe('1000000000000000000')
    // limit = quoted 1000 minus 1% slippage
    expect(posted.buyAmount).toBe('990000000000000000000')
    expect(posted.kind).toBe('sell')
    expect(posted.partiallyFillable).toBe(false)
    expect(scenario.calls).toContain('eth_signTypedData_v4')

    // while polling, the CTA advertises the fill wait
    await waitFor(() =>
      expect(getCta().textContent).toMatch(/Waiting for order to fill/i)
    )

    // fulfilled -> success snapshot from the order book's executed amount
    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(true)
        expect(state.receivedAmount).toBe('1000')
        expect(state.txHash).toBe(TX_HASH)
        expect(state.orderExplorerUrl).toBe(
          `https://explorer.cow.fi/orders/${COW_UID}`
        )
      },
      { timeout: 30_000, interval: 200 }
    )

    // an intent flow never sends a transaction
    expect(
      scenario.calls.filter((c) => c === 'eth_sendTransaction')
    ).toHaveLength(0)
  })

  it('resets and refetches the quote when the order expires unfilled', async () => {
    scenario.cowStatuses = ['open', 'expired']
    await setup({ quoteSource: 'cowswap', inputToken: 'weth' })
    await waitForReadyCta()

    const fetchesBefore = scenario.cowQuoteFetches
    fireEvent.click(getCta())

    await waitFor(
      () => expect(scenario.cowPostedOrders).toHaveLength(1),
      { timeout: 15_000 }
    )

    // expired -> the flow unfreezes and a fresh quote replaces the stale one
    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(false)
        expect(state.ongoingTx).toBe(false)
        expect(scenario.cowQuoteFetches).toBeGreaterThan(fetchesBefore)
      },
      { timeout: 30_000, interval: 200 }
    )
  })

  it('routes native inputs through eth-flow: one createOrder tx, no approval, then the fill wait', async () => {
    scenario.cowStatuses = ['open', 'fulfilled']
    await setup({ quoteSource: 'cowswap' }) // default input: native ETH
    await waitForReadyCta()

    // the quote was requested against the wrapped native as an on-chain order
    const quoteBody = scenario.cowQuoteBodies[0]
    expect(String(quoteBody.sellToken).toLowerCase()).toBe(
      WETH_TOKEN.address.toLowerCase()
    )
    expect(quoteBody.onchainOrder).toBe(true)
    expect(quoteBody.signingScheme).toBe('eip1271')

    fireEvent.click(getCta())

    // a single tx to the EthFlow contract carrying the native amount
    await waitFor(
      () => expect(scenario.sentTransactions).toHaveLength(1),
      { timeout: 15_000 }
    )
    const tx = scenario.sentTransactions[0]
    expect(String(tx.to).toLowerCase()).toBe(ETH_FLOW)
    expect(BigInt(String(tx.value))).toBe(10n ** 18n) // 0.99 net + 0.01 fee
    const decoded = decodeFunctionData({
      abi: EthFlowAbi as Abi,
      data: tx.data as Hex,
    })
    expect(decoded.functionName).toBe('createOrder')
    const order = (decoded.args as [Record<string, unknown>])[0]
    expect(order.feeAmount).toBe(0n)
    expect(order.partiallyFillable).toBe(false)
    expect(order.buyAmount).toBe(990n * 10n ** 18n) // 1% slippage limit
    const validTo = Number(order.validTo)
    const nowSec = Math.floor(Date.now() / 1000)
    expect(validTo).toBeGreaterThan(nowSec + 500)
    expect(validTo).toBeLessThan(nowSec + 700)
    // no EIP-712 signature and no order-book POST for eth-flow
    expect(scenario.calls).not.toContain('eth_signTypedData_v4')
    expect(scenario.cowPostedOrders).toHaveLength(0)

    // fulfilled -> the regular success path
    await waitFor(
      () => {
        const state = probe()
        expect(state.success).toBe(true)
        expect(state.receivedAmount).toBe('1000')
        expect(state.txHash).toBe(TX_HASH)
      },
      { timeout: 30_000, interval: 200 }
    )
  })

  it('shows the automatic-refund notice when an eth-flow order expires unfilled', async () => {
    scenario.cowStatuses = ['open', 'expired']
    await setup({ quoteSource: 'cowswap' }) // native input -> eth-flow
    await waitForReadyCta()

    const fetchesBefore = scenario.cowQuoteFetches
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
        expect(scenario.cowQuoteFetches).toBeGreaterThan(fetchesBefore)
        // the refund explainer is visible
        expect(screen.getByText(/automatically refund/i)).toBeTruthy()
      },
      { timeout: 30_000, interval: 200 }
    )
  })
})
