import { broom } from '@lucide/lab'
import { Trans, useLingui } from '@lingui/react/macro'
import { useAtom, useAtomValue } from 'jotai'
import { Anvil, Icon, Route, Search } from 'lucide-react'
import {
  chainIdAtom,
  deepLiquidityAtom,
  quoteSourceAtom,
  type QuoteSource,
} from '../../state/atoms'
import { getEnabledProviders } from '../../utils/providers'
import { Checkbox } from '../ui/checkbox'
import Help from '../ui/help'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
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
  const chainId = useAtomValue(chainIdAtom)
  const [slippage, setSlippage] = useAtom(slippageAtom)
  const [forceMint, setForceMint] = useAtom(forceMintAtom)
  const [quoteSource, setQuoteSource] = useAtom(quoteSourceAtom)
  const [deepLiquidity, setDeepLiquidity] = useAtom(deepLiquidityAtom)
  const disabledSettings = useAtomValue(disabledSettingsAtom)

  const handleSlippageChange = (value: string) => {
    setSlippage(value)
  }

  const handleForceMintChange = (value: boolean | 'indeterminate') => {
    const newValue = value === 'indeterminate' ? false : value
    setForceMint(newValue)
  }

  const handleQuoteSourceChange = (value: QuoteSource) => {
    setQuoteSource(value)
  }

  const handleDeepLiquidityChange = (value: boolean | 'indeterminate') => {
    const newValue = value === 'indeterminate' ? false : value
    setDeepLiquidity(newValue)
  }

  const enabledProviders = getEnabledProviders(chainId)

  return (
    <div className="min-h-[306px] border-t border-border -mx-2 px-2 py-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ZapSettingsRowTitle
          title={t`Quote Source`}
          help={t`Select which quote provider to use. 'Best' automatically compares all enabled providers and picks the highest output. Picking a specific provider forces a single source.`}
        />
        <Select value={quoteSource} onValueChange={handleQuoteSourceChange}>
          <SelectTrigger className="w-full bg-transparent rounded-xl border-border h-auto py-3 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best" className="text-base">
              <div className="flex items-center gap-2">
                <Route size={14} />
                <span><Trans>Best Quote</Trans></span>
              </div>
            </SelectItem>
            {enabledProviders.map(({ id, label, Icon }) => (
              <SelectItem key={id} value={id} className="text-base">
                <div className="flex items-center gap-2">
                  <Icon size={14} />
                  <span>{label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
            disabled={disabledSettings?.deepLiquidity}
          />
        </div>
      </div>
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
            disabled={disabledSettings?.forceMint}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <ZapSettingsRowTitle
          title={t`Collect dust?`}
          help={t`Dust is the leftover amount of tokens that cannot be exchanged. If you choose to collect dust, it will be sent back to your wallet. Sending dust back to the wallet will increase transaction fee.`}
        />
        <div className="rounded-xl border border-border px-3 py-3 flex items-center gap-1 justify-between">
          <div className="flex items-center gap-1">
            <Icon
              iconNode={broom}
              size={16}
              className="text-muted-foreground"
            />
            <div><Trans>Send dust back to wallet</Trans></div>
          </div>
          <Checkbox checked disabled />
        </div>
      </div>
    </div>
  )
}

export default ZapSettings
