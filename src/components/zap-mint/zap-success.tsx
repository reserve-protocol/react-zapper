import { useAtomValue } from 'jotai'
import { ArrowUpRight, Check } from 'lucide-react'
import { Hex } from 'viem'
import useMediaQuery from '../../hooks/useMediaQuery'
import { AvailableChain } from '../../utils/chains'
import { formatShortAddress } from '../../utils/format'
import { transactionUrl } from '../../utils/urls'
import { showContactInfoAtom } from './atom'
import SubscribeUpdates from './subscribe-updates'

const ZapSuccess = ({
  hash,
  chainId,
  isMint,
  mode = 'modal',
}: {
  hash: Hex
  chainId: number
  isMint: boolean
  mode?: 'modal' | 'inline' | 'simple'
}) => {
  const showContactInfo = useAtomValue(showContactInfoAtom)
  // Must match the breakpoint in zapper.tsx: at >=900px the contact sheet
  // slides out from behind the modal (rendered at the dialog level); below that
  // (and in inline mode) it falls back to a stacked card below the success bar.
  const isWideScreen = useMediaQuery('(min-width: 900px)')

  const inlineContact =
    isMint && showContactInfo && (mode === 'inline' || !isWideScreen)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/15 px-4 py-3 text-primary">
        <div className="flex items-center gap-2">
          <Check size={16} />
          <span>{isMint ? 'Successful Purchase' : 'Successful Sale'}</span>
        </div>
        <a
          href={transactionUrl(chainId as AvailableChain, hash)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:opacity-80"
        >
          {formatShortAddress(hash)}
          <ArrowUpRight size={16} />
        </a>
      </div>

      {inlineContact && (
        <div className="rounded-xl border pt-5 px-1 pb-1">
          <SubscribeUpdates />
        </div>
      )}
    </div>
  )
}

export default ZapSuccess
