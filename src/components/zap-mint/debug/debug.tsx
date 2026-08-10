import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { Anvil, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Debug as DebugData } from '@/types'
import { deepLiquidityAtom } from '../../../state/atoms'
import { Checkbox } from '../../ui/checkbox'
import { disabledSettingsAtom, forceMintAtom } from '../atom'
import { PriceImpact } from './price-impact'

type Props = {
  data?: DebugData
}

// Debug-only panel: per-hop price impact plus the power-user toggles that
// used to live in the (removed) settings page.
export function Debug({ data }: Props) {
  const [forceMint, setForceMint] = useAtom(forceMintAtom)
  const [deepLiquidity, setDeepLiquidity] = useAtom(deepLiquidityAtom)
  const disabledSettings = useAtomValue(disabledSettingsAtom)

  return (
    <Card className="w-full gap-2">
      <CardHeader className="px-4">
        <CardTitle className="text-base">Debug</CardTitle>
      </CardHeader>
      <CardContent className="px-4 space-y-2">
        {!disabledSettings?.deepLiquidity && (
          <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Search size={16} className="text-muted-foreground" />
              <Trans>Deep liquidity search</Trans>
            </div>
            <Checkbox
              checked={deepLiquidity}
              onCheckedChange={(checked) => setDeepLiquidity(checked === true)}
            />
          </label>
        )}
        {!disabledSettings?.forceMint && (
          <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-1">
              <Anvil size={16} className="text-muted-foreground" />
              <Trans>Force minting DTF</Trans>
            </div>
            <Checkbox
              checked={forceMint}
              onCheckedChange={(checked) => setForceMint(checked === true)}
            />
          </label>
        )}
        {data && <PriceImpact data={data.priceImpactStats.slice(0, 5)} />}
      </CardContent>
    </Card>
  )
}
