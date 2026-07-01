import { ConnectButton } from '@rainbow-me/rainbowkit'
import {
  useZapperModal,
  PROVIDERS,
  type ProviderId,
  type SupportedLocale,
} from '@reserve-protocol/react-zapper'
import React, { useState, useEffect } from 'react'
import { useChains } from 'wagmi'
import { Moon, Sun } from 'lucide-react'
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
import QuoteStatePanel from './components/quote-state-panel'
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

const ZAPPER_API_URLS = [
  {
    label: 'Default',
    value: 'https://api.reserve.org/',
  },
  {
    label: 'Staging',
    value: 'https://zapper-staging.reserve-api.com/',
  },
  {
    label: 'Local',
    value: 'http://localhost:3005/',
  },
]

function App() {
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
  const [zapperApiUrl, setZapperApiUrl] = useState(ZAPPER_API_URLS[0].value)
  const [mode, setMode] = useState<'modal' | 'inline' | 'simple'>('inline')
  const [sellOnly, setSellOnly] = useState(false)
  const [showContactInfo, setShowContactInfo] = useState(true)
  const [locale, setLocale] = useState<SupportedLocale>('en')
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const { open } = useZapperModal()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

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
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <ConnectButton />
          </div>
        </div>

        {/* Main Content Grid */}
        {!selectedDTF ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-lg text-muted-foreground">
                No DTFs available on this network
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Configuration */}
            <Card className="bg-secondary/30 border-border-secondary h-fit">
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
                  Reserve API endpoint (prices, DTF data, folio manager)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Zapper API Endpoint
                </label>
                <Select
                  value={zapperApiUrl || 'default'}
                  onValueChange={(value) =>
                    setZapperApiUrl(value === 'default' ? '' : value)
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ZAPPER_API_URLS.map((url) => (
                      <SelectItem key={url.value} value={url.value}>
                        {url.label} - {url.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Zapper service endpoint (swap, deploy, healthcheck)
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
                    {(
                      ['zap', 'odos', 'velora', 'enso'] as ProviderId[]
                    ).map((id) => (
                      <SelectItem key={id} value={id}>
                        {PROVIDERS[id].label} Quote
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Display Mode
                </label>
                <Select
                  value={mode}
                  onValueChange={(value) =>
                    setMode(value as 'modal' | 'inline' | 'simple')
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modal">Modal</SelectItem>
                    <SelectItem value="inline">Inline</SelectItem>
                    <SelectItem value="simple">Simple</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Modal: Opens in a dialog | Inline: Embedded with controls | Simple: Minimal interface
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Sell Only (Deprecated DTF)
                </label>
                <Select
                  value={sellOnly.toString()}
                  onValueChange={(value) => setSellOnly(value === 'true')}
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
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, disables Buy tab and only allows selling/redeeming
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Show Contact Info
                </label>
                <Select
                  value={showContactInfo.toString()}
                  onValueChange={(value) =>
                    setShowContactInfo(value === 'true')
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[true, false]
                      .map((v) => v.toString())
                      .map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Shows the "Stay informed" contact panel after a successful mint
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Language
                </label>
                <Select
                  value={locale}
                  onValueChange={(value) =>
                    setLocale(value as SupportedLocale)
                  }
                >
                  <SelectTrigger className="w-full md:w-96">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="ko">한국어</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Optional <code>locale</code> prop. Untranslated strings fall
                  back to English.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right: Zapper Component */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  mode === 'modal' ? 'bg-success' :
                  mode === 'inline' ? 'bg-primary' :
                  'bg-warning'
                }`} />
                Zapper Component ({mode.charAt(0).toUpperCase() + mode.slice(1)} Mode)
              </CardTitle>
              <CardDescription>
                {mode === 'modal' ? 'Opens the zapper in a modal dialog' :
                 mode === 'inline' ? 'Embedded zapper component with full controls' :
                 'Minimal zapper interface without extra UI elements'}
              </CardDescription>
            </CardHeader>
            <CardContent className={mode === 'modal' ? '' : 'p-0'}>
              {mode === 'modal' ? (
                <>
                  <ZapperWrapper
                    chain={selectedChain.id as AvailableChain}
                    dtfAddress={selectedDTF.address}
                    mode="modal"
                    apiUrl={apiUrl || undefined}
                    zapperApiUrl={zapperApiUrl || undefined}
                    defaultSource={quoteSource}
                    debug={debug}
                    sellOnly={sellOnly}
                    showContactInfo={showContactInfo}
                    locale={locale}
                  />
                  <Button onClick={open} className="w-full rounded-xl" size="lg">
                    Open Zapper Modal
                  </Button>
                </>
              ) : (
                <div className="p-4 border-t border-muted">
                  <ZapperWrapper
                    chain={selectedChain.id as AvailableChain}
                    dtfAddress={selectedDTF.address}
                    mode={mode}
                    apiUrl={apiUrl || undefined}
                    zapperApiUrl={zapperApiUrl || undefined}
                    debug={debug}
                    defaultSource={quoteSource}
                    sellOnly={sellOnly}
                    showContactInfo={showContactInfo}
                    locale={locale}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          </div>
          <QuoteStatePanel />
          </>
        )}
      </div>
    </div>
  )
}

export default App
