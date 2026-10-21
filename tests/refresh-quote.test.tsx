import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RefreshQuote from '../src/components/zap-mint/refresh-quote'
import { ZapperI18nProvider } from '../src/i18n/provider'

const renderRefresh = (props: React.ComponentProps<typeof RefreshQuote>) =>
  render(
    <ZapperI18nProvider>
      <RefreshQuote {...props} />
    </ZapperI18nProvider>
  )

const refreshButton = () => screen.getByRole('button') as HTMLButtonElement

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('manual quote refresh', () => {
  it('allows one refresh per five seconds, including same-tick clicks', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    renderRefresh({ onClick })

    act(() => {
      fireEvent.click(refreshButton())
      fireEvent.click(refreshButton())
      fireEvent.click(refreshButton())
    })
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(refreshButton().disabled).toBe(true)
    expect(refreshButton().textContent).toContain('Refresh in 5s')

    act(() => vi.advanceTimersByTime(4_999))
    fireEvent.click(refreshButton())
    expect(onClick).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(1))
    expect(refreshButton().disabled).toBe(false)
    fireEvent.click(refreshButton())
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it.each([{ loading: true }, { disabled: true }])(
    'blocks refresh while %o',
    (props) => {
      const onClick = vi.fn()
      renderRefresh({ onClick, ...props })
      expect(refreshButton().disabled).toBe(true)
      fireEvent.click(refreshButton())
      expect(onClick).not.toHaveBeenCalled()
    }
  )

  it('stays disabled after the cooldown until loading finishes and clears its timer', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    const view = renderRefresh({ onClick })
    fireEvent.click(refreshButton())
    view.rerender(
      <ZapperI18nProvider>
        <RefreshQuote onClick={onClick} loading />
      </ZapperI18nProvider>
    )
    act(() => vi.advanceTimersByTime(5_000))
    expect(refreshButton().disabled).toBe(true)
    view.rerender(
      <ZapperI18nProvider>
        <RefreshQuote onClick={onClick} />
      </ZapperI18nProvider>
    )
    expect(refreshButton().disabled).toBe(false)
    fireEvent.click(refreshButton())
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
