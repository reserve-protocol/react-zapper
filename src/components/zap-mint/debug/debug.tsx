import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Debug } from '@/types'
import { PriceImpact } from './price-impact'

type Props = {
  data: Debug
}

export function Debug({ data }: Props) {
  return (
    <Card className="w-full gap-2">
      <CardHeader className="px-4">
        <CardTitle className="text-base">
          Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        <PriceImpact data={data.priceImpactStats.slice(0, 5)} />
      </CardContent>
    </Card>
  )
}
