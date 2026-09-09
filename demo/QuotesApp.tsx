import { useCallback, useEffect, useMemo, useState } from 'react'
import { Address } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Moon, RefreshCw, Sun } from 'lucide-react'
import { useAccount } from 'wagmi'
import { zappableTokens } from '@reserve-protocol/react-zapper'
import { AvailableChain, CHAIN_TAGS, ChainId } from '@/utils/chains'
import { usePrice } from '@/hooks/usePrice'
import { Button } from './components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card'
import { Input } from './components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import ApproveInputs from './components/approve-inputs'
import QuotesTable, { ChainInput } from './components/quotes-table'
import { useDiscoverDTFs } from './lib/dtf-discover'
import { useDTFPrices } from './lib/dtf-prices'

const API_URLS = [
  { label: 'Default', value: 'https://api.reserve.org/' },
  { label: 'Staging', value: 'https://api-staging.reserve.org/' },
  { label: 'Local', value: 'http://localhost:3005/' },
]

// Only the native zap provider is quoted here, so every option is a zapper
// service: the table exists to watch what the ZRS instances answer.
const ZAPPER_API_URLS = [
  { label: 'Default', value: 'https://api.reserve.org/' },
  { label: 'ZRS-1', value: 'https://zrs-1.reserve-api.com/' },
  { label: 'ZRS-2', value: 'https://zrs-2.reserve-api.com/' },
  { label: 'ZRS-3', value: 'https://zrs-3.reserve-api.com/' },
  { label: 'ZRSX-1', value: 'https://zrsx-1.reserve-api.com/' },
  { label: 'Local', value: 'http://localhost:3005/' },
]

// Reserve slippage convention: a value S means a fraction of 1/S.
const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 1000 },
  { label: '0.5%', value: 200 },
  { label: '1%', value: 100 },
  { label: '3%', value: 33 },
]

// Auto-refresh is off until the user picks a cadence — a quote round costs one
// zapper request per DTF, so nothing repeats behind their back.
const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '15 seconds', value: 15_000 },
  { label: '60 seconds', value: 60_000 },
  { label: '300 seconds', value: 300_000 },
]

const CHAINS: AvailableChain[] = [ChainId.Mainnet, ChainId.Base, ChainId.BSC]

const defaultInputs = (): Record<number, ChainInput> =>
  Object.fromEntries(
    CHAINS.map((chainId) => [
      chainId,
      // Stables lead every zappable list, so this is the chain's stable input.
      { token: zappableTokens[chainId][0], amount: '1000' },
    ])
  )

