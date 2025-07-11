import { Address } from 'viem'
import { Config } from 'wagmi'

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
  mode?: 'modal' | 'inline'
  chain: number
  dtfAddress: Address
  apiUrl?: string
  wagmiConfig: Config
  connectWallet?: () => void
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
