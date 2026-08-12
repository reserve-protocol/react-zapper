import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi-config'
import QuotesApp from './QuotesApp'
import './index.css'

const queryClient = new QueryClient()

// No wallet UI here: quotes are display-only (placeholder signer), so the page
// needs the wagmi/query providers the package expects and nothing else.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <QuotesApp />
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
