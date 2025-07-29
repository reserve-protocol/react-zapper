import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, bsc, mainnet } from 'wagmi/chains'

export const config = getDefaultConfig({
  chains: [mainnet, base, bsc],
  appName: 'React Zapper Demo',
  projectId: 'a3c3b8f4a0c0f1d9e2b5a7d9c1e3f5a7', // Demo project ID
  ssr: false,
})
