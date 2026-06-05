import { useAtomValue } from 'jotai'
import {
  BellDot,
  ChevronDown,
  ChevronUp,
  Landmark,
  Mail,
  PackageOpen,
  ScrollText,
} from 'lucide-react'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { formatEther } from 'viem'
import {
  chainIdAtom,
  indexDTFAtom,
  indexDTFPriceAtom,
  walletAtom,
} from '../../state/atoms'
import { cn } from '../../utils/cn'
import { UPDATES_STORAGE_URL } from '../../utils/constants'
import { formatCurrency } from '../../utils/format'
import { getReceivedAmount } from '../../utils/receipt'
import { useTrackIndexDTFContact } from '../../utils/tracking'
import TelegramIcon from '../icons/TelegramIcon'
import XIcon from '../icons/XIcon'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Input } from '../ui/input'
import { zapQuoteStateAtom, zapTxReceiptAtom } from './atom'

type SocialMediaOption = {
  key: 'telegram' | 'twitter' | 'email'
  name: string
  placeholder: string
  icon: ReactNode
}

const SOCIAL_MEDIA_OPTIONS: SocialMediaOption[] = [
  {
    key: 'telegram',
    name: 'Telegram',
    placeholder: 'Telegram username',
    icon: <TelegramIcon width={16} height={16} />,
  },
  {
    key: 'twitter',
    name: 'x.com',
    placeholder: 'x.com username',
    icon: <XIcon height={16} width={16} />,
  },
  {
    key: 'email',
    name: 'Email',
    placeholder: 'Email address',
    icon: <Mail size={14} />,
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

const SubscribeUpdates = ({ className }: { className?: string }) => {
  const account = useAtomValue(walletAtom)
  const chainId = useAtomValue(chainIdAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const dtfPrice = useAtomValue(indexDTFPriceAtom)
  const txReceipt = useAtomValue(zapTxReceiptAtom)
  const quote = useAtomValue(zapQuoteStateAtom)

  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<SocialMediaOption>(
    SOCIAL_MEDIA_OPTIONS[0]
  )

  const { trackContact } = useTrackIndexDTFContact()

  const dtfSymbol = indexDTF?.token.symbol ?? ''
  const txHash = txReceipt?.transactionHash ?? ''

  // USD value of the DTF received (from logs), falling back to the quoted value.
  const receivedRaw = useMemo(
    () =>
      txReceipt && indexDTF && account
        ? getReceivedAmount(txReceipt.logs, indexDTF.id, account)
        : 0n,
    [txReceipt, indexDTF, account]
  )
  const outputValue =
    receivedRaw > 0n
      ? Number(formatEther(receivedRaw)) * (dtfPrice || 0)
      : quote.data?.quote?.amountOutValue ?? 0

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 5000)
      return () => clearTimeout(timeout)
    }
  }, [copied])

  const handleSubmit = useCallback(
    async (key: SocialMediaOption['key']) => {
      if (!value) return
      setSubmitted(true)
      trackContact('zap_contact_submit', key)
      try {
        const res = await fetch(UPDATES_STORAGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: account,
            value: `$${formatCurrency(outputValue)}`,
            dtf: dtfSymbol,
            chainId,
            txHash,
            telegram: key === 'telegram' ? value : '',
            twitter: key === 'twitter' ? value : '',
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
    [value, account, outputValue, dtfSymbol, chainId, txHash, trackContact]
  )

  return (
    <div className={cn('flex h-full flex-col gap-4', className)}>
      <div className="flex h-full flex-col gap-4 px-4">
        <BellDot size={24} className="text-primary" />
        <div className="flex-1" />
        <div className="flex flex-col gap-1">
          <p className="text-[20px] font-medium leading-[27px] text-primary">
            Stay informed about {dtfSymbol}
          </p>
          <p className="text-base text-secondary-foreground font-light">
            Get relevant updates about changes that might affet this DTF.
          </p>
        </div>
        <ul className="flex flex-col gap-3 text-base text-secondary-foreground font-light">
          <li className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card">
              <PackageOpen size={12} />
            </span>
            Changes to assets inside this DTF
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card">
              <ScrollText size={12} />
            </span>
            Methodology or mandate changes
          </li>
          <li className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card">
              <Landmark size={12} />
            </span>
            Governance role changes
          </li>
        </ul>
      </div>
      <div className="relative">
        <Dropdown
          selected={selected}
          onSelectOption={(option) => {
            setValue('')
            setSelected(option)
          }}
        />
        <Input
          className="w-full h-11 text-sm pl-14 pr-[110px] bg-card/80 rounded-xl"
          placeholder={selected.placeholder}
          value={value}
          onChange={(e) => !submitted && setValue(e.target.value)}
          disabled={submitted}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit(selected.key)
          }}
        />
        {submitted ? (
          <Button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7"
            size="sm"
            disabled={copied}
            onClick={() => {
              navigator.clipboard.writeText(value)
              setCopied(true)
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        ) : (
          <Button
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7"
            size="sm"
            disabled={!value}
            onClick={() => handleSubmit(selected.key)}
          >
            Get updates
          </Button>
        )}
      </div>
    </div>
  )
}

export default SubscribeUpdates
