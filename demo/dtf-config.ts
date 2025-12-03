import { Address } from 'viem'
import { base, bsc, mainnet } from 'wagmi/chains'

export interface DTFConfig {
  address: Address
  symbol: string
}

export const DTF_BY_CHAIN: Record<number, DTFConfig[]> = {
  [mainnet.id]: [
    {
      address: '0x323c03c48660fe31186fa82c289b0766d331ce21',
      symbol: 'OPEN',
    },
    {
      address: '0x4e3b170dcbe704b248df5f56d488114ace01b1c5',
      symbol: 'BED',
    },
  ],
  [base.id]: [
    {
      address: '0x44551ca46fa5592bb572e20043f7c3d54c85cad7',
      symbol: 'CLX',
    },
    {
      address: '0x23418de10d422ad71c9d5713a2b8991a9c586443',
      symbol: 'BGCI',
    },
  ],
  [bsc.id]: [
    {
      address: '0x2f8a339b5889ffac4c5a956787cda593b3c36867',
      symbol: 'CMC20',
    },
  ],
}
