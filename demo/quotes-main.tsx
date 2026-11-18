import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import 'solariskit/styles.css'
import WalletProvider from './components/wallet-provider'
import { config } from './wagmi-config'
import QuotesApp from './QuotesApp'
import './index.css'

const queryClient = new QueryClient()

// Wallet is optional: without one the table quotes with the placeholder signer
// (display-only), with one it quotes for the real signer and simulates.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <QuotesApp />
        </WalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
