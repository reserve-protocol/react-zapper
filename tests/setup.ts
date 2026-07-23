import { vi } from 'vitest'

// Node's undici fetch/Request reject AbortSignals created in jsdom's realm
// ("RequestInit: Expected signal to be an instance of AbortSignal"), which
// silently fails every viem http-transport request in tests (viem passes a
// timeout signal and pre-builds a Request). Strip the foreign signal from
// both entry points — tests don't rely on request aborts.
const stripSignal = (init?: RequestInit): RequestInit | undefined => {
  if (!init?.signal) return init
  const { signal: _signal, ...rest } = init
  return rest
}
const nativeFetch = globalThis.fetch?.bind(globalThis)
if (nativeFetch) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    nativeFetch(input, stripSignal(init))) as typeof fetch
}
const NativeRequest = globalThis.Request
if (NativeRequest) {
  globalThis.Request = class Request extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, stripSignal(init))
    }
  } as typeof globalThis.Request
}

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
