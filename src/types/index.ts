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

export interface ZapperProps {
  mode?: 'modal' | 'inline' | 'simple'
  chain: AvailableChain
  dtfAddress: Address
  apiUrl?: string
  zapperApiUrl?: string
  connectWallet?: () => void
  debug?: boolean
  defaultSource?: QuoteSource
  sellOnly?: boolean
  disabled?: boolean
  /** Show the "Stay informed" contact-capture panel after a successful mint. Defaults to true. */
  showContactInfo?: boolean
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
