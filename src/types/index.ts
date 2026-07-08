import { QuoteSource } from '@/state/atoms'
import { AvailableChain } from '@/utils/chains'
import { SupportedLocale } from '@/i18n/provider'
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

export interface ScheduleCallConfig {
  /** Where the CTA sends the user (e.g. a Calendly link). */
  url: string
  /** Minimum purchase size (USD) that qualifies as a "larger holder". Defaults to 500. */
  minUsd?: number
  /** Consumer already recorded this wallet scheduling — hide the offer. */
  scheduled?: boolean
  /** Fired when the user clicks the CTA (consumer records the click + tracks). */
  onSchedule?: () => void
}

export interface DisabledSettingsConfig {
  /** Hide the "Deep liquidity search" setting and force the behavior off. */
  deepLiquidity?: boolean
  /** Hide the "Force minting DTF" setting and force the behavior off. */
  forceMint?: boolean
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
  /** Offer a "schedule an intro call" panel after a large purchase. Omit to disable. */
  scheduleCall?: ScheduleCallConfig
  /** Disable individual zap settings. Disabled options are hidden from the settings panel. */
  disabledSettings?: DisabledSettingsConfig
  /** UI language. Defaults to 'en'. Falls back to English for any untranslated string. */
  locale?: SupportedLocale
  /** Quote refresh interval in milliseconds. Defaults to 9000. */
  refreshRate?: number
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
export type { SupportedLocale } from '@/i18n/provider'
