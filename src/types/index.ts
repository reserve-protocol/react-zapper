import { QuoteSource } from '@/state/atoms'
import { AvailableChain } from '@/utils/chains'
import { Address } from 'viem'
export interface Token {
  address: Address
  symbol: string
  name: string
  decimals: number
  logoURI?: string
  price?: number
}

export interface TokenBalance {
  value: bigint
  balance: string // formatted balance
  decimals: number
}

// Relaxed wagmiConfig type to avoid strict type checking issues
// between different viem/wagmi versions in host applications
interface MinimalWagmiConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface ZapperProps {
  mode?: 'modal' | 'inline'
  chain: AvailableChain
  dtfAddress: Address
  apiUrl?: string
  wagmiConfig: MinimalWagmiConfig
  connectWallet?: () => void
  debug?: boolean
  defaultSource?: QuoteSource
}

export interface UseZapperModalReturn {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  setTab: (tab: 'buy' | 'sell') => void
  currentTab: 'buy' | 'sell'
}

export * from './api'
export type { QuoteSource } from '@/state/atoms'
