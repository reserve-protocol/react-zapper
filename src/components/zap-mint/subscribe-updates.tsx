import { Trans, useLingui } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { Mail } from 'lucide-react'
import { useCallback, useState } from 'react'
import { walletAtom } from '../../state/atoms'
import { cn } from '../../utils/cn'
import { UPDATES_STORAGE_URL } from '../../utils/constants'
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

  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const { trackContact } = useTrackIndexDTFContact()

  const handleSubmit = useCallback(async () => {
    if (!value) return
    setSubmitted(true)
    onStatusChange?.('submitting')
    trackContact('zap_contact_submit', 'email')
    try {
      const res = await fetch(UPDATES_STORAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: account,
          value: `$${formatCurrency(success?.receivedValue ?? 0)}`,
          dtf: success?.outputSymbol ?? '',
          chainId: success?.chainId,
          txHash: success?.txHash ?? '',
          telegram: '',
          email: value,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      trackContact('zap_contact_subscribed', 'email')
      onStatusChange?.('success')
    } catch {
      trackContact('zap_contact_error', 'email')
      setSubmitted(false)
      onStatusChange?.('error')
    }
  }, [value, account, success, trackContact, onStatusChange])

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
          disabled={!value || submitted}
          onClick={handleSubmit}
        >
          <Trans>Subscribe</Trans>
        </Button>
      </div>
    </div>
  )
}

export default SubscribeUpdates
