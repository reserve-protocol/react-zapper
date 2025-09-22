import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { chainIdAtom } from '@/state/atoms'
import type { Debug } from '@/types'
import {
  formatCurrency,
  formatShortAddress,
  formatSignedPercentage,
} from '@/utils'
import { dexscreenerUrl, explorerUrl } from '@/utils/urls'
import { useAtomValue } from 'jotai'
import { ArrowDown, ArrowUp } from 'lucide-react'

interface Props {
  data: Debug['priceImpactStats']
}

export function PriceImpact({ data }: Props) {
  const chainId = useAtomValue(chainIdAtom)
  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600 dark:text-green-400'
    if (impact < -0.05) return 'text-red-600 dark:text-red-400'
    return 'text-yellow-600 dark:text-yellow-400'
  }

  return (
    <>
      <div className="mb-2 text-base">Price Impact</div>
      {data.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No data available
        </div>
      )}

      {data.map((stat, index) => (
        <Card key={index} className="p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs max-w-64 overflow-hidden text-ellipsis whitespace-nowrap">
                {stat.action}
              </div>
              <div className="font-mono text-xs bg-muted px-2 py-1 rounded">
                <a
                  href={dexscreenerUrl(chainId, stat.address[0])}
                  className="hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatShortAddress(stat.address[0])}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <Badge variant="outline" className="text-xs">
                <a
                  href={explorerUrl(chainId, stat.inputToken[0])}
                  className="hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatShortAddress(stat.inputToken[0])}
                </a>
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="outline" className="text-xs">
                <a
                  href={explorerUrl(chainId, stat.outputToken[0])}
                  className="hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {formatShortAddress(stat.outputToken[0])}
                </a>
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">
                  In:{' '}
                  <span className="font-mono">
                    ${formatCurrency(stat.input)}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Out:{' '}
                  <span className="font-mono">
                    ${formatCurrency(stat.output)}
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-1 ${getImpactColor(
                  stat.impact
                )}`}
              >
                {stat.impact > 0 ? (
                  <ArrowUp className="h-4 w-4 mb-1" />
                ) : (
                  <ArrowDown className="h-4 w-4 mb-1" />
                )}
                <span className="font-mono font-medium text-base leading-none">
                  {formatSignedPercentage(stat.impact)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </>
  )
}
