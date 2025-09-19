import { mainnet, base, arbitrum, bsc } from 'viem/chains'
export type AvailableChain =
  | typeof mainnet.id
  | typeof base.id
  | typeof arbitrum.id
  | typeof bsc.id

export const ChainId: Record<string, AvailableChain> = {
  Mainnet: mainnet.id,
  Base: base.id,
  Arbitrum: arbitrum.id,
  BSC: bsc.id,
} as const

export const CHAIN_TAGS = {
  [ChainId.Mainnet]: 'Ethereum',
  [ChainId.Base]: 'Base',
  [ChainId.Arbitrum]: 'Arbitrum One',
  [ChainId.BSC]: 'BNB Smart Chain',
} as const
