import { atom } from 'jotai'
import {
  compareQuotes,
  type ProviderQuote,
} from '../hooks/zap-quote-providers'
import type { ProviderId } from '../utils/providers'

export type QuoteRowStatus = 'loading' | 'success' | 'error' | 'reverted'

export type QuoteRow = {
  source: ProviderId
  /** Latest-attempt status. `loading` with a non-null `quote` means the row is
   * showing its previous quote while a refresh is in flight. */
  status: QuoteRowStatus
  /** Last good quote for this provider. Survives refreshes (stale-while-
   * revalidate) until replaced; cleared on error and on input change. */
  quote: ProviderQuote | null
  error: string | null
  fetchedAt: number | null
}

export type QuoteListState = {
  /** Debounced swap cache key this list belongs to; rows hard-reset (and the
   * pick clears) when it changes. */
  key: string | null
  /** Monotonic round counter — one round per queryFn invocation. Events
   * stamped with an older round are dropped: react-query never cancels an
   * abandoned queryFn, so a stale round can still be streaming. */
  round: number
  roundInFlight: boolean
  rows: Partial<Record<ProviderId, QuoteRow>>
  /** Render order. Only recomputed when a round completes so streaming
   * arrivals never reshuffle rows mid-cycle. */
  order: ProviderId[]
  /** Winner of the last completed round — always agrees with the
   * `Quote Source Winner` mixpanel event. */
  bestSource: ProviderId | null
}

const INITIAL_LIST_STATE: QuoteListState = {
  key: null,
  round: 0,
  roundInFlight: false,
  rows: {},
  order: [],
  bestSource: null,
}

export const quoteListAtom = atom<QuoteListState>(INITIAL_LIST_STATE)

/** The user's sticky source pick. `null` = auto (follow the best quote). */
export const pickedSourceAtom = atom<ProviderId | null>(null)

/**
 * Shared clock (epoch ms) driving every row countdown and the expiry fallback
 * in `activeQuoteAtom`. Ticked by the quote list while mounted, and paused
 * during an ongoing tx: freezing the clock freezes each quote's
 * expired/fresh classification, so the active quote can never swap out from
 * under a wallet prompt. While 0 (list unmounted), expiry never triggers a
 * fallback — the submit button's own `validUntil` guard remains the safety.
 */
export const quoteListNowAtom = atom<number>(0)

/**
 * Starts a comparison round: rows for this round's candidates go to
 * `loading`, keeping their previous quote visible (stale-while-revalidate).
 * On a key change rows reset to skeletons and the pick clears — except on the
 * very first key (`prev.key === null`), which must not wipe the
 * `defaultSource` seeding. Returns the round number to stamp events with.
 */
export const beginQuoteRoundAtom = atom(
  null,
  (
    get,
    set,
    { key, sources }: { key: string; sources: ProviderId[] }
  ): number => {
    const prev = get(quoteListAtom)
    const keyChanged = prev.key !== null && prev.key !== key
    if (keyChanged) set(pickedSourceAtom, null)

    const rows: QuoteListState['rows'] = {}
    for (const source of sources) {
      const old = keyChanged ? undefined : prev.rows[source]
      rows[source] = {
        source,
        status: 'loading',
        quote: old?.quote ?? null,
        error: null,
        fetchedAt: old?.fetchedAt ?? null,
      }
    }

    const orderStillValid =
      !keyChanged &&
      prev.order.length === sources.length &&
      prev.order.every((id) => id in rows)

    const round = prev.round + 1
    set(quoteListAtom, {
      key,
      round,
      roundInFlight: true,
      rows,
      order: orderStillValid ? prev.order : [...sources],
      bestSource: keyChanged ? null : prev.bestSource,
    })
    return round
  }
)

/** Per-provider settle. On error the quote is cleared — a failed provider is
 * never executable, which is what makes the picked→best fallback work. */
export const providerQuoteUpdateAtom = atom(
  null,
  (
    get,
    set,
    update: {
      round: number
      source: ProviderId
      quote?: ProviderQuote
      error?: unknown
    }
  ) => {
    const state = get(quoteListAtom)
    if (update.round !== state.round) return
    const row = state.rows[update.source]
    if (!row) return

    const next: QuoteRow = update.quote
      ? {
          ...row,
          status: 'success',
          quote: update.quote,
          error: null,
          fetchedAt: Date.now(),
        }
      : {
          ...row,
          status: 'error',
          quote: null,
          error:
            update.error instanceof Error
              ? update.error.message
              : String(update.error ?? 'Unknown error'),
        }

    set(quoteListAtom, {
      ...state,
      rows: { ...state.rows, [update.source]: next },
    })
  }
)

