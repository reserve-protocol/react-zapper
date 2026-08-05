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
import {
  formatCurrency,
  formatSignedPercentage,
  formatTokenAmount,
} from '../../utils/format'
import { PROVIDERS, type ProviderId } from '../../utils/providers'
import { Badge } from '../ui/badge'
import { Skeleton } from '../ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { tokenOutAtom, zapOngoingTxAtom } from './atom'

const COUNTDOWN_WARNING_SECONDS = 5

/**
 * Drives the shared quote-list clock. Paused during an ongoing tx: a frozen
 * clock freezes every row's expired/fresh classification, so the active quote
 * can never swap out from under a wallet prompt.
 */
const useQuoteListClock = (enabled: boolean) => {
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

const formatCountdown = (secondsLeft: number): string =>
  secondsLeft >= 60 ? `${Math.ceil(secondsLeft / 60)}m` : `${secondsLeft}s`

const QuoteRowContent = ({
  row,
  isBest,
  isActive,
  now,
  bestAmountOut,
  tokenOutDecimals,
}: {
  row: QuoteRow
  isBest: boolean
  isActive: boolean
  now: number
  bestAmountOut: number | null
  tokenOutDecimals: number
}) => {
  const { Icon, label } = PROVIDERS[row.source]
  const result = row.quote?.result

  if (!result) {
    return (
      <>
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={16} className="shrink-0" />
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-sm font-medium leading-tight">{label}</span>
            <Skeleton className="h-3 w-10" />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-1 h-3 w-14" />
        </div>
      </>
    )
  }

  const expired = isExpired(row, now)
  const validUntil = result.validUntil
  const secondsLeft =
    validUntil != null && now > 0
      ? Math.max(0, Math.ceil((validUntil - now) / 1000))
      : null
  const amountOut = Number(
    formatUnits(BigInt(result.amountOut || 0), tokenOutDecimals)
  )
  const delta =
    !isBest && bestAmountOut != null && bestAmountOut > 0
      ? amountOut / bestAmountOut - 1
      : null
  const countdown = secondsLeft != null ? formatCountdown(secondsLeft) : null

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Icon size={16} className="shrink-0" />
        <div className="flex min-w-0 flex-col items-start">
          <span className="text-sm font-medium leading-tight">{label}</span>
          <span
            className={cn(
              'min-w-8 text-left text-[11px] leading-tight tabular-nums text-muted-foreground',
              isActive &&
                !expired &&
                secondsLeft != null &&
                secondsLeft <= COUNTDOWN_WARNING_SECONDS &&
                'text-warning'
            )}
          >
            {expired ? (
              <Trans>Expired</Trans>
            ) : countdown != null ? (
              <Trans>Expires in {countdown}</Trans>
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isBest && (
          <Badge className="border-transparent bg-success/10 px-1.5 py-0 text-[10px] text-success">
            <Trans>Best</Trans>
          </Badge>
        )}
        <div className="flex flex-col items-end">
          <span
            key={validUntil ?? undefined}
            className="max-w-[140px] animate-fade-in truncate text-sm font-semibold tabular-nums"
          >
            {formatTokenAmount(amountOut)}
          </span>
          <span className="text-[11px] leading-tight tabular-nums text-muted-foreground">
            {result.amountOutValue != null
              ? `$${formatCurrency(result.amountOutValue)}`
              : null}
            {delta != null && delta < -0.0005 && (
              <span className="text-red-500"> {formatSignedPercentage(delta)}</span>
            )}
          </span>
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

  useQuoteListClock(order.length > 0 && !ongoingTx)

  if (!order.length) return null

  // Failed/reverted routes are hidden — they're noise, not options. Skeleton
  // rows only show before the first round of a key settles (`bestSource` is
  // null until then); afterwards a failing provider simply drops out and
  // reappears when it produces a quote again.
  const initialLoad = bestSource === null
  const visibleIds = displayOrder.filter((id) => {
    const row = rows[id]
    if (!row || !PROVIDERS[id]) return false
    if (row.status === 'error' || row.status === 'reverted') return false
    if (row.quote) return true
    return initialLoad
  })

  if (!visibleIds.length) return null

  const tokenOutDecimals = tokenOut?.decimals ?? 18
  const bestRow = bestSource ? rows[bestSource] : undefined
  const bestAmountOut = bestRow?.quote?.result?.amountOut
    ? Number(
        formatUnits(BigInt(bestRow.quote.result.amountOut), tokenOutDecimals)
      )
    : null

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
                isActive={active?.source === id}
                now={now}
                bestAmountOut={bestAmountOut}
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
