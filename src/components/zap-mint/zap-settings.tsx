import { Trans, useLingui } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { Anvil, Search } from 'lucide-react'
import { deepLiquidityAtom } from '../../state/atoms'
import { Checkbox } from '../ui/checkbox'
import Help from '../ui/help'
import { SlippageSelector } from '../ui/swap'
import { disabledSettingsAtom, forceMintAtom, slippageAtom } from './atom'

const ZapSettingsRowTitle = ({
  title,
  help,
}: {
  title: string
  help: string
}) => (
  <div className="flex items-center gap-2 justify-between px-3">
    <div className="text-sm text-muted-foreground">{title}</div>
    <Help content={help} />
  </div>
)

const ZapSettings = () => {
  const { t } = useLingui()
  const [slippage, setSlippage] = useAtom(slippageAtom)
  const [forceMint, setForceMint] = useAtom(forceMintAtom)
  const [deepLiquidity, setDeepLiquidity] = useAtom(deepLiquidityAtom)
  const disabledSettings = useAtomValue(disabledSettingsAtom)

  const handleSlippageChange = (value: string) => {
    setSlippage(value)
  }

  const handleForceMintChange = (value: boolean | 'indeterminate') => {
    const newValue = value === 'indeterminate' ? false : value
    setForceMint(newValue)
  }

  const handleDeepLiquidityChange = (value: boolean | 'indeterminate') => {
    const newValue = value === 'indeterminate' ? false : value
    setDeepLiquidity(newValue)
  }

  return (
    <div className="min-h-[306px] border-t border-border -mx-2 px-2 py-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ZapSettingsRowTitle
          title={t`Max. mint slippage`}
          help={t`The maximum amount of slippage you are willing to accept when minting. Higher slippage settings will make the transaction more likely to succeed, but may result in fewer tokens minted.`}
        />
        <SlippageSelector
          value={slippage}
          onChange={handleSlippageChange}
          options={['20', '50', '100', '200']}
          hideTitle
        />
      </div>
      {!disabledSettings?.deepLiquidity && (
        <div className="flex flex-col gap-2">
          <ZapSettingsRowTitle
            title={t`Enable Deep liquidity search?`}
            help={t`Can improve price impact but it will take more time to get quotes.`}
          />
          <div className="rounded-xl border border-border px-3 py-3 flex items-center gap-1 justify-between">
            <div className="flex items-center gap-1">
              <Search size={16} className="text-muted-foreground" />
              <div><Trans>Deep liquidity search</Trans></div>
            </div>
            <Checkbox
              checked={deepLiquidity}
              onCheckedChange={handleDeepLiquidityChange}
            />
          </div>
        </div>
      )}
      {!disabledSettings?.forceMint && (
        <div className="flex flex-col gap-2">
          <ZapSettingsRowTitle
            title={t`Force DTF mint?`}
            help={t`This is useful if you want to mint the DTF without trading.`}
          />
          <div className="rounded-xl border border-border px-3 py-3 flex items-center gap-1 justify-between">
            <div className="flex items-center gap-1">
              <Anvil size={16} className="text-muted-foreground" />
              <div><Trans>Force minting DTF</Trans></div>
            </div>
            <Checkbox
              checked={forceMint}
              onCheckedChange={handleForceMintChange}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ZapSettings