/** Round completion: marks simulation-reverted rows, records the winner and
 * recomputes the render order — the only place rows ever reorder. */
export const completeQuoteRoundAtom = atom(
  null,
  (
    get,
    set,
    update: {
      round: number
      best: ProviderId | null
      reverted: ProviderId[]
      failed: ProviderId[]
    }
  ) => {
    const state = get(quoteListAtom)
    if (update.round !== state.round || state.key === null) return

    const rows = { ...state.rows }
    for (const source of update.reverted) {
      const row = rows[source]
      if (row?.quote) rows[source] = { ...row, status: 'reverted' }
    }

    // Successes by quote quality, then reverted, then failures; sort is
    // stable so equal ranks keep their previous relative order.
    const rank = (id: ProviderId) => {
      const status = rows[id]?.status
      return status === 'success' ? 0 : status === 'reverted' ? 1 : 2
    }
    const order = [...state.order].sort((a, b) => {
      const rankA = rank(a)
      const rankB = rank(b)
      if (rankA !== rankB) return rankA - rankB
      if (rankA === 0) return compareQuotes(rows[a]!.quote!, rows[b]!.quote!)
      return 0
    })

    set(quoteListAtom, {
      ...state,
      roundInFlight: false,
      rows,
      order,
      bestSource: update.best ?? state.bestSource,
    })
  }
)

/** Full reset (flow unmount, tab swap, input cleared). The round counter is
 * preserved so events from a still-streaming pre-reset round stay stale. */
export const resetQuoteListAtom = atom(null, (get, set) => {
  set(quoteListAtom, {
    ...INITIAL_LIST_STATE,
    round: get(quoteListAtom).round,
  })
  set(pickedSourceAtom, null)
})

const hasQuote = (
  row: QuoteRow | undefined
): row is QuoteRow & { quote: ProviderQuote } =>
  !!row?.quote && (row.status === 'success' || row.status === 'loading')

/**
 * The quote the widget renders and submits: the user's pick while it is
 * usable, otherwise the best, otherwise the highest usable quote. Expired
 * quotes (per the shared clock) are skipped — unless nothing unexpired
 * remains, where the same priority runs ignoring expiry so the CTA doesn't
 * tear down (the submit-time `validUntil` guard still blocks execution).
 * Always returns the stored `ProviderQuote` reference so clock ticks that
 * don't change the outcome don't re-render consumers.
 */
export const activeQuoteAtom = atom<ProviderQuote | null>((get) => {
  const { rows, bestSource } = get(quoteListAtom)
  const picked = get(pickedSourceAtom)
  const now = get(quoteListNowAtom)

  const pickBy = (
    usable: (row: QuoteRow | undefined) => row is QuoteRow & {
      quote: ProviderQuote
    }
  ): ProviderQuote | null => {
    if (picked && usable(rows[picked])) return rows[picked]!.quote
    if (bestSource && usable(rows[bestSource])) return rows[bestSource]!.quote
    const candidates = Object.values(rows).filter(usable)
    if (!candidates.length) return null
    return candidates.map((row) => row.quote).sort(compareQuotes)[0]
  }

  const fresh = (
    row: QuoteRow | undefined
  ): row is QuoteRow & { quote: ProviderQuote } =>
    hasQuote(row) &&
    (row.quote.result?.validUntil == null ||
      now < row.quote.result.validUntil)

  return pickBy(fresh) ?? pickBy(hasQuote)
})

/** Winner of the last completed round, as a primitive for cheap subscription. */
export const bestSourceAtom = atom((get) => get(quoteListAtom).bestSource)

/**
 * Earliest expiry among selectable quotes. Drives the expiry-triggered
 * refetch: the API may cache a provider's quote until its `validUntil`
 * (e.g. enso), so waiting for the global refresh tick would leave a dead
 * quote on screen — instead the whole round refetches right after the
 * earliest quote expires.
 */
export const earliestValidUntilAtom = atom<number | null>((get) => {
  const { rows } = get(quoteListAtom)
  let min: number | null = null
  for (const row of Object.values(rows)) {
    if (!hasQuote(row)) continue
    const validUntil = row.quote.result?.validUntil
    if (validUntil != null && (min === null || validUntil < min)) {
      min = validUntil
    }
  }
  return min
})

/** True when the active quote is the user's explicit pick (not auto-best). */
export const activeIsPickedAtom = atom((get) => {
  const picked = get(pickedSourceAtom)
  if (picked == null) return false
  return get(activeQuoteAtom)?.source === picked
})
