import React from 'react'
import { Button } from './ui/button'
import { cn } from '../utils/cn'
import { Loader } from 'lucide-react'
import { chainIdAtom, connectWalletAtom } from '@/state/atoms'
import { useAtomValue } from 'jotai'
import { useAccount, useSwitchChain } from 'wagmi'
import { CHAIN_TAGS } from '@/utils/chains'

interface TransactionButtonProps {
  children: React.ReactNode
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
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
  variant = 'default',
  size = 'lg',
}: TransactionButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      className={cn(
        'w-full',
        loading && 'cursor-not-allowed opacity-75',
        className
      )}
    >
      {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}

export const ConnectWalletButton = () => {
  const { fn: connectWallet } = useAtomValue(connectWalletAtom)
  return (
    <Button size="lg" onClick={connectWallet} className="w-full rounded-xl">
      Connect Wallet
    </Button>
  )
}

export function TransactionButtonContainer({
  children,
}: {
  children: React.ReactNode
}) {
  const account = useAccount()
  const { switchChain } = useSwitchChain()
  const chainId = useAtomValue(chainIdAtom)
  const walletChainId = account.chain?.id
  const isConnected = account.isConnected
  const isWrongChain = walletChainId && walletChainId !== chainId

  if (!isConnected) {
    return <ConnectWalletButton />
  }

  if (isWrongChain && switchChain) {
    return (
      <Button
        className="w-full rounded-xl"
        onClick={() => switchChain({ chainId })}
      >
        Switch to {CHAIN_TAGS[chainId]}
      </Button>
    )
  }

  return <div className="space-y-2">{children}</div>
}

export default TransactionButton
