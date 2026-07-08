# @reserve-protocol/react-zapper

A React component library for integrating DTF (Decentralized Token Folio) zap functionality into your Web3 applications. This package provides a complete zapping solution with support for both modal and inline modes, built on top of Wagmi v2.

**📖 [Live Demo](https://react-zapper.reserve.org/)**

## Features

- 🔄 **Zap Minting**: Convert any supported token directly into DTF tokens
- 🔄 **Zap Redeeming**: Convert DTF tokens back to any supported token
- 🎨 **Flexible UI**: Three display modes - modal popup, inline embedded, and simple launcher
- 🎯 **Modern Stack**: Built with Wagmi v2, Viem, RainbowKit v2, and TanStack Query v5
- ⚡ **Optimized**: Real-time price updates and slippage protection
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
| `disabled`       | `boolean`                       | ❌       | Disable primary zap actions, wallet/chain actions, amount inputs, and Max buttons |
| `showContactInfo`| `boolean`                       | ❌       | Show the "Stay informed" contact-capture panel after a successful mint (defaults to `true`) |
| `connectWallet`  | `() => void`                    | ❌       | Function to trigger wallet connection          |
| `debug`          | `boolean`                       | ❌       | Enable debug mode to show additional info      |
| `defaultSource`  | `QuoteSource`                   | ❌       | Default quote source: `'best'` (compare all enabled providers), `'zap'`, `'odos'`, `'velora'`, or `'enso'` |
| `refreshRate`    | `number`                        | ❌       | Quote refresh interval in milliseconds (defaults to `9000`) |
| `disabledSettings` | `DisabledSettingsConfig`      | ❌       | Disable individual zap settings (`deepLiquidity`, `forceMint`); disabled options render frozen unchecked and the behavior is forced off |
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

The zapper supports four quote providers: the Reserve-native `zap` and three external aggregators — `odos`, `velora`, and `enso`. In `best` mode (the default), every enabled provider is queried in parallel; candidate transactions that don't require a new token approval are then simulated (`eth_estimateGas` through the host's wagmi transport for the target chain) and quotes whose transaction reverts are excluded, with the highest `minAmountOut` among the remaining ones winning. If every simulatable quote reverts, selection falls back to the raw best. Simulation is skipped when the user's balance can't cover the input amount. Individual provider failures are tolerated as long as at least one provider responds.

Provider availability per chain is controlled by the `PROVIDER_ENABLED` matrix exported from the package:

```ts
import { PROVIDER_ENABLED } from '@reserve-protocol/react-zapper'

// All four providers are enabled on every supported chain by default.
// To disable one on a specific chain, set it to false:
PROVIDER_ENABLED[56 /* BSC */].odos = false
```

Note: as of v1.7.0 `PROVIDER_ENABLED` is a mutable module-level object — mutate it once at app startup (before the `<Zapper>` component renders a quote). A runtime prop-based configuration may be added in a later release.

Other helpers exported for host apps that want to build custom provider UI:
- `PROVIDERS` — `Record<ProviderId, ProviderConfig>` with label + icon + endpoint builder
- `getEnabledProviders(chainId)` — enabled providers for a given chain
- `getEnabledAggregators(chainId)` — same, excluding the native zap provider
- `isProviderEnabled(chainId, id)` — boolean check

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
  quote: ZapResult | undefined  // winning quote result, once it resolves
  source: ProviderId | undefined // winning provider id, once it resolves
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

## License

MIT License - see LICENSE file for details.
