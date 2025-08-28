import { Checkbox } from '../ui/checkbox'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { OctagonAlert } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  zapHighDustValueAtom,
  zapDustWarningCheckboxAtom,
  selectedTokenAtom,
  zapperCurrentTabAtom,
} from './atom'
import { formatCurrency, formatPercentage } from '../../utils'
import { indexDTFAtom } from '@/state/atoms'

const DUST_THRESHOLD = 10

const ZapDustWarningCheckbox = ({
  dustValue = 0,
  amountOutValue = 0,
}: {
  dustValue?: number
  amountOutValue?: number
}) => {
  const [checkbox, setCheckbox] = useAtom(zapDustWarningCheckboxAtom)
  const setHighDustValue = useSetAtom(zapHighDustValueAtom)
  const selectedToken = useAtomValue(selectedTokenAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const operation = useAtomValue(zapperCurrentTabAtom)

  const tokenOutSymbol =
    operation === 'buy' ? indexDTF?.token.symbol : selectedToken?.symbol

  const dustPercentage = useMemo(() => {
    const totalValue = dustValue + amountOutValue
    return totalValue ? (dustValue / totalValue) * 100 : 0
  }, [dustValue, amountOutValue])

  useEffect(() => {
    setHighDustValue(dustPercentage >= DUST_THRESHOLD)
  }, [dustPercentage, setHighDustValue])

  if (dustPercentage < DUST_THRESHOLD) return null

  return (
    <label className="flex flex-col gap-2 p-4 pt-4 cursor-pointer border-t border-border">
      <OctagonAlert size={16} className="text-warning" />
      <div className="flex items-end gap-2 justify-between">
        <div className="max-w-sm">
          <div className="font-bold">
            High dust value: ${formatCurrency(dustValue)} (
            {formatPercentage(Math.abs(dustPercentage))} of output value)
          </div>
          <div className="text-sm text-legend">
            This trade results in a large amount of dust, meaning you will
            receive {formatPercentage(Math.abs(dustPercentage))} of the value in
            individual assets, with the remaining in {tokenOutSymbol}.
          </div>
        </div>
        <div className="flex items-center p-[6px] border border-border rounded-lg">
          <Checkbox
            checked={checkbox}
            onCheckedChange={(checked: boolean) => setCheckbox(checked)}
          />
        </div>
      </div>
    </label>
  )
}

export default ZapDustWarningCheckbox
