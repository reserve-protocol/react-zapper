# @reserve-protocol/react-zapper

A React component library for integrating DTF (Decentralized Token Folio) zap functionality into your Web3 applications. This package provides a complete zapping solution with support for both modal and inline modes, built on top of Wagmi v2.

**📖 [Live Demo](https://react-zapper.reserve.org/)**

## Features

- 🔄 **Zap Minting**: Convert any supported token directly into DTF tokens
- 🔄 **Zap Redeeming**: Convert DTF tokens back to any supported token
- 🎨 **Flexible UI**: Modal or inline display modes
- 🎯 **Modern Stack**: Built with Wagmi v2, Viem, RainbowKit v2, and TanStack Query v5
- ⚡ **Optimized**: Real-time price updates and slippage protection
- 🛡️ **Type Safe**: Full TypeScript support
- 🎨 **Styled**: Uses Tailwind CSS with CSS injection

## Installation

```bash
npm install @reserve-protocol/react-zapper
```

### Peer Dependencies

Make sure you have these peer dependencies installed:

```bash
npm install react react-dom @tanstack/react-query@^5 wagmi@^2 viem@^2 jotai
```

## Quick Start

### 1. Choose Your Import Method

The package provides two entry points to accommodate different project setups:

#### For Projects WITHOUT Tailwind CSS

Use the `/styled` entry point which includes pre-compiled CSS:

```tsx
import { Zapper, useZapperModal, Toaster } from '@reserve-protocol/react-zapper/styled'
// CSS is automatically included
```

#### For Projects WITH Tailwind CSS

Use the default entry point and ensure your Tailwind config includes the package files:

```tsx
import { Zapper, useZapperModal, Toaster } from '@reserve-protocol/react-zapper'
```

Add to your `tailwind.config.js`:
```js
module.exports = {
  content: [
    // ... your other content paths
    './node_modules/@reserve-protocol/react-zapper/dist/**/*.js'
  ],
  // ... rest of your config
}
```

#### Alternative: Manual CSS Import

You can also import the CSS file manually with either entry point:

```tsx
import { Zapper } from '@reserve-protocol/react-zapper'
import '@reserve-protocol/react-zapper/styles.css'
```

### 2. Basic Modal Usage

```tsx
import { Zapper, useZapperModal, Toaster } from '@reserve-protocol/react-zapper/styled'
import { wagmiConfig } from './wagmi-config'

function MyApp() {
  const { open } = useZapperModal()

  return (
    <>
      <Zapper
        wagmiConfig={wagmiConfig}
        chain={1} // Ethereum mainnet
        dtfAddress="0x123..." // Your DTF contract address
        mode="modal"
      />

      <button onClick={open}>Open Zapper</button>

      <Toaster position="bottom-right" />
    </>
  )
}
```

### 3. Inline Usage

```tsx
import { Zapper } from '@reserve-protocol/react-zapper/styled'
import { useConfig } from 'wagmi'

function ZapperPage() {
  const wagmiConfig = useConfig()

  return (
    <div className="max-w-md mx-auto">
      <h1>Zap into My DTF</h1>
      <Zapper
        wagmiConfig={wagmiConfig}
        chain={1}
        dtfAddress="0x123..."
        mode="inline"
      />
    </div>
  )
}
```

## Props

### ZapperProps

| Property        | Type                  | Required | Description                                   |
| --------------- | --------------------- | -------- | --------------------------------------------- |
| `wagmiConfig`   | `WagmiConfig`         | ✅       | Wagmi v2 configuration for the app            |
| `chain`         | `number`              | ✅       | Chain ID where the DTF is deployed            |
| `dtfAddress`    | `Address`             | ✅       | DTF contract address                          |
| `mode`          | `'modal' \| 'inline'` | ❌       | Display mode (defaults to 'modal')            |
| `apiUrl`        | `string`              | ❌       | Custom API endpoint (defaults to Reserve API) |
| `connectWallet` | `() => void`          | ❌       | Function to trigger wallet connection         |
| `className`     | `string`              | ❌       | Additional CSS classes                        |

### useZapperModal Hook

The `useZapperModal` hook provides control over the modal state:

```tsx
const { isOpen, open, close } = useZapperModal()
```

## Advanced Usage

### With Custom Error Handling

```tsx
import { Zapper, Toaster } from '@reserve-protocol/react-zapper'
import { toast } from 'sonner'
import { wagmiConfig } from './wagmi-config'

function AdvancedZapper() {
  return (
    <>
      <Zapper
        wagmiConfig={wagmiConfig}
        chain={1}
        dtfAddress="0x123..."
        mode="modal"
      />
      <Toaster />
    </>
  )
}
```

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
      wagmiConfig={wagmiConfig}
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

The package uses Tailwind CSS for styling. Depending on your project setup:

- **Projects WITHOUT Tailwind**: Use the `/styled` import which includes all necessary CSS
- **Projects WITH Tailwind**: Use the default import and configure Tailwind to process the package files
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

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server with demo
npm run dev

# Build the package
npm run build
```

### Demo Application

The package includes a demo application that showcases both modal and inline modes:

```bash
npm run dev
```

Visit `http://localhost:5173` to see the demo.

## License

MIT License - see LICENSE file for details.
