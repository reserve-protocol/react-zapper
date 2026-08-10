import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { mixpanelTrack } from '../../utils/tracking'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import Help from '../ui/help'
import { slippageAtom } from './atom'

// Inverted Reserve convention: value S ⇒ a fraction of 1/S ('200' = 0.5%).
const SLIPPAGE_OPTIONS = ['1000', '200', '100', '20'] // 0.1 / 0.5 / 1 / 5 %

const formatSlippage = (value: string): string => {
  const num = Number(value)
  if (!isFinite(num) || num <= 0) return '—'
  return `${(1 / num) * 100}%`
}

/**
 * Fixed-option slippage picker shown above the Details view (the settings
 * page it replaces is gone). Changing it refetches quotes — slippage is part
 * of the quote cache key — which also recomputes the "Max slippage" detail.
 */
const SlippageRow = ({ className }: { className?: string }) => {
  const [slippage, setSlippage] = useAtom(slippageAtom)

  const handleSelect = (option: string) => {
    setSlippage(option)
    mixpanelTrack('Slippage Tolerance Changed', {
      slippage: formatSlippage(option),
    })
  }

  return (
    <div
      className={cn('flex items-center justify-between px-3 py-1', className)}
    >
      <div className="flex items-center gap-1 font-light">
        <span className="text-muted-foreground">
          <Trans>Slippage tolerance</Trans>
        </span>
        <Help
          content={
            <Trans>
              Permissible price deviation (%) between quoted and execution price
            </Trans>
          }
          className="text-muted-foreground"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-primary/50 px-2.5 py-0.5 text-xs font-normal text-primary transition-colors hover:bg-primary/5"
          >
            {formatSlippage(slippage)}
            <ChevronDown size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[90px]">
          {SLIPPAGE_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option}
              onClick={() => handleSelect(option)}
              className={cn(
                'justify-center text-sm',
                option === slippage && 'font-semibold text-primary'
              )}
            >
              {formatSlippage(option)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default SlippageRow
