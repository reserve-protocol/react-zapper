import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Landmark,
  PackageOpen,
  ScrollText,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { AvailableChain } from '../../utils/chains'
import {
  formatCurrency,
  formatShortAddress,
  formatTokenAmount,
} from '../../utils/format'
import { transactionUrl } from '../../utils/urls'
import TokenLogo from '../token-logo'
import { Button } from '../ui/button'
import { showContactInfoAtom, zapSuccessAtom } from './atom'
import SubscribeUpdates, { type ContactStatus } from './subscribe-updates'

const DetailRow = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-center gap-3 sm:gap-6">
    <span className="w-[92px] shrink-0 font-bold leading-6">{label}</span>
    <div className="flex min-w-0 items-center gap-2">{children}</div>
  </div>
)

const STAY_INFORMED = [
  { Icon: PackageOpen, text: msg`Changes to assets inside this DTF` },
  { Icon: ScrollText, text: msg`Methodology or mandate updates` },
  { Icon: Landmark, text: msg`Governance role changes` },
]

const ZapSuccessView = ({ onClose }: { onClose: () => void }) => {
  const { t } = useLingui()
  const success = useAtomValue(zapSuccessAtom)
  const showContactInfo = useAtomValue(showContactInfoAtom)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [contactStatus, setContactStatus] = useState<ContactStatus>('idle')

  if (!success) return null

  const {
    isMint,
    chainId,
    txHash,
    inputSymbol,
    inputAddress,
    inputValue,
    outputSymbol,
    outputAddress,
    receivedAmount,
  } = success

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center justify-center rounded-2xl border border-[#3ebf6e] p-1">
            <Check size={16} className="text-[#3ebf6e]" />
          </span>
          <Button
            variant="outline"
            className="h-8 w-8 rounded-xl px-0"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-[#3ebf6e] bg-[#ddf8e7] px-4 py-3 animate-slide-up">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-primary">
              {isMint ? t`Successful Purchase` : t`Successful Redemption`}
            </p>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 whitespace-nowrap text-primary"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              {detailsOpen ? t`Hide details` : t`Show details`}
              {detailsOpen ? (
                <ChevronUp size={16} />
              ) : (
                <ChevronDown size={16} />
              )}
            </button>
          </div>
          {detailsOpen && (
            <div className="flex flex-col gap-2 pt-4">
              <DetailRow label={t`Received:`}>
                <TokenLogo
                  className="shrink-0"
                  size="md"
                  symbol={outputSymbol}
                  address={outputAddress}
                  chain={chainId}
                />
                <span className="shrink-0 text-primary">{outputSymbol}</span>
                <span className="truncate text-foreground">
                  {formatTokenAmount(Number(receivedAmount))}
                </span>
              </DetailRow>
              <DetailRow label={t`Used:`}>
                <TokenLogo
                  className="shrink-0"
                  size="lg"
                  symbol={inputSymbol}
                  address={inputAddress}
                  chain={chainId}
                />
                <span className="shrink-0 text-primary">{inputSymbol}</span>
                <span className="truncate text-foreground">
                  ${formatCurrency(inputValue)}
                </span>
              </DetailRow>
              <DetailRow label={t`Transaction:`}>
                <a
                  href={transactionUrl(chainId as AvailableChain, txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-primary hover:opacity-80"
                >
                  {formatShortAddress(txHash)}
                  <ArrowUpRight size={16} />
                </a>
              </DetailRow>
            </div>
          )}
        </div>

        {showContactInfo && (
          <div className="flex flex-col gap-4 rounded-2xl border border-[#e0d5c7] bg-[#fefbf8] p-4 opacity-0 animate-fade-in [animation-delay:300ms]">
            <div className="flex flex-col gap-1">
              <p className="text-xl font-medium leading-7 text-primary">
                <Trans>Stay informed about this DTF</Trans>
              </p>
              <p className="text-base text-foreground">
                <Trans>
                  Get relevant updates about changes that may affect this DTF.
                </Trans>
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-base text-foreground">
              {STAY_INFORMED.map(({ Icon, text }) => (
                <li key={t(text)} className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card">
                    <Icon size={12} />
                  </span>
                  {t(text)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {showContactInfo &&
        (contactStatus === 'success' ? (
          <div className="flex flex-col gap-6">
            <p className="px-4 text-left font-bold text-primary opacity-0 animate-fade-in">
              <Trans>
                Thanks for getting involved, we’re excited to have you! We’ll
                reach out with any important updates on this DTF.
              </Trans>
            </p>
            <div className="flex justify-center px-4 pb-4">
              <Button
                variant="secondary"
                className="rounded-xl px-8"
                onClick={onClose}
              >
                <Trans>Close</Trans>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {contactStatus === 'error' && (
              <p className="px-4 text-left font-bold text-[#ef4345] animate-fade-in">
                <Trans>
                  Something went wrong. Please try again. If the problem
                  persists, please{' '}
                  <a
                    href="https://reserve.canny.io/general-help-requests"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary"
                  >
                    submit a help request
                  </a>
                  .
                </Trans>
              </p>
            )}
            <SubscribeUpdates
              className="px-4 opacity-0 animate-fade-in [animation-delay:300ms]"
              onStatusChange={setContactStatus}
            />
            <button
              type="button"
              onClick={onClose}
              disabled={contactStatus === 'submitting'}
              className="px-4 pb-4 text-center text-primary opacity-0 animate-fade-in [animation-delay:300ms] disabled:cursor-not-allowed disabled:text-muted-foreground"
            >
              <Trans>No thanks</Trans>
            </button>
          </>
        ))}
    </div>
  )
}

export default ZapSuccessView
