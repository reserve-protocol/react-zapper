import { useAtomValue } from 'jotai'
import { ChevronDown, ChevronUp, Mail } from 'lucide-react'
import { ReactNode, useCallback, useState } from 'react'
import { walletAtom } from '../../state/atoms'
import { cn } from '../../utils/cn'
import { UPDATES_STORAGE_URL } from '../../utils/constants'
import { formatCurrency } from '../../utils/format'
import { useTrackIndexDTFContact } from '../../utils/tracking'
import TelegramIcon from '../icons/TelegramIcon'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { zapSuccessAtom } from './atom'

type SocialMediaOption = {
  key: 'email' | 'telegram'
  name: string
  placeholder: string
  icon: ReactNode
}

const SOCIAL_MEDIA_OPTIONS: SocialMediaOption[] = [
  {
    key: 'email',
    name: 'Email',
    placeholder: 'Enter your email',
    icon: <Mail size={14} />,
  },
  {
    key: 'telegram',
    name: 'Telegram',
    placeholder: 'Telegram username',
    icon: <TelegramIcon width={16} height={16} />,
  },
]

const Dropdown = ({
  selected,
  onSelectOption,
}: {
  selected: SocialMediaOption
  onSelectOption: (option: SocialMediaOption) => void
}) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center cursor-pointer justify-center absolute left-2 top-1/2 -translate-y-1/2 border-r border-border pr-1 pl-0.5">
          {selected.icon}
          <div className="pl-1" />
          {open ? (
            <ChevronUp color="currentColor" strokeWidth={1.2} size={16} />
          ) : (
            <ChevronDown color="currentColor" strokeWidth={1.2} size={16} />
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl">
        {SOCIAL_MEDIA_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.key}
            className="flex items-center gap-2 text-xs font-medium cursor-pointer"
            onSelect={() => onSelectOption(option)}
          >
            {option.icon}
            {option.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const SubscribeUpdates = ({
  className,
  onSubmitted,
}: {
  className?: string
  onSubmitted?: () => void
}) => {
  const account = useAtomValue(walletAtom)
  const success = useAtomValue(zapSuccessAtom)

  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState<SocialMediaOption>(
    SOCIAL_MEDIA_OPTIONS[0]
  )

  const { trackContact } = useTrackIndexDTFContact()

  const handleSubmit = useCallback(
    async (key: SocialMediaOption['key']) => {
      if (!value) return
      setSubmitted(true)
      onSubmitted?.()
      trackContact('zap_contact_submit', key)
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
            telegram: key === 'telegram' ? value : '',
            email: key === 'email' ? value : '',
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        trackContact('zap_contact_subscribed', key)
      } catch {
        // Fail silently for the user — keep the submitted UI, just record it.
        trackContact('zap_contact_error', key)
      }
    },
    [value, account, success, trackContact, onSubmitted]
  )

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <Dropdown
          selected={selected}
          onSelectOption={(option) => {
            setValue('')
            setSelected(option)
          }}
        />
        <Input
          className="h-[49px] w-full rounded-xl bg-card/80 pl-14 text-sm"
          placeholder={selected.placeholder}
          value={value}
          onChange={(e) => !submitted && setValue(e.target.value)}
          disabled={submitted}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(selected.key)
          }}
        />
      </div>
      <Button
        className="h-[49px] rounded-xl"
        disabled={!value || submitted}
        onClick={() => handleSubmit(selected.key)}
      >
        Get updates
      </Button>
    </div>
  )
}

export default SubscribeUpdates
