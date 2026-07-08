import { vi } from 'vitest'

// mixpanel does real network I/O at init/track time — neutralize it entirely.
vi.mock('mixpanel-browser/src/loaders/loader-module-core', () => ({
  default: {
    init: () => {},
    track: () => {},
    time_event: () => {},
    register: () => {},
    unregister: () => {},
    people: { set: () => {} },
  },
}))

// jsdom is missing a few browser APIs used by radix/lucide/etc.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any
g.ResizeObserver = g.ResizeObserver ?? ResizeObserverStub
g.matchMedia =
  g.matchMedia ??
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }))
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
  Element.prototype.hasPointerCapture =
    Element.prototype.hasPointerCapture || (() => false)
  Element.prototype.releasePointerCapture =
    Element.prototype.releasePointerCapture || (() => {})
}
