import { Trans, useLingui } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'
import {
  activeQuoteAtom,
  pickedSourceAtom,
  quoteListAtom,
  quoteListNowAtom,
  type QuoteRow,
} from '../../state/quote-list-atoms'
import { cn } from '../../utils/cn'
import { formatCurrency, formatTokenAmount } from '../../utils/format'
import { PROVIDERS, type ProviderId } from '../../utils/providers'
import { Badge } from '../ui/badge'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { tokenOutAtom, zapOngoingTxAtom } from './atom'

/**
 * Drives the shared quote-list clock. Paused during an ongoing tx: a frozen
 * clock freezes every row's expired/fresh classification, so the active quote
 * can never swap out from under a wallet prompt. Mounted from ZapDetails —
 * the list itself unmounts while the Details accordion is collapsed, but
 * expiry classification (and the expired-pick fallback) must keep ticking.
 */
export const useQuoteListClock = (enabled: boolean) => {
  const setNow = useSetAtom(quoteListNowAtom)
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(interval)
  }, [enabled, setNow])
}

/**
 * Keeps the rendered row order frozen while the pointer or keyboard focus is
 * inside the list, so a settling refresh never reorders rows under the
 * user's cursor; the pending order applies on leave/blur.
 */
const useStableOrder = (order: ProviderId[]) => {
  const [displayOrder, setDisplayOrder] = useState(order)
  const pendingRef = useRef(order)
  const hoverRef = useRef(false)
  const focusRef = useRef(false)
  pendingRef.current = order

  useEffect(() => {
    if (!hoverRef.current && !focusRef.current) setDisplayOrder(order)
  }, [order])

  const applyPending = () => {
    if (!hoverRef.current && !focusRef.current) {
      setDisplayOrder(pendingRef.current)
    }
  }

  const freezeHandlers = {
    onPointerEnter: () => {
      hoverRef.current = true
    },
    onPointerLeave: () => {
      hoverRef.current = false
      applyPending()
    },
    onFocusCapture: () => {
      focusRef.current = true
    },
    onBlurCapture: (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      focusRef.current = false
      applyPending()
    },
  }

  return { displayOrder, freezeHandlers }
}

const isExpired = (row: QuoteRow, now: number): boolean => {
  const validUntil = row.quote?.result?.validUntil
  return validUntil != null && now > 0 && now >= validUntil
}

const isSelectable = (row: QuoteRow | undefined, now: number): boolean =>
  !!row?.quote &&
  (row.status === 'success' || row.status === 'loading') &&
  !isExpired(row, now)

const QuoteRowContent = ({
  row,
  isBest,
  tokenOutDecimals,
}: {
  row: QuoteRow
  isBest: boolean
  tokenOutDecimals: number
}) => {
  const { Icon, label } = PROVIDERS[row.source]
  const result = row.quote?.result
  if (!result) return null

  const amountOut = Number(
    formatUnits(BigInt(result.amountOut || 0), tokenOutDecimals)
  )

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={16} className="shrink-0" />
        <span className="text-sm font-medium leading-tight">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isBest && (
          <Badge className="border-transparent bg-success/10 px-1.5 py-0 text-[10px] text-success">
            <Trans>Best</Trans>
          </Badge>
        )}
        <div className="flex flex-col items-end">
          <span
            key={result.validUntil ?? undefined}
            className="max-w-[140px] animate-fade-in truncate text-sm font-semibold tabular-nums"
          >
            {formatTokenAmount(amountOut)}
          </span>
          {result.amountOutValue != null && (
            <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">
              ${formatCurrency(result.amountOutValue)}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * DefiLlama-style route list: one row per provider, streaming in as each
 * source settles, sorted best→worst once per completed round. Clicking a row
 * picks that source (sticky across refreshes; falls back to best if it fails
 * or expires — the highlight follows the ACTIVE source, so fallback and
 * recovery are reflected automatically).
 */
const QuoteList = ({ className }: { className?: string }) => {
  const { t } = useLingui()
  const { rows, order, bestSource } = useAtomValue(quoteListAtom)
  const active = useAtomValue(activeQuoteAtom)
  const setPicked = useSetAtom(pickedSourceAtom)
  const ongoingTx = useAtomValue(zapOngoingTxAtom)
  const tokenOut = useAtomValue(tokenOutAtom)
  const now = useAtomValue(quoteListNowAtom)
  const { displayOrder, freezeHandlers } = useStableOrder(order)

  if (!order.length) return null

  // Failed/reverted routes are hidden — they're noise, not options. Rows only
  // appear once their quote resolves (no loading skeletons), so the list
  // grows progressively instead of expanding and shrinking; a failing
  // provider simply drops out and reappears when it produces a quote again.
  const visibleIds = displayOrder.filter((id) => {
    const row = rows[id]
    if (!row || !PROVIDERS[id]) return false
    if (row.status === 'error' || row.status === 'reverted') return false
    return !!row.quote
  })

  if (!visibleIds.length) return null

  const tokenOutDecimals = tokenOut?.decimals ?? 18

  const handlePick = (value: string) => {
    if (!value || ongoingTx) return
    if (!isSelectable(rows[value as ProviderId], now)) return
    setPicked(value as ProviderId)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)} {...freezeHandlers}>
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          <Trans>Routes</Trans>
        </span>
        <span>{tokenOut?.symbol}</span>
      </div>
      <ToggleGroup
        type="single"
        value={active?.source ?? ''}
        onValueChange={handlePick}
        disabled={ongoingTx}
        aria-label={t`Route options`}
        className="flex flex-col items-stretch gap-1"
      >
        {visibleIds.map((id) => {
          const row = rows[id]!
          const selectable = isSelectable(row, now)
          return (
            <ToggleGroupItem
              key={id}
              value={id}
              data-testid={`quote-row-${id}`}
              aria-disabled={!selectable}
              className={cn(
                'h-auto min-h-12 w-full justify-between rounded-xl border border-border bg-card px-3 py-2 transition-colors',
                'hover:bg-muted/50 hover:text-foreground',
                'data-[state=on]:border-primary data-[state=on]:bg-primary/5 data-[state=on]:text-foreground',
                !selectable && 'cursor-default opacity-50 hover:bg-card'
              )}
            >
              <QuoteRowContent
                row={row}
                isBest={id === bestSource && !!row.quote}
                tokenOutDecimals={tokenOutDecimals}
              />
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}

export default QuoteList
