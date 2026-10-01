import { Trans, useLingui } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { Mail } from 'lucide-react'
import { useCallback, useState } from 'react'
import useTurnstile from '../../hooks/use-turnstile'
import {
  apiUrlAtom,
  turnstileSiteKeyAtom,
  walletAtom,
} from '../../state/atoms'
import zapper from '../../types/api'
import { cn } from '../../utils/cn'
import { formatCurrency } from '../../utils/format'
import { useTrackIndexDTFContact } from '../../utils/tracking'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { zapSuccessAtom } from './atom'

export type ContactStatus = 'idle' | 'submitting' | 'success' | 'error'

const SubscribeUpdates = ({
  className,
  onStatusChange,
}: {
  className?: string
  onStatusChange?: (status: ContactStatus) => void
}) => {
  const { t } = useLingui()
  const account = useAtomValue(walletAtom)
  const success = useAtomValue(zapSuccessAtom)
  const apiUrl = useAtomValue(apiUrlAtom)
  const turnstileSiteKey = useAtomValue(turnstileSiteKeyAtom)
  const turnstile = useTurnstile(turnstileSiteKey, 'dtf-minter')

  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { trackContact } = useTrackIndexDTFContact()

  const handleSubmit = useCallback(async () => {
    if (!value || !turnstile.token) return
    setSubmitted(true)
    onStatusChange?.('submitting')
    trackContact('zap_contact_submit', 'email')
    try {
      const res = await fetch(zapper.subscribeUpdates(apiUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: account,
          value: `$${formatCurrency(success?.receivedValue ?? 0)}`,
          // The API subscribes only a wallet that just moved this DTF
          dtf:
            (success?.isMint ? success?.outputSymbol : success?.inputSymbol) ??
            '',
          dtfAddress: success?.isMint
            ? success?.outputAddress
            : success?.inputAddress,
          chainId: success?.chainId,
          ...(success?.txHash ? { txHash: success.txHash } : {}),
          email: value,
          turnstileToken: turnstile.token,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      trackContact('zap_contact_subscribed', 'email')
      onStatusChange?.('success')
    } catch {
      trackContact('zap_contact_error', 'email')
      setSubmitted(false)
      turnstile.reset()
      onStatusChange?.('error')
    }
  }, [value, account, success, apiUrl, turnstile, trackContact, onStatusChange])

  return (
    <div className={cn(className)}>
      <div className="relative">
        <Mail
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="h-[49px] py-0 w-full rounded-xl bg-card/80 pl-11 pr-28 font-light"
          placeholder={t`Enter your email`}
          value={value}
          onChange={(e) => !submitted && setValue(e.target.value)}
          disabled={submitted}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <Button
          className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-lg"
          disabled={!value || submitted || !turnstile.token}
          onClick={handleSubmit}
        >
          <Trans>Subscribe</Trans>
        </Button>
      </div>
      <div ref={turnstile.containerRef} />
    </div>
  )
}

export default SubscribeUpdates
