import { Trans } from '@lingui/react/macro'
import { chainIdAtom, connectWalletAtom } from '@/state/atoms'
import { useAtomValue } from 'jotai'
import { Loader } from 'lucide-react'
import React from 'react'
import { useAccount, useBalance, useSwitchChain } from 'wagmi'
import { cn } from '../utils/cn'
import { Button } from './ui/button'

interface TransactionButtonProps {
  children: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
  gas?: bigint
  variant?:
    'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs'
}

/**
 * Simple transaction button component
 */
export function TransactionButton({
  children,
  disabled = false,
  loading = false,
  onClick,
  className,
  gas,
  variant = 'default',
  size = 'lg',
}: TransactionButtonProps) {
  const account = useAccount()
  const chainId = useAtomValue(chainIdAtom)
  const walletChainId = account.chain?.id
  const isConnected = account.isConnected
  const isWrongChain = walletChainId && walletChainId !== chainId
  const { switchChainAsync } = useSwitchChain()
  const [switching, setSwitching] = React.useState(false)

  const { data: balance } = useBalance({
    address: account.address,
    chainId,
  })

  const hasInsufficientGas = React.useMemo(() => {
    if (!balance) return false
    return gas ? balance.value < gas : balance.value === 0n
  }, [balance, gas])

  if (!isConnected) {
    // Keep the action label and styling: the CTA reads e.g. "Market Buy" and
    // clicking it prompts the wallet connect flow.
    return (
      <ConnectWalletButton className={className}>
        {children}
      </ConnectWalletButton>
    )
  }

  // A wallet sitting on another network is switched right before the CTA
  // action (approve or buy/sell) — there is no separate "Switch network"
  // button. A rejected/failed switch simply cancels the click.
  const handleClick = async () => {
    if (isWrongChain) {
      try {
        setSwitching(true)
        await switchChainAsync({ chainId })
      } catch {
        return
      } finally {
        setSwitching(false)
      }
    }
    onClick?.()
  }

  const busy = loading || switching

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || busy || hasInsufficientGas}
      variant={variant}
      size={size}
      className={cn(
        'w-full',
        busy && 'cursor-not-allowed opacity-75',
        className
      )}
    >
      {busy && <Loader className="mr-2 h-4 w-4 animate-spin" />}
      {hasInsufficientGas ? <Trans>Insufficient gas balance</Trans> : children}
    </Button>
  )
}

export const ConnectWalletButton = ({
  disabled,
  className,
  children,
}: {
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}) => {
  const { fn: connectWallet } = useAtomValue(connectWalletAtom)
  return (
    <Button
      size="lg"
      onClick={connectWallet}
      className={cn('w-full rounded-xl', className)}
      disabled={disabled}
    >
      {children ?? <Trans>Connect Wallet</Trans>}
    </Button>
  )
}

export function TransactionButtonContainer({
  children,
  connectLabel,
  connectClassName,
}: {
  children: React.ReactNode
  disabled?: boolean
  /** Label for the disconnected state (defaults to "Connect Wallet"). */
  connectLabel?: React.ReactNode
  connectClassName?: string
}) {
  const account = useAccount()

  if (!account.isConnected) {
    return (
      <ConnectWalletButton className={connectClassName}>
        {connectLabel}
      </ConnectWalletButton>
    )
  }

  // A wrong-network wallet renders the regular (disabled) content too — the
  // network is switched on the CTA click, not through a dedicated button.
  return <div className="space-y-2">{children}</div>
}

export default TransactionButton
