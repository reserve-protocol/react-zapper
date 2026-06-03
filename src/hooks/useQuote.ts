import { useAtomValue } from 'jotai'
import { zapQuoteStateAtom } from '../components/zap-mint/atom'
import type { Token } from '../types'
import type { ZapResult } from '../types/api'
import type { ProviderId } from '../utils/providers'

export interface QuoteInput {
  /** The token being spent (the DTF when selling, the chosen token when buying). */
  token: Token
  /** Human-readable input amount as typed by the user. */
  amount: string
  /** USD value of the input amount. */
  value: number
}

export interface QuoteData {
  input: QuoteInput
  /** Winning provider quote result. `undefined` until a quote resolves. */
  quote: ZapResult | undefined
  /** Winning provider id (e.g. `zap`, `odos`). `undefined` until a quote resolves. */
  source: ProviderId | undefined
}

export interface UseQuoteResult {
  /**
   * Quote data for the active Buy/Sell flow. `input` is available as soon as
   * the user types; `quote`/`source` populate once a quote resolves.
   * `undefined` when no flow is active.
   */
  data: QuoteData | undefined
  loading: boolean
  error: string | undefined
}

/**
 * Exposes the live quote state of the currently rendered Zapper so consumers
 * can build their own UI around it (e.g. a status banner or analytics).
 *
 * Returns `{ data, loading, error }` for the active Buy/Sell flow:
 * - `data.input` — `{ token, amount, value }` for what the user is spending
 * - `data.quote` — the winning provider quote result, once it resolves
 * - `data.source` — the winning provider id, once it resolves
 * - `loading` — true while a quote is being fetched or refetched
 * - `error` — the quote error message, if any
 *
 * Must be called within the same app as a rendered `<Zapper />` (it reads the
 * package's internal state); no extra providers are required.
 */
export function useQuote(): UseQuoteResult {
  return useAtomValue(zapQuoteStateAtom)
}

export default useQuote
