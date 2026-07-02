import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { base, bsc, mainnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  chains: [mainnet, base, bsc],
  // viem's default mainnet RPC (eth.merkle.io) times out, which blanks the
  // balance panel on Ethereum; use a reliable endpoint. L2 defaults are fine.
  transports: {
    [mainnet.id]: http('https://ethereum-rpc.publicnode.com'),
    [base.id]: http(),
    [bsc.id]: http(),
  },
  appName: 'React Zapper Demo',
  projectId: 'a3c3b8f4a0c0f1d9e2b5a7d9c1e3f5a7', // Demo project ID
  ssr: false,
})
