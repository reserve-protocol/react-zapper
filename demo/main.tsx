import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SolarisEthereumProvider } from 'solariskit'
import 'solariskit/styles.css'
import { config } from './wagmi-config'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SolarisEthereumProvider>
          <App />
        </SolarisEthereumProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)