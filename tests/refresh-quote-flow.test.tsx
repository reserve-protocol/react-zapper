import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { zapOngoingTxAtom } from '../src/components/zap-mint/atom'
import {
  getCta,
  harnessAfterEach,
  harnessBeforeEach,
  scenario,
  setup,
  waitForReadyCta,
} from './helpers/harness'

const refreshButton = () =>
  screen.getByRole('button', { name: 'Refresh quote' }) as HTMLButtonElement

describe('swap refresh control', () => {
  beforeEach(harnessBeforeEach)
  afterEach(harnessAfterEach)

  it.each(['inline', 'modal'] as const)(
    'refreshes a real quote in non-debug %s mode without changing the input',
    async (contentMode) => {
      await setup({ contentMode, refreshRate: 60_000 })
      await waitForReadyCta()
      await waitFor(() => expect(refreshButton().disabled).toBe(false))
      const fetches = scenario.quoteFetches
      fireEvent.click(refreshButton())
      fireEvent.click(refreshButton())
      await waitFor(() => expect(scenario.quoteFetches).toBe(fetches + 1))
      expect(refreshButton().disabled).toBe(true)
      expect(document.querySelector('input')?.value).toBe('1')
    }
  )

  it.each(['', '1'])(
    'blocks refresh during the input debounce from %j',
    async (inputAmount) => {
      await setup({ contentMode: 'inline', inputAmount, refreshRate: 60_000 })
      if (inputAmount) {
        await waitForReadyCta()
        await waitFor(() => expect(refreshButton().disabled).toBe(false))
      }
      const fetches = scenario.quoteFetches
      fireEvent.change(document.querySelector('input')!, {
        target: { value: '2' },
      })
      expect(refreshButton().disabled).toBe(true)
      fireEvent.click(refreshButton())
      expect(scenario.quoteFetches).toBe(fetches)
      expect(refreshButton().textContent).toBe('Refresh quote')
      await waitFor(() => expect(scenario.quoteFetches).toBe(fetches + 1))
      await waitFor(() => expect(refreshButton().disabled).toBe(false))
    }
  )

  it('blocks background refreshes without disabling the existing swap CTA', async () => {
    await setup({ contentMode: 'inline', refreshRate: 1_000 })
    await waitForReadyCta()
    scenario.quoteDelayMs = 2_000
    await waitFor(() =>
      expect(refreshButton().getAttribute('aria-busy')).toBe('true')
    )
    expect(refreshButton().disabled).toBe(true)
    expect(getCta().disabled).toBe(false)
    const fetches = scenario.quoteFetches
    fireEvent.click(refreshButton())
    expect(scenario.quoteFetches).toBe(fetches)
  })

  it('blocks refresh with no amount or during a transaction', async () => {
    const { store } = await setup({ contentMode: 'inline', inputAmount: '' })
    expect(refreshButton().disabled).toBe(true)
    fireEvent.change(document.querySelector('input')!, {
      target: { value: '1' },
    })
    await waitForReadyCta()
    await waitFor(() => expect(refreshButton().disabled).toBe(false))
    act(() => store.set(zapOngoingTxAtom, true))
    expect(refreshButton().disabled).toBe(true)
    const fetches = scenario.quoteFetches
    fireEvent.click(refreshButton())
    expect(scenario.quoteFetches).toBe(fetches)
  })
})