function QuotesApp() {
  const [apiUrl, setApiUrl] = useState(API_URLS[0].value)
  const [zapperApiUrl, setZapperApiUrl] = useState(ZAPPER_API_URLS[1].value)
  const [slippage, setSlippage] = useState(SLIPPAGE_OPTIONS[1].value)
  const [forceMint, setForceMint] = useState(false)
  const [deepLiquidity, setDeepLiquidity] = useState(false)
  const [includeDeprecated, setIncludeDeprecated] = useState(false)
  const [inputs, setInputs] = useState<Record<number, ChainInput>>(defaultInputs)
  const [autoRefreshMs, setAutoRefreshMs] = useState(0)
  const [round, setRound] = useState(0)
  const [approvalTargets, setApprovalTargets] = useState<
    Record<number, Address | undefined>
  >({})
  const [armed, setArmed] = useState(false)
  const [dark, setDark] = useState<boolean>(() => {
    const stored = localStorage.getItem('theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const { data: dtfs, isLoading, error } = useDiscoverDTFs(apiUrl, {
    includeDeprecated,
  })

  // Connecting a wallet upgrades every row from a display-only quote to a real
  // signer's quote plus a simulation of its transaction.
  const { address } = useAccount()

  const onApprovalTarget = useCallback(
    (chainId: number, approvalAddress: Address) =>
      setApprovalTargets((current) =>
        current[chainId] === approvalAddress
          ? current
          : { ...current, [chainId]: approvalAddress }
      ),
    []
  )

  // One price per chain — the input side of every row on that chain. The DTF
  // side comes from the same price API, one request per chain.
  const mainnetPrice = usePrice(
    ChainId.Mainnet,
    inputs[ChainId.Mainnet].token.address,
    apiUrl
  )
  const basePrice = usePrice(
    ChainId.Base,
    inputs[ChainId.Base].token.address,
    apiUrl
  )
  const bscPrice = usePrice(
    ChainId.BSC,
    inputs[ChainId.BSC].token.address,
    apiUrl
  )
  const prices = useMemo(
    () => ({
      [ChainId.Mainnet]: mainnetPrice,
      [ChainId.Base]: basePrice,
      [ChainId.BSC]: bscPrice,
    }),
    [mainnetPrice, basePrice, bscPrice]
  )
  const { data: dtfPrices } = useDTFPrices(apiUrl, dtfs ?? [])

  const refreshNow = () => {
    setArmed(true)
    setRound((n) => n + 1)
  }

  const startAutoRefresh = (value: number) => {
    setAutoRefreshMs(value)
    if (value > 0) refreshNow()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-[1600px] p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              React Zapper Quote Table
            </h1>
            <p className="mt-1 text-muted-foreground">
              Live mint quotes for every Index DTF, from the same zapper the
              widget calls
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton showBalance={false} />
            <Button variant="outline" asChild>
              <a href="/">Zapper demo</a>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDark((d) => !d)}
              aria-label="Toggle theme"
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <Card className="h-fit border-border-secondary bg-secondary/30">
            <CardHeader>
              <CardTitle className="text-lg">Configuration</CardTitle>
              <CardDescription>
                Quotes come from the native zap provider only — aggregator and
                RFQ sources are not requested.{' '}
                {address
                  ? 'Quoted for the connected wallet and simulated.'
                  : 'Connect a wallet to quote for a real signer and simulate each row.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Zapper API Endpoint
                </label>
                <Select value={zapperApiUrl} onValueChange={setZapperApiUrl}>
                  <SelectTrigger className="w-full">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Zapper service quoted for every row
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  API Endpoint
                </label>
                <Select value={apiUrl} onValueChange={setApiUrl}>
                  <SelectTrigger className="w-full">
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Reserve API endpoint (DTF list, and the prices both sides of
                  every quote are valued with)
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Slippage
                </label>
                <Select
                  value={slippage.toString()}
                  onValueChange={(value) => setSlippage(Number(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLIPPAGE_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Force Mint
                </label>
                <Select
                  value={forceMint.toString()}
                  onValueChange={(value) => setForceMint(value === 'true')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[false, true].map((v) => (
                      <SelectItem key={v.toString()} value={v.toString()}>
                        {v.toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mints the basket instead of trading into it (
                  <code>trade=false</code>)
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Deep Liquidity
                </label>
                <Select
                  value={deepLiquidity.toString()}
                  onValueChange={(value) => setDeepLiquidity(value === 'true')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[false, true].map((v) => (
                      <SelectItem key={v.toString()} value={v.toString()}>
                        {v.toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Include Deprecated DTFs
                </label>
                <Select
                  value={includeDeprecated.toString()}
                  onValueChange={(value) =>
                    setIncludeDeprecated(value === 'true')
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[false, true].map((v) => (
                      <SelectItem key={v.toString()} value={v.toString()}>
                        {v.toString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 border-t border-border-secondary pt-4">
                <p className="text-sm font-medium">Input per chain</p>
                {CHAINS.map((chainId) => (
                  <div key={chainId} className="space-y-2">
                    <label className="block text-xs text-muted-foreground">
                      {CHAIN_TAGS[chainId]}
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={inputs[chainId].amount}
                        inputMode="decimal"
                        onChange={(event) =>
                          setInputs((current) => ({
                            ...current,
                            [chainId]: {
                              ...current[chainId],
                              amount: event.target.value,
                            },
                          }))
                        }
                      />
                      <Select
                        value={inputs[chainId].token.address}
                        onValueChange={(value) =>
                          setInputs((current) => ({
                            ...current,
                            [chainId]: {
                              ...current[chainId],
                              token: zappableTokens[chainId].find(
                                (token) => token.address === value
                              )!,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {zappableTokens[chainId].map((token) => (
                            <SelectItem
                              key={token.address}
                              value={token.address}
                            >
                              {token.symbol}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                <ApproveInputs
                  chains={CHAINS}
                  inputs={inputs}
                  approvalTargets={approvalTargets}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      autoRefreshMs > 0 ? 'animate-pulse bg-primary' : 'bg-muted'
                    }`}
                  />
                  Quotes ({dtfs?.length ?? 0} DTFs)
                </CardTitle>
                <CardDescription>
                  {autoRefreshMs > 0
                    ? `Refreshing every ${autoRefreshMs / 1000}s`
                    : 'Auto-refresh off'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={refreshNow}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh now
                </Button>
                <Select
                  value={autoRefreshMs.toString()}
                  onValueChange={(value) => startAutoRefresh(Number(value))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFRESH_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        {option.value === 0
                          ? 'Auto-refresh off'
                          : `Every ${option.label}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              {isLoading ? (
                <p className="px-6 text-muted-foreground">Loading DTFs…</p>
              ) : error ? (
                <p className="px-6 text-destructive">
                  {error instanceof Error
                    ? error.message
                    : 'Failed to load DTFs'}
                </p>
              ) : (
                <QuotesTable
                  dtfs={dtfs ?? []}
                  inputs={inputs}
                  prices={prices}
                  dtfPrices={dtfPrices ?? {}}
                  zapperApiUrl={zapperApiUrl}
                  slippage={slippage}
                  forceMint={forceMint}
                  deepLiquidity={deepLiquidity}
                  account={address}
                  onApprovalTarget={onApprovalTarget}
                  round={round}
                  armed={armed}
                  autoRefreshMs={autoRefreshMs > 0 ? autoRefreshMs : null}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default QuotesApp
