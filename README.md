# @reserve-protocol/react-zapper

A React component library for integrating DTF (Decentralized Token Folio) zap functionality into your Web3 applications. This package provides a complete zapping solution with support for both modal and inline modes, built on top of Wagmi v2.

**📖 [Live Demo](https://react-zapper.reserve.org/)**

## Features

- 🔄 **Zap Minting**: Convert any supported token directly into DTF tokens
- 🔄 **Zap Redeeming**: Convert DTF tokens back to any supported token
- 🎨 **Flexible UI**: Three display modes - modal popup, inline embedded, and simple launcher
- 🎯 **Modern Stack**: Built with Wagmi v2, Viem, RainbowKit v2, and TanStack Query v5
- ⚡ **Optimized**: Real-time price updates and slippage protection
- 👀 **Browse before connecting**: quotes work without a wallet; the CTA prompts the connect flow
- 🛡️ **Type Safe**: Full TypeScript support
- 🎨 **Styled**: Uses Tailwind CSS with CSS injection

## Installation

```bash
pnpm add @reserve-protocol/react-zapper
```

### Peer Dependencies

Make sure you have these peer dependencies installed:

```bash
pnpm add react@^18.0.0 react-dom@^18.0.0 @tanstack/react-query@^5.87.4 wagmi@^2.19.0 viem@^2.50.0
```

The Zapper consumes your application's existing `wagmi` and `@tanstack/react-query`
context — it does **not** create its own. You provide a `WagmiProvider` and a
`QueryClientProvider` (see [Setup Providers](#setup-providers) below).

## Quick Start

### 1. Import Components and Styles

Import the components you need and the CSS file for styling:

```tsx
import { Zapper, useZapperModal } from '@reserve-protocol/react-zapper'
import '@reserve-protocol/react-zapper/styles.css'
```

**Note for Tailwind users**: If your project already has Tailwind CSS configured, you can skip the CSS import and add the package to your Tailwind content configuration:

```js
// tailwind.config.js
module.exports = {
  content: [
    // ... your other content paths
    './node_modules/@reserve-protocol/react-zapper/dist/**/*.js',
  ],
  // ... rest of your config
}
```

### Setup Providers

The Zapper reads `wagmi` and `@tanstack/react-query` from React context, so wrap
your app once with your own `WagmiProvider` and `QueryClientProvider`. This is the
standard wagmi v2 setup — the same providers your app already uses.

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './wagmi-config'

const queryClient = new QueryClient()

function App({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* your app + the Zapper */}
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

> **Migrating from v1?** The `wagmiConfig` prop was removed in v2. The Zapper no
> longer creates its own providers — render it inside your app's existing
> `WagmiProvider` + `QueryClientProvider` (above) and drop the `wagmiConfig` prop.

### 2. Basic Modal Usage

```tsx
import { Zapper, useZapperModal } from '@reserve-protocol/react-zapper'
import '@reserve-protocol/react-zapper/styles.css'

function MyApp() {
  const { open } = useZapperModal()

  return (
    <>
      <Zapper
        chain={1} // Ethereum mainnet
        dtfAddress="0x123..." // Your DTF contract address
        mode="modal"
      />

      <button onClick={open}>Open Zapper</button>
    </>
  )
}
```

### 3. Inline Usage

```tsx
import { Zapper } from '@reserve-protocol/react-zapper'
import '@reserve-protocol/react-zapper/styles.css'

function ZapperPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1>Zap into My DTF</h1>
      <Zapper chain={1} dtfAddress="0x123..." mode="inline" />
    </div>
  )
}
```

### 4. Simple Mode Usage

The simple mode provides a streamlined launcher interface that pre-loads quotes before opening the full modal:

```tsx
import { Zapper } from '@reserve-protocol/react-zapper'
import '@reserve-protocol/react-zapper/styles.css'

function SimpleZapper() {
  return <Zapper chain={1} dtfAddress="0x123..." mode="simple" />
}
```

Simple mode features:
- **Launcher Pattern**: Shows a minimal input interface with "Get started" button
- **Pre-loading**: Fetches quotes in the background as the user types
- **Modal Transition**: Clicking "Get started" opens the full modal with:
  - Input amount preserved
  - Quote already loaded
  - All transaction details and controls available
- **Clean Entry Point**: Perfect for embedding in landing pages or simplified UIs
- **User-Friendly**: Reduces cognitive load with a two-step process

## Props

### ZapperProps

| Property         | Type                            | Required | Description                                    |
| ---------------- | ------------------------------- | -------- | ---------------------------------------------- |
| `chain`          | `number`                        | ✅       | Chain ID where the DTF is deployed             |
| `dtfAddress`     | `Address`                       | ✅       | DTF contract address                           |
| `mode`           | `'modal' \| 'inline' \| 'simple'` | ❌    | Display mode: 'modal' (popup), 'inline' (embedded), 'simple' (launcher) |
| `apiUrl`         | `string`                        | ❌       | Custom API endpoint (defaults to Reserve API)  |
| `zapperApiUrl`   | `string`                        | ❌       | Custom zapper service endpoint for zapper-specific API calls (falls back to `apiUrl`) |
| `sellOnly`       | `boolean`                       | ❌       | Only show the sell (redeem) flow               |
| `showTabs`       | `boolean`                       | ❌       | Show the Buy/Sell tab switcher in inline mode. Hidden by default — the swap arrow between the amount boxes still flips between buy and sell |
| `disabled`       | `boolean`                       | ❌       | Disable primary zap actions, wallet/chain actions, amount inputs, and Max buttons |
| `showContactInfo`| `boolean`                       | ❌       | Show the "Stay informed" contact-capture panel after a successful mint (defaults to `true`) |
| `connectWallet`  | `() => void`                    | ❌       | Function to trigger wallet connection          |
| `debug`          | `boolean`                       | ❌       | Enable debug mode to show additional info      |
| `defaultSource`  | `QuoteSource`                   | ❌       | Initial selection in the quote list. All enabled providers are always fetched; a provider id pre-selects that route, `'best'` (default) follows the best quote automatically |
| `refreshRate`    | `number`                        | ❌       | Quote refresh interval in milliseconds (defaults to `30000`) |
| `onTransactionConfirmed` | `(event: ZapperTransactionConfirmed) => void` | ❌ | Called once after a buy or sell has a confirmed onchain transaction hash |
| `disabledSettings` | `DisabledSettingsConfig`      | ❌       | Hide individual power-user toggles (`deepLiquidity`, `forceMint`). These now live in the debug panel (`debug` prop) — the settings page was removed |
| `className`      | `string`                        | ❌       | Additional CSS classes                         |
| `locale`         | `'en' \| 'es' \| 'ko' \| 'zh'`  | ❌       | UI language. Defaults to `'en'`; untranslated strings fall back to English |

### Localization

The zapper UI ships with built-in translations (English, Spanish, Korean,
Chinese). Pass the optional `locale` prop to switch languages:

```tsx
<Zapper chain={1} dtfAddress="0x..." locale="es" />
```

Localization is fully self-contained and optional:

- It requires **no extra dependencies** — the i18n runtime and all catalogs are
  bundled inside the package.
- Omitting `locale` (or passing `'en'`) renders English, exactly as before.
- Any string without a translation falls back to English, so behavior never
  breaks.

If you render `ZapperContent` directly (without the `Zapper` wrapper), wrap it in
the exported `ZapperI18nProvider` to enable localization:

```tsx
import { ZapperI18nProvider, ZapperContent } from '@reserve-protocol/react-zapper'

<ZapperI18nProvider locale="es">
  <ZapperContent mode="inline" />
</ZapperI18nProvider>
```

### Quote Providers

The zapper supports five quote providers: the Reserve-native `zap`, two external aggregators — `velora` and `enso` — and two RFQ/intent venues, `cowswap` and `pcsx` (PancakeSwap X, BSC only). Every enabled provider is queried in parallel; candidate transactions that don't require a new token approval are then simulated (`eth_estimateGas` through the host's wagmi transport for the target chain) and quotes whose transaction reverts are excluded, with the highest `minAmountOut` among the remaining ones winning. If every simulatable quote reverts, selection falls back to the raw best. Simulation is skipped when the user's balance can't cover the input amount (and doesn't apply to RFQ quotes, which carry no transaction). Individual provider failures are tolerated as long as at least one provider responds.

#### Route list

All quotes are shown in a route list inside the collapsible **Details** section (modal and inline modes), with each row appearing as its provider's quote resolves — no loading skeletons, so the panel never expands and shrinks. Rows are sorted best→worst once the comparison round settles. The best route is selected automatically; the user can pick any other route, and the pick is sticky across the auto-refresh cycles — if the picked provider fails or its quote expires, the widget falls back to the best route until the pick recovers. Failed providers are hidden from the list (they reappear when they produce a quote again), and quotes losing more than 8% of value to price impact are discarded as toxic. Picking resets to automatic when the amount, token, or other swap settings change.

The Details section also shows the current price, the projected slippage (the dust-adjusted value difference between what the trade pays and returns), the max slippage derived from the quote's `minAmountOut`, and the minimum amount out. Slippage tolerance is picked from a fixed-option dropdown above Details (0.1% / 0.5% / 1% / 5%, default 0.5%).

Quotes refresh on the global interval (`refreshRate`, 30s by default) **and** whenever the earliest displayed quote expires — the API may cache a provider's quote until its `validUntil` (e.g. enso), so the widget refetches right after expiry instead of leaving a dead quote on screen until the next tick. Background refetches keep the previous quote displayed and the CTA clickable — no loading flicker; only the first quote of a new input shows a loading state.

#### RFQ (intent) providers — CoW Swap and PancakeSwap X

`cowswap` is an RFQ source: instead of an atomic transaction, the user places an order that CoW Protocol solvers fill off-chain. The flow differs from the aggregators only after the submit click:

1. Quote and approval work exactly like any other source (the approval spender is CoW's Vault Relayer).
2. On submit, for ERC-20 inputs the wallet asks for a gasless EIP-712 typed-data signature and the order is posted to CoW's order book with a 2-minute validity.
3. The button shows "Waiting for order to fill..." while the fill status is polled.
4. On fill, the regular success view is shown (with a link to the order on CoW Explorer). If the order expires or is cancelled without filling, the flow resets and a fresh quote is fetched.

Native inputs (ETH/BNB) go through CoW's **eth-flow** instead: a single `createOrder` transaction to the EthFlow contract carrying the native amount — no approval and no signature. The order has a 10-minute validity; if it expires without filling, CoW's refunder returns the funds automatically within a few minutes (the UI explains this) and a fresh quote is fetched.

`pcsx` (PancakeSwap X, **BSC only**) works the same way as CoW's gasless flow but is proxied through the Reserve API (`{apiUrl}pcsx/*`): the quote response carries a ready-to-sign Permit2 Dutch order (`PermitWitnessTransferFrom` typed data), the approval spender is the Permit2 contract, and the signed order is submitted and polled through the same API. Native BNB inputs are not supported by PCSX (Permit2 requires an ERC-20 input).

Notes:
- `cowswap` is enabled on all supported chains (Ethereum, Base, Arbitrum, and BSC); `pcsx` only on BSC.
- The architecture is adapter-based (`RfqAdapter`) so more intent venues can be added without touching the pipeline.

USD values and price impact are computed uniformly across all sources from Reserve API token prices (each provider's own valuation is only a fallback when a Reserve price is missing), so the displayed impact doesn't jump when the winning source changes.

Provider availability per chain is controlled by the `PROVIDER_ENABLED` matrix exported from the package:

```ts
import { PROVIDER_ENABLED } from '@reserve-protocol/react-zapper'

// To disable a provider on a specific chain, set it to false:
PROVIDER_ENABLED[56 /* BSC */].velora = false
```

Note: as of v1.7.0 `PROVIDER_ENABLED` is a mutable module-level object — mutate it once at app startup (before the `<Zapper>` component renders a quote). A runtime prop-based configuration may be added in a later release.

Other helpers exported for host apps that want to build custom provider UI:
- `PROVIDERS` — `Record<ProviderId, ProviderConfig>` with label + icon + endpoint builder
- `getEnabledProviders(chainId)` — enabled providers for a given chain
- `getEnabledAggregators(chainId)` — same, excluding the native zap provider
- `isProviderEnabled(chainId, id)` — boolean check
- `RFQ_ADAPTERS` / `isRfqProvider(id)` — RFQ adapter registry (plus the `RfqAdapter`, `RfqOrder`, and `RfqOrderStatus` types)

### useZapperModal Hook

The `useZapperModal` hook provides control over the modal state:

```tsx
const { isOpen, open, close } = useZapperModal()
```

### useQuote Hook

The `useQuote` hook exposes the live quote state of the currently rendered
Zapper, so you can build your own UI around it (status banners, custom loaders,
analytics). It returns `{ data, loading, error }` for the active Buy/Sell flow:

```tsx
import { Zapper, useQuote } from '@reserve-protocol/react-zapper'

function ZapperWithStatus() {
  const { data, loading, error } = useQuote()

  return (
    <div>
      <Zapper chain={1} dtfAddress="0x123..." mode="inline" />

      {/* `data.input` is available as soon as the user types */}
      {data && (
        <span>
          Spending {data.input.amount} {data.input.token.symbol} ($
          {data.input.value.toFixed(2)})
        </span>
      )}

      {loading && <span>Fetching best quote…</span>}
      {error && <span>Quote error: {error}</span>}

      {data?.quote && (
        <span>
          Estimated output: ${(data.quote.amountOutValue ?? 0).toFixed(2)} (via{' '}
          {data.source})
        </span>
      )}
    </div>
  )
}
```

The returned `data` (type `QuoteData`, `undefined` when no flow is active):

```ts
{
  input: {
    token: Token   // the token being spent
    amount: string // human-readable amount the user typed
    value: number  // USD value of the input
  }
  quote: ZapResult | undefined  // active quote (user's pick or best), once it resolves
  source: ProviderId | undefined // active provider id, once it resolves
}
```

- `data.input` is populated immediately as the user types (handy when you care
  about the input value before a quote returns)
- `quote` / `source` populate once a quote resolves
- `loading` is `true` while a quote is being fetched or refetched
- `error` is the quote error message, if any

Call it anywhere within the same app as a rendered `<Zapper />` (it reads the
package's internal state); no extra providers are required.

## Advanced Usage

### Transaction Feedback

The Zapper renders all transaction feedback inline — no toaster setup required
(there is no `Toaster` export and `sonner` is no longer a dependency).

On a successful transaction (mint or redeem) the modal switches to a success view
with a green alert showing Received (the exact output token credited to the
wallet, read from the tx logs), Used (USD spent), and Transaction (explorer link).
Details are collapsible and the close button is preserved. Errors are rendered
inline as well. The state resets when the Zapper is closed/reopened.

The success view also shows a "Stay informed" section where users can leave an
email or Telegram contact for DTF updates. Hide it with `showContactInfo={false}`.
Submissions fail silently for the user and emit Mixpanel events
(`zap_contact_submit`, `zap_contact_subscribed`, `zap_contact_error`).

### With Custom API Endpoint

```tsx
<Zapper
  chain={1}
  dtfAddress="0x123..."
  apiUrl="https://custom-api.example.com"
  mode="inline"
/>
```

### With Custom Wallet Connection

```tsx
import { useConnectModal } from '@rainbow-me/rainbowkit'

function ZapperWithCustomWallet() {
  const { openConnectModal } = useConnectModal()

  return (
    <Zapper
      chain={1}
      dtfAddress="0x123..."
      mode="modal"
      connectWallet={openConnectModal}
    />
  )
}
```

### Setting Custom API URL Globally

```tsx
import { setCustomApiUrl } from '@reserve-protocol/react-zapper'

// Set once at app initialization
setCustomApiUrl('https://custom-api.example.com')
```

## Supported Chains

The zapper currently supports:

- **Ethereum Mainnet** (Chain ID: 1)
- **Base** (Chain ID: 8453)
- **BNB Smart Chain** (Chain ID: 56)

Each chain has its own set of supported tokens for zapping. The component automatically detects the current chain and shows appropriate tokens.

## Styling

The package uses Tailwind CSS for styling. You need to import the styles:

```tsx
import '@reserve-protocol/react-zapper/styles.css'
```

- **Projects WITHOUT Tailwind**: The imported CSS file includes all necessary styles
- **Projects WITH Tailwind**: You can optionally skip the CSS import and configure Tailwind to process the package files (see Quick Start section)
- **Custom Styling**: The package uses CSS variables for theming, making it easy to override colors and styles

The component respects your application's font family by default.

### Custom Fonts

To use custom fonts, ensure they are loaded in your application and the package will inherit them automatically.

## API Integration

The package integrates with the Reserve Protocol's zapper API for:

- Real-time swap quotes
- Price impact calculations
- Transaction routing optimization
- Health status monitoring

## TypeScript Support

Full TypeScript support is included with exported types:

```tsx
import type {
  ZapperProps,
  UseZapperModalReturn,
  Token,
  TokenBalance,
} from '@reserve-protocol/react-zapper'
```

### Zappable Tokens

The library exports the list of supported zappable tokens per chain:

```tsx
import { zappableTokens } from '@reserve-protocol/react-zapper'

// Record<number, Token[]> — keyed by chain ID
const ethTokens = zappableTokens[1] // Ethereum mainnet tokens
const baseTokens = zappableTokens[8453] // Base tokens
```

Inside the widget, the token selector orders this list by the USD value of the
connected wallet's holdings (largest first) and defaults to the token the user
holds the most of. Without a connected wallet — or if balances/prices can't be
fetched — the list keeps the order above.

## Development

### Prerequisites

- Node.js 22+
- pnpm (this repo uses pnpm with supply-chain protections; do not use npm)

### Setup

```bash
# Install dependencies
pnpm install

# Start development server with demo
pnpm dev

# Build the package
pnpm build
```

### Demo Application

The package includes a demo application that showcases both modal and inline modes:

```bash
pnpm dev
```

Visit `http://localhost:5173` to see the demo.

### Quote Table

`http://localhost:5173/quotes.html` (`/quotes.html` in the deployed demo) is a
second page for watching quotes across the whole DTF universe instead of one DTF
at a time: every Index DTF from the Reserve API's discover endpoint, one row
each, with output amount, USD value, price impact, true price impact, dust,
latency and a link to the raw quote URL.

- Only the **native zap provider** is quoted (the endpoint selector picks which
  zapper service answers — Default, ZRS-1/2/3 or local). Aggregator and RFQ
  sources are deliberately not requested: they don't exercise the zapper, and a
  full source comparison per DTF per interval hits their rate limits.
- **Auto-refresh is off on load** and nothing is quoted until "Refresh now" is
  pressed; the dropdown next to it starts a 15s / 60s / 300s cadence. Rounds are
  queued a few requests at a time so a cycle never fans out one request per DTF
  at once.
- The **input side is configured per chain** (amount + token from
  `zappableTokens`) since the supported inputs differ.
- **Both sides are valued from the Reserve price API** (`current/prices`, from
  the "API Endpoint" selector): the input token price per chain and the DTF price
  per row, so the USD value and both impact columns measure the zapper against an
  independent price source. The zapper's own `amountInValue` / `amountOutValue` /
  impacts are never displayed, and a row whose sides aren't both priced by the
  API shows `–` instead of falling back to them.
- **Wallet is optional.** Without one, quotes use `PLACEHOLDER_SIGNER` and are
  display-only. Connect one and every row is quoted for that signer — so the
  response carries a real transaction and gas — and each transaction is
  simulated with `estimateGas`, giving a Simulation column of `ok` / `reverts` /
  the reason it couldn't be proven (`approval needed`, `insufficient balance`,
  RPC noise). The only transaction this page ever sends is an approval:
  "Create approvals" under the input selector approves every configured input
  token for that chain's zapper spender (`ZapResult.approvalAddress`, so a chain
  must have quoted once), one transaction per chain, at the widget's
  `amountIn * 1.2`.
  Zaps themselves are never submitted here — use the widget page for that.

## License

MIT License - see LICENSE file for details.
