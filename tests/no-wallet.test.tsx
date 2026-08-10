/**
 * No-wallet usage: the widget quotes with a placeholder signer while
 * disconnected — inputs enabled, quotes shown, nothing executable — and the
 * CTA prompts the wallet connect flow instead of submitting.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  scenario,
  setup,
  waitForReadyCta,
} from './helpers/harness'

describe('no-wallet quoting', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
  })

  afterEach(async () => {
    await harnessAfterEach()
  })

  it('quotes while disconnected and prompts connect on CTA click', async () => {
    const connectWallet = vi.fn()
    await setup({ connected: false, connectWallet })

    // disconnected default input is the stable leading the token list
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0)

    // the placeholder-signed round actually fetches quotes (before this
    // feature the query was disabled entirely without an account)
    await waitFor(() => expect(scenario.quoteFetches).toBeGreaterThan(0), {
      timeout: 15_000,
    })
    await waitForReadyCta()

    // the input stayed usable
    const input = document.querySelector('input')
    expect(input?.disabled).toBe(false)

    // balance gating must not fire without an account
    expect(screen.queryByText(/Insufficient balance/i)).toBeNull()

    // clicking prompts the connect flow — and never touches the chain
    fireEvent.click(getCta())
    await waitFor(() => expect(connectWallet).toHaveBeenCalledTimes(1))
    expect(scenario.sentTransactions).toHaveLength(0)
    // display-only quotes carry no tx, so nothing was ever simulated either
    expect(scenario.calls.filter((c) => c === 'eth_estimateGas')).toHaveLength(0)
  }, 40_000)
})
