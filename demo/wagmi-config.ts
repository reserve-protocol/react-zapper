import { getDefaultConfig } from 'solariskit'
import { injectedWallet } from 'solariskit/wallets'
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
  // Injected wallets only: WalletConnect needs a project id allowlisted for this origin.
  wallets: [{ groupName: 'Installed', wallets: [injectedWallet] }],
  projectId: '',
  ssr: false,
})
