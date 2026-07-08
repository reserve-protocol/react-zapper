/**
 * Pre-selection quote simulation: in `best` mode every candidate tx is
 * simulated and quotes that revert are excluded before picking the winner.
 */
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PROVIDER_ENABLED } from '../src/utils/providers'
import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  makeQuote,
  scenario,
  setQuoteBuilder,
  setup,
  waitForReadyCta,
  ZAP_ROUTER,
} from './helpers/harness'

const ZAP_DATA = '0xaaaa0001'
const ENSO_DATA = '0xbbbb0002'

const providerQuotes = (opts: { ensoApprovalNeeded?: boolean } = {}) =>
  setQuoteBuilder((url) =>
    url.includes('enso/swap')
      ? makeQuote({
          // enso offers the better output, so it wins unless filtered
          amountOut: '1010000000000000000000',
          minAmountOut: '999000000000000000000',
          approvalNeeded: opts.ensoApprovalNeeded ?? false,
          approvalAddress: '0x3000000000000000000000000000000000000003',
          tx: { data: ENSO_DATA, to: ZAP_ROUTER, value: '1000000000000000000' },
        })
      : makeQuote({
          tx: { data: ZAP_DATA, to: ZAP_ROUTER, value: '1000000000000000000' },
        })
  )

const estimatesFor = (data: string) =>
  scenario.calls.filter((c) => c.startsWith('eth_estimateGas') && c.includes(data))

const wonEndpoint = () => screen.getByTestId('probe-endpoint').textContent || ''

const originalProviders = { ...PROVIDER_ENABLED[1]! }

describe('pre-selection quote simulation (best mode)', () => {
  beforeEach(async () => {
    await harnessBeforeEach()
    // reduce the pool to two providers so the fetch mock stays simple
    PROVIDER_ENABLED[1] = { zap: true, odos: false, velora: false, enso: true }
    providerQuotes()
  })

  afterEach(async () => {
    PROVIDER_ENABLED[1] = { ...originalProviders }
    await harnessAfterEach()
  })

  it('selects the best quote when every candidate simulates fine', async () => {
    await setup({ quoteSource: 'best' })
    await waitForReadyCta()

    expect(wonEndpoint()).toContain('enso/swap')
    // both candidates were simulated before selection
    expect(estimatesFor(ZAP_DATA).length).toBeGreaterThan(0)
    expect(estimatesFor(ENSO_DATA).length).toBeGreaterThan(0)
  })

  it('filters out the better quote when its tx reverts', async () => {
    scenario.revertData = [ENSO_DATA]
    await setup({ quoteSource: 'best' })
    await waitForReadyCta()

    expect(wonEndpoint()).toContain('api/zapper')
    expect(estimatesFor(ENSO_DATA).length).toBeGreaterThan(0)
  })

  it('falls back to the unfiltered best when every candidate reverts', async () => {
    scenario.revertData = [ZAP_DATA, ENSO_DATA]
    await setup({ quoteSource: 'best' })

    // no new "no route" state: the raw best (enso) is offered and the submit
    // button's own simulation gate surfaces the failure as before
    await waitFor(
      () => {
        expect(getCta().textContent).toMatch(/Simulation failed/i)
      },
      { timeout: 20_000, interval: 200 }
    )
    expect(wonEndpoint()).toContain('enso/swap')
  })

  it('keeps unverifiable quotes (approval needed) without simulating them', async () => {
    providerQuotes({ ensoApprovalNeeded: true })
    scenario.revertData = [ZAP_DATA]
    await setup({ quoteSource: 'best' })

    // zap reverted and enso can't be verified (needs approval) -> enso wins
    await waitFor(
      () => {
        expect(getCta().textContent).toMatch(/Approve use of/i)
      },
      { timeout: 20_000, interval: 200 }
    )
    expect(wonEndpoint()).toContain('enso/swap')
    expect(estimatesFor(ENSO_DATA)).toHaveLength(0)
  })

  it('skips simulation entirely when the user has insufficient funds', async () => {
    await setup({ quoteSource: 'best', inputAmount: '1000' })

    await waitFor(
      () => {
        expect(getCta().textContent).toMatch(/Insufficient balance/i)
      },
      { timeout: 20_000, interval: 200 }
    )
    // quotes were fetched, but no candidate was simulated
    await waitFor(() => expect(scenario.quoteFetches).toBeGreaterThan(0))
    expect(estimatesFor(ZAP_DATA)).toHaveLength(0)
    expect(estimatesFor(ENSO_DATA)).toHaveLength(0)
  })
})
