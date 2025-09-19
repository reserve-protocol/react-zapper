import { base, mainnet, bsc, arbitrum } from 'viem/chains'
import { AvailableChain } from './chains'

export function explorerUrl(chainId: AvailableChain, addr: string) {
  const url = {
    [mainnet.id]: mainnet,
    [base.id]: base,
    [bsc.id]: bsc,
    [arbitrum.id]: arbitrum,
  }[chainId].blockExplorers.default.url

  return `${url}/address/${addr}`
}

export function dexscreenerUrl(chainId: AvailableChain, addr: string) {
  const chain = {
    [mainnet.id]: 'ethereum',
    [base.id]: 'base',
    [bsc.id]: 'bsc',
    [arbitrum.id]: 'arbitrum',
  }[chainId]
  return `https://dexscreener.com/${chain}/${addr}`
}
