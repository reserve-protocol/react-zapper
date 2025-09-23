import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Toaster, useZapperModal } from '@reserve-protocol/react-zapper'
import React, { useState } from 'react'
import { useChains, useConfig } from 'wagmi'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { DTF_BY_CHAIN } from './dtf-config'
import ZapperWrapper from './components/zapper-wrapper'
import { AvailableChain } from '../dist/utils/chains'
import { QuoteSource } from '../dist/types'

const API_URLS = [
  {
    label: 'Default',
    value: 'https://api.reserve.org/',
  },
  {
    label: 'Staging',
    value: 'https://api-staging.reserve.org/',
  },
  {
    label: 'Local',
    value: 'http://localhost:3005/',
  },
]

function App() {
  const wagmiConfig = useConfig()
  const chains = useChains().map((chain) => ({
    id: chain.id,
    label: chain.name,
  }))
  const [selectedChain, setSelectedChain] = useState(chains[0])
  const availableDTFs = DTF_BY_CHAIN[selectedChain.id] || []
  const [selectedDTF, setSelectedDTF] = useState(availableDTFs[0])
  const [debug, setDebug] = useState(false)
  const [quoteSource, setQuoteSource] = useState<QuoteSource>('best')
  const [apiUrl, setApiUrl] = useState(API_URLS[0].value)
  const { open } = useZapperModal()

  // Update selected DTF when chain changes
  React.useEffect(() => {
    const newDTFs = DTF_BY_CHAIN[selectedChain.id] || []
    if (newDTFs.length > 0) {
      setSelectedDTF(newDTFs[0])
    }
  }, [selectedChain.id])

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              React Zapper Demo
            </h1>
            <p className="text-muted-foreground mt-1">
              Test the zapper component with different DTFs and modes
            </p>
          </div>
          <ConnectButton />
        </div>

        {/* DTF Selector */}
        {availableDTFs.length > 0 && (
          <Card className="mb-6 bg-secondary/30 border-border-secondary">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                Configuration
              </CardTitle>
              <CardDescription>
                Configure the DTF token and API endpoint for the zapper
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Chain</label>
                <Select
                  value={selectedChain.id.toString()}
                  onValueChange={(value) => {
                    setSelectedChain(
                      chains.find((chain) => chain.id.toString() === value) ||
                        chains[0]
                    )
                  }}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Select a chain" />
                  </SelectTrigger>
                  <SelectContent>
                    {chains.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id.toString()}>
                        {chain.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  DTF Token
                </label>
                <Select
                  value={selectedDTF?.address}
                  onValueChange={(value) => {
                    const dtf = availableDTFs.find((d) => d.address === value)
                    if (dtf) setSelectedDTF(dtf)
                  }}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue placeholder="Select a DTF" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDTFs.map((dtf) => (
                      <SelectItem key={dtf.address} value={dtf.address}>
                        {dtf.symbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  API Endpoint
                </label>
                <Select
                  value={apiUrl || 'default'}
                  onValueChange={(value) =>
                    setApiUrl(value === 'default' ? '' : value)
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_URLS.map((url) => (
                      <SelectItem key={url.value} value={url.value}>
                        {url.label} - {url.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Select the API endpoint for the zapper
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Debug mode
                </label>
                <Select
                  value={debug.toString()}
                  onValueChange={(value) => setDebug(value === 'true')}
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[false, true]
                      .map((v) => v.toString())
                      .map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Default Quote Source
                </label>
                <Select
                  value={quoteSource}
                  onValueChange={(value) =>
                    setQuoteSource(value as QuoteSource)
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="best">Best Quote</SelectItem>
                    <SelectItem value="zap">Zap Quote</SelectItem>
                    <SelectItem value="odos">Odos Quote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {!selectedDTF ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg text-muted-foreground">
                No DTFs available on this network
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Modal Mode */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-success rounded-full" />
                  Modal Mode
                </CardTitle>
                <CardDescription>
                  Opens the zapper in a modal dialog
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ZapperWrapper
                  wagmiConfig={wagmiConfig}
                  chain={selectedChain.id as AvailableChain}
                  dtfAddress={selectedDTF.address}
                  mode="modal"
                  apiUrl={apiUrl || undefined}
                  defaultSource={quoteSource}
                />
                <Button onClick={open} className="w-full rounded-xl" size="lg">
                  Open Zapper Modal
                </Button>
              </CardContent>
            </Card>

            {/* Inline Mode */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full" />
                  Inline Mode
                </CardTitle>
                <CardDescription>Embedded zapper component</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 border-t border-muted">
                  <ZapperWrapper
                    wagmiConfig={wagmiConfig}
                    chain={selectedChain.id as AvailableChain}
                    dtfAddress={selectedDTF.address}
                    mode="inline"
                    apiUrl={apiUrl || undefined}
                    debug={debug}
                    defaultSource={quoteSource}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <Toaster position="bottom-right" />
    </div>
  )
}

export default App
