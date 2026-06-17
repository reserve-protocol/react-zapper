import { Trans } from '@lingui/react/macro'
import Decimal from 'decimal.js-light'
import { useAtomValue } from 'jotai'
import { formatUnits } from 'viem'
import { indexDTFAtom } from '../../state/atoms'
import { ZapResult } from '../../types/api'
import {
  formatCurrency,
  formatPercentage,
  formatTokenAmount,
} from '../../utils'
import { PROVIDERS, type ProviderId } from '../../utils/providers'
import Help from '../ui/help'
import { SwapDetails } from '../ui/swap'
import { selectedTokenOrDefaultAtom } from './atom'

export const ZapPriceImpact = ({
  data,
  isDetail = false,
  priceImpact: priceImpactOverride,
}: {
  data?: ZapResult
  isDetail?: boolean
  priceImpact?: number
}) => {
  const priceImpact = priceImpactOverride ?? data?.truePriceImpact ?? 0
  const priceImpactColor =
    priceImpact > 10
      ? 'text-red-500'
      : priceImpact > 5
      ? 'text-yellow-500'
      : priceImpact < 0
      ? 'text-green-500'
      : isDetail
      ? ''
      : 'text-muted-foreground'
  return (
    <span className={priceImpactColor}>
      {isDetail ? '' : '('}
      {priceImpact > 0 ? (isDetail ? '' : '-') : '+'}
      {formatPercentage(Math.abs(priceImpact))}
      {!isDetail && priceImpact < 0 ? ' 😎' : ''}
      {isDetail ? '' : ')'}
    </span>
  )
}

const ZapDetails = ({
  data,
  source,
}: {
  data: ZapResult
  source?: ProviderId
}) => {
  const indexDTF = useAtomValue(indexDTFAtom)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const dtfAsTokenIn =
    data.tokenIn.toLowerCase() !== selectedToken.address.toLowerCase() &&
    data.tokenIn !== '0x4200000000000000000000000000000000000006' &&
    data.tokenIn !== '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

  const tokenInSymbol = dtfAsTokenIn
    ? indexDTF?.token.symbol || ''
    : selectedToken.symbol
  const tokenOutSymbol = dtfAsTokenIn
    ? selectedToken.symbol
    : indexDTF?.token.symbol || ''

  const amountIn = new Decimal(
    formatUnits(
      BigInt(data.amountIn || 0),
      dtfAsTokenIn ? 18 : selectedToken.decimals
    )
  )
  const amountOut = new Decimal(
    formatUnits(
      BigInt(data.amountOut || 0),
      dtfAsTokenIn ? selectedToken.decimals : 18
    )
  )

  const minAmountOut = data.minAmountOut
    ? formatUnits(
        BigInt(data.minAmountOut),
        dtfAsTokenIn ? selectedToken.decimals : 18
      )
    : undefined

  // const amountInValue = new Decimal(data.amountInValue || 0)
  const ratio = amountIn.eq(0) ? undefined : amountOut.div(amountIn)

  const ratioText = `1 ${tokenInSymbol} = ${formatCurrency(
    ratio?.toNumber() || 0
  )} ${tokenOutSymbol}`
  // const mintFeeValue = amountInValue.mul(indexDTF?.mintingFee || 0).toNumber()

  if (!indexDTF) return null

  return (
    <SwapDetails
      visible={{
        left: (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">
              <Trans>Quote includes fees</Trans>
            </span>
            <Help
              content={
                <Trans>
                  The displayed quote already includes all applicable fees and
                  price impact.
                </Trans>
              }
            />
          </div>
        ),
        right: source
          ? (() => {
              const provider = PROVIDERS[source]
              if (!provider) return undefined
              const { Icon, label } = provider
              return (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">
                    <Trans>Via</Trans>
                  </span>
                  <Icon size={14} />
                  <span>{label}</span>
                </div>
              )
            })()
          : undefined,
      }}
      details={[
        {
          left: (
            <span className="text-muted-foreground">
              <Trans>Exchange Rate</Trans>
            </span>
          ),
          right: <span>{ratioText}</span>,
          help: <Trans>The current exchange rate between the tokens.</Trans>,
        },
        // ...(!dtfAsTokenIn
        //   ? [
        //       {
        //         left: <span className="text-muted-foreground">Mint Fee</span>,
        //         right: (
        //           <span>
        //             ${formatCurrency(mintFeeValue)}{' '}
        //             <span className="text-muted-foreground">
        //               ({formatPercentage((indexDTF.mintingFee || 0) * 100)})
        //             </span>
        //           </span>
        //         ),
        //         help: 'A one-time fee deduction from the tokens you are using to create a share of the DTF. This fee is set by the Governors of the DTF.',
        //       },
        //     ]
        //   : []),
        {
          left: (
            <span className="text-muted-foreground">
              <Trans>Price Impact</Trans>
            </span>
          ),
          right: <ZapPriceImpact data={data} isDetail />,
          help: <Trans>The impact your trade has on the market price.</Trans>,
        },
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
                help: <Trans>The minimum amount of tokens you will receive.</Trans>,
              },
            ]
          : []),
      ]}
    />
  )
}

export default ZapDetails
