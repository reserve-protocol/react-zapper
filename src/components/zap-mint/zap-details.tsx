import { Trans } from '@lingui/react/macro'
import Decimal from 'decimal.js-light'
import { useAtomValue } from 'jotai'
import { useRef } from 'react'
import { formatUnits } from 'viem'
import { indexDTFAtom } from '../../state/atoms'
import { ZapResult } from '../../types/api'
import {
  formatCurrency,
  formatPercentage,
  formatTokenAmount,
} from '../../utils'
import { computeMaxSlippage } from '../../utils/slippage'
import { quoteListAtom } from '../../state/quote-list-atoms'
import Collapse from '../ui/collapse'
import { SwapDetails } from '../ui/swap'
import QuoteList, { useQuoteListClock } from './quote-list'
import { selectedTokenOrDefaultAtom, zapOngoingTxAtom } from './atom'

// Slippage percentage with its dollar equivalent, e.g. "0.32% ($1.24)" —
// a positive value is a loss (plain), a negative one a surplus ("+").
const SlippageValue = ({
  value,
  usd,
  className,
}: {
  value: number
  usd: number | null
  className?: string
}) => (
  <span className={className}>
    {value > 0 ? '' : '+'}
    {formatPercentage(Math.abs(value))}
    {usd != null && (
      <span className="text-muted-foreground">
        {' '}
        (${formatCurrency(Math.abs(usd))})
      </span>
    )}
  </span>
)

// The stat formerly labeled "Price Impact", renamed: it is the projected
// (dust-adjusted) difference between what the trade pays and what it returns,
// valued at current prices.
const ZapProjectedSlippage = ({
  value,
  usd,
}: {
  value: number
  usd: number | null
}) => {
  const color =
    value > 10
      ? 'text-red-500'
      : value > 5
        ? 'text-yellow-500'
        : value < 0
          ? 'text-green-500'
          : ''
  return <SlippageValue value={value} usd={usd} className={color} />
}

const ZapDetails = ({ data }: { data?: ZapResult }) => {
  const indexDTF = useAtomValue(indexDTFAtom)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const { order } = useAtomValue(quoteListAtom)
  const ongoingTx = useAtomValue(zapOngoingTxAtom)

  // The clock lives here (not in QuoteList): the list unmounts while the
  // accordion is collapsed, but quote expiry must keep being tracked.
  useQuoteListClock(order.length > 0 && !ongoingTx)

  // The section slides open when the first quote lands and slides closed when
  // the quote goes away (input cleared) — the last result stays rendered so
  // the exit animation has content to collapse.
  const lastResultRef = useRef<ZapResult | undefined>(undefined)
  if (data) lastResultRef.current = data
  const result = data ?? lastResultRef.current

  if (!indexDTF || !result) return null

  const dtfAsTokenIn =
    result.tokenIn.toLowerCase() !== selectedToken.address.toLowerCase() &&
    result.tokenIn !== '0x4200000000000000000000000000000000000006' &&
    result.tokenIn !== '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

  const tokenInSymbol = dtfAsTokenIn
    ? indexDTF?.token.symbol || ''
    : selectedToken.symbol
  const tokenOutSymbol = dtfAsTokenIn
    ? selectedToken.symbol
    : indexDTF?.token.symbol || ''

  const amountIn = new Decimal(
    formatUnits(
      BigInt(result.amountIn || 0),
      dtfAsTokenIn ? 18 : selectedToken.decimals
    )
  )
  const amountOut = new Decimal(
    formatUnits(
      BigInt(result.amountOut || 0),
      dtfAsTokenIn ? selectedToken.decimals : 18
    )
  )

  const minAmountOut = result.minAmountOut
    ? formatUnits(
        BigInt(result.minAmountOut),
        dtfAsTokenIn ? selectedToken.decimals : 18
      )
    : undefined

  const ratio = amountIn.eq(0) ? undefined : amountOut.div(amountIn)

  const ratioText = `1 ${tokenInSymbol} = ${formatCurrency(
    ratio?.toNumber() || 0
  )} ${tokenOutSymbol}`

  const maxSlippage = computeMaxSlippage(result)

  // Dollar equivalents on the same basis the percentages are computed from
  // (the Reserve-priced input value); omitted when that value is unavailable.
  const amountInValue = result.amountInValue ?? null
  const projectedSlippage = result.truePriceImpact ?? 0
  const projectedSlippageUsd =
    amountInValue != null ? (amountInValue * projectedSlippage) / 100 : null
  const maxSlippageUsd =
    amountInValue != null && maxSlippage != null
      ? (amountInValue * maxSlippage) / 100
      : null

  return (
    // Open: -mt-1 tightens the gap to the slippage row above (4px instead of
    // the parent's gap-2). Closed: -mt-2 cancels the flex gap entirely so the
    // hidden section takes no space at all.
    <Collapse open={!!data} className={data ? '-mt-1' : '-mt-2'}>
      <SwapDetails
        visible={{
          left: (
            <span className="text-muted-foreground">
              <Trans>Details</Trans>
            </span>
          ),
        }}
        details={[
          {
            left: (
              <span className="text-muted-foreground">
                <Trans>Current price</Trans>
              </span>
            ),
            right: <span>{ratioText}</span>,
            help: <Trans>The current exchange rate between the tokens.</Trans>,
          },
          {
            left: (
              <span className="text-muted-foreground">
                <Trans>Projected slippage</Trans>
              </span>
            ),
            right: (
              <ZapProjectedSlippage
                value={projectedSlippage}
                usd={projectedSlippageUsd}
              />
            ),
            help: (
              <Trans>
                Projected difference (%) between the value you pay and the value
                you receive, at current prices.
              </Trans>
            ),
          },
          ...(maxSlippage != null
            ? [
                {
                  left: (
                    <span className="text-muted-foreground">
                      <Trans>Max slippage</Trans>
                    </span>
                  ),
                  right: (
                    <SlippageValue value={maxSlippage} usd={maxSlippageUsd} />
                  ),
                  help: (
                    <Trans>
                      Worst case: the value difference (%) if the trade executes
                      at the minimum amount out allowed by your slippage
                      tolerance.
                    </Trans>
                  ),
                },
              ]
            : []),
          ...(minAmountOut
            ? [
                {
                  left: (
                    <span className="text-muted-foreground">
                      <Trans>Min Amount Out</Trans>
                    </span>
                  ),
                  right: (
                    <span>
                      {formatTokenAmount(Number(minAmountOut))} {tokenOutSymbol}
                    </span>
                  ),
                  help: (
                    <Trans>
                      The minimum amount of tokens you will receive.
                    </Trans>
                  ),
                },
              ]
            : []),
          {
            left: (
              <span className="text-muted-foreground">
                <Trans>Quote includes fees</Trans>
              </span>
            ),
            help: (
              <Trans>
                The displayed quote already includes all applicable fees.
              </Trans>
            ),
          },
        ]}
      >
        <QuoteList />
      </SwapDetails>
    </Collapse>
  )
}

export default ZapDetails
