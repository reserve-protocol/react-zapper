import { Trans } from '@lingui/react/macro'
import { chainIdAtom, connectWalletAtom } from '@/state/atoms'
import { CHAIN_TAGS } from '@/utils/chains'
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
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
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

  const { data: balance } = useBalance({
    address: account.address,
    chainId,
  })

  const hasInsufficientGas = React.useMemo(() => {
    if (!balance) return false
    return gas ? balance.value < gas : balance.value === 0n
  }, [balance, gas])

  if (!isConnected) {
    return <ConnectWalletButton disabled={disabled || loading} />
  }

  if (isWrongChain) {
    return <SwitchChainButton disabled={disabled || loading} />
  }

  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading || hasInsufficientGas}
      variant={variant}
      size={size}
      className={cn(
        'w-full',
        loading && 'cursor-not-allowed opacity-75',
        className
      )}
    >
      {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
      {hasInsufficientGas ? <Trans>Insufficient gas balance</Trans> : children}
    </Button>
  )
}

export const ConnectWalletButton = ({ disabled }: { disabled?: boolean }) => {
  const { fn: connectWallet } = useAtomValue(connectWalletAtom)
  return (
    <Button
      size="lg"
      onClick={connectWallet}
      className="w-full rounded-xl"
      disabled={disabled}
    >
      <Trans>Connect Wallet</Trans>
    </Button>
  )
}

export const SwitchChainButton = ({ disabled }: { disabled?: boolean }) => {
  const { switchChain } = useSwitchChain()
  const chainId = useAtomValue(chainIdAtom)
  const chainName = CHAIN_TAGS[chainId]
  return (
    <Button
      size="lg"
      onClick={() => switchChain({ chainId })}
      className="w-full rounded-xl"
      disabled={disabled}
    >
      <Trans>Switch to {chainName}</Trans>
    </Button>
  )
}

export function TransactionButtonContainer({
  children,
  disabled,
}: {
  children: React.ReactNode
  disabled?: boolean
}) {
  const account = useAccount()
  const chainId = useAtomValue(chainIdAtom)
  const walletChainId = account.chain?.id
  const isConnected = account.isConnected
  const isWrongChain = walletChainId && walletChainId !== chainId

  if (!isConnected) {
    return <ConnectWalletButton disabled={disabled} />
  }

  if (isWrongChain) {
    return <SwitchChainButton disabled={disabled} />
  }

  return <div className="space-y-2">{children}</div>
}

export default TransactionButton
