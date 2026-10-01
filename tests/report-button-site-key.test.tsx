import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { createStore, Provider as JotaiProvider } from 'jotai'
import { afterEach, describe, expect, it } from 'vitest'

import ZapErrorMsg from '../src/components/zap-mint/zap-error-msg'
import { ZapperI18nProvider } from '../src/i18n/provider'
import { turnstileSiteKeyAtom } from '../src/state/atoms'

function renderError(siteKey?: string) {
  const store = createStore()
  if (siteKey) store.set(turnstileSiteKeyAtom, siteKey)
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider store={store}>
        <ZapperI18nProvider>
          <ZapErrorMsg error="failed to construct swap" />
        </ZapperI18nProvider>
      </JotaiProvider>
    </QueryClientProvider>
  )
}

describe('zap error Report button', () => {
  afterEach(cleanup)

  it('is not offered when the host passes no Turnstile site key', () => {
    renderError()

    expect(screen.queryByRole('button', { name: /report/i })).toBeNull()
  })

  it('is offered when the host passes a Turnstile site key', () => {
    renderError('0x4AAAAAAA-test-key')

    expect(screen.getByRole('button', { name: /report/i })).toBeTruthy()
  })
})
