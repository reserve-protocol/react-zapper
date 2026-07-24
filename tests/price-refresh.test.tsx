/**
 * The USD values and the price impact shown for a mint/redeem are derived from
 * the Reserve prices of both legs, so those prices must refresh on the same
 * cadence as the quote — a frozen DTF price silently skews the redeem input
 * value and the impact of every refreshed quote.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import { createStore, Provider as JotaiProvider } from 'jotai'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useIndexBasket } from '../src/hooks/use-index-basket'
import { usePrice } from '../src/hooks/usePrice'
import { apiUrlAtom, refreshRateAtom } from '../src/state/atoms'

const API = 'https://api.test/'
const DTF = '0x1000000000000000000000000000000000000001'
const TOKEN = '0x2000000000000000000000000000000000000002'
const REFRESH_RATE = 4_000

const countCalls = (fetchMock: ReturnType<typeof vi.fn>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes(path)).length

const renderWithProviders = (ui: React.ReactElement) => {
  const store = createStore()
  store.set(apiUrlAtom, API)
  store.set(refreshRateAtom, REFRESH_RATE)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>{ui}</JotaiProvider>
    </QueryClientProvider>
  )
}

const DtfPrice = () => {
  const { data } = useIndexBasket(DTF, 1)
  return <div>{data.price}</div>
}

const TokenPrice = () => {
  const price = usePrice(1, TOKEN)
  return <div>{price}</div>
}

describe('price refresh cadence', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const body = String(url).includes('current/dtf')
        ? { price: 1.23, basket: [] }
        : [{ price: 4.56 }]
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('refetches the DTF price on the quote refresh rate', async () => {
    renderWithProviders(<DtfPrice />)

    await waitFor(() => expect(countCalls(fetchMock, 'current/dtf')).toBe(1))

    await vi.advanceTimersByTimeAsync(REFRESH_RATE)
    await waitFor(() => expect(countCalls(fetchMock, 'current/dtf')).toBe(2))

    await vi.advanceTimersByTimeAsync(REFRESH_RATE)
    await waitFor(() => expect(countCalls(fetchMock, 'current/dtf')).toBe(3))
  })

  it('refetches the selected token price on the quote refresh rate', async () => {
    renderWithProviders(<TokenPrice />)

    await waitFor(() => expect(countCalls(fetchMock, 'current/prices')).toBe(1))

    await vi.advanceTimersByTimeAsync(REFRESH_RATE)
    await waitFor(() => expect(countCalls(fetchMock, 'current/prices')).toBe(2))
  })
})
