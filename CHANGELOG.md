## [2.1.0] - 2026-06-04

### Added

- Post-transaction success view: on a confirmed zap the Zapper keeps the flow in place and shows what actually happened. The boxes switch to "You used" / "You received", the received amount is read from the transaction logs (the exact output token credited to the wallet) with the realized price impact, the quote details are hidden, and an inline success bar (`✓ Successful Purchase` / `Successful Sale`) links to the block explorer. Reopening the Zapper starts fresh.
- After a mint, a "Stay informed" contact-capture panel where users can leave a Telegram, X, or email contact to receive updates about the DTF. On wider screens (≥900px) in modal/simple mode it slides out from behind the modal (secondary background) and the modal+panel pair recenters; inline mode and narrow screens render it as a stacked card. Toggle with the new `showContactInfo` prop (defaults to `true`). Submissions POST to Reserve's storage worker and fail silently for the user.
- Mixpanel events for the contact feature (`tap` event, `subpage: 'contact'`): `zap_contact_submit`, `zap_contact_subscribed`, `zap_contact_error`, each carrying `ca`, `ticker`, `chain`, and the chosen `platform`.

### Removed

- **Breaking:** removed the `Toaster` export and the `sonner` / `next-themes` dependencies. The package no longer renders toasts; success and errors are shown inline. Remove any `import { Toaster } from '@reserve-protocol/react-zapper'` and its usage — you no longer need to mount a toaster or install `sonner`.

## [2.0.0] - 2026-06-02

### Breaking Changes

- Removed the `wagmiConfig` prop. The Zapper no longer creates its own `WagmiProvider` and `QueryClient`/`QueryClientProvider`; it now consumes the host application's `wagmi` and `@tanstack/react-query` context via hooks. Wrap your app in your own `WagmiProvider` + `QueryClientProvider` and drop the `wagmiConfig` prop:

  ```tsx
  // Before (v1)
  <Zapper wagmiConfig={wagmiConfig} chain={1} dtfAddress="0x..." />

  // After (v2) — render inside your existing providers
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <Zapper chain={1} dtfAddress="0x..." />
    </QueryClientProvider>
  </WagmiProvider>
  ```

### Added

- `useQuote()` hook exposing the Zapper's live quote state as `{ data, loading, error }`, so consumers can build their own UI around the Zapper (status banners, custom loaders, analytics). `data` is `{ input: { token, amount, value }, quote, source }` — `input` (including its USD `value`) is available as soon as the user types, while `quote`/`source` populate once a quote resolves. Also exports the `QuoteData`, `QuoteInput`, `UseQuoteResult`, and `ZapResult` types.

### Changed

- `react` and `react-dom` are now `peerDependencies` (previously bundled in `dependencies`), preventing duplicate-React issues in host apps. Removed the unused `@tanstack/query-core` dependency.
- Bumped peer floors to `wagmi ^2.19.0` and `viem ^2.50.0`; the package is now built and tested against `wagmi 2.19.5` + `viem 2.50.4`.
- Raised the pnpm `minimumReleaseAge` supply-chain guard from 24h to 7 days.

### Fixed

- `usePrice` now returns native-token prices (ETH, BNB, Base ETH). It was rewriting the native sentinel address (`0xEeee…EEeE`) to the zero address before calling the Reserve price API, which has no price at the zero address — zeroing out every native-token price on all chains.

## [1.7.2] - 2026-05-18

### Added

- Added `disabled` prop to disable primary zap actions, wallet/chain actions, amount inputs, and Max buttons

## [1.7.1] - 2026-04-23

### Fixed

- Fixed `No providers available for quoteSource="zap"` error on CMC20/BSC below the minimum input value. The minimum-input skip rule now only applies to `best` mode; explicit provider selection (Zap, Odos, Velora, Enso) is always honored

## [1.7.0] - 2026-04-23

### Added

- Enso as a third external quote aggregator alongside Odos and Velora
- All external aggregators (Odos, Velora, Enso) are now available on every supported chain (Mainnet, Base, Arbitrum, BSC). In `best` mode the zapper queries every enabled provider in parallel (`Promise.allSettled`) and picks the highest `minAmountOut`; failures are soft
- Per-chain × per-provider enablement matrix (`PROVIDER_ENABLED` in `src/utils/providers.ts`). Flip a boolean to disable a source on a specific chain — it drops out of the dropdown and the `best` pool automatically
- Provider registry (`PROVIDERS` in `src/utils/providers.ts`). Adding a future aggregator is one icon + one registry entry
- New exports: `PROVIDERS`, `PROVIDER_ENABLED`, `getEnabledProviders`, `getEnabledAggregators`, `isProviderEnabled`, and types `ProviderId`, `ProviderConfig`, `QuoteSource`

### Changed

- `QuoteSource` type widened from `'best' | 'zap' | 'odos'` to `'best' | 'zap' | 'odos' | 'velora' | 'enso'` (backward compatible — existing values still valid)
- Unified fetch flow in `useZapSwapQuery`; the hardcoded zap-vs-odos parallel path is replaced by a generic `fetchBestZapQuote` that iterates the enabled providers
- Quote Source settings dropdown is now registry-driven and shows only the providers enabled for the current chain
- Demo's `Default Quote Source` selector now exposes every provider (zap, odos, velora, enso) for testing

## [1.6.2] - 2026-03-25

### Fixed

- Added USDT and WBNB token logos.

## [1.6.1] - 2026-03-25

### Added

- Export `zappableTokens` constant for consumers to access supported zappable tokens per chain

### Fixed

- Added missing `zapperApiUrl` and `sellOnly` props documentation to README

## [1.6.0] - 2026-03-25

### Added

- New `zapperApiUrl` prop for routing zapper service calls (`api/zapper/*`) to a dedicated host
- Healthcheck now hits the zapper service `/health` endpoint directly via `zapperApiUrl`

### Changed

- Reserve API calls (`current/prices`, `current/dtf`, `folio-manager/*`, `dtf/icons`, `zapper/report`, `odos/swap`, `velora/swap`) remain on `apiUrl`
- `zapperApiUrl` falls back to `apiUrl` when not provided (fully backwards compatible)

## [1.5.8] - 2025-12-16

### Fixed

- Regenerated package-lock.json with npm@latest for CI compatibility

## [1.5.7] - 2025-12-16

### Changed

- Migrated npm publishing from token-based authentication to OIDC Trusted Publishers
- Updated Node.js version from 20 to 22 in CI workflows
- Added automatic version tagging workflow on push to main

## [1.5.6] - 2025-12-15

### Added

- EIP-7825: Transaction Gas Limit Cap implementation

## [1.5.5] - 2025-12-08

### Changed

- Updated subgraphs

## [1.5.4] - 2025-12-02

### Fixed

- Fixed TokenLogo caching issue when switching between DTFs

## [1.5.3] - 2025-11-16

### Changed

- Odos was replaced by Velora for BSC
- Refactored minimum input value logic for DTFs:
  - When input value < $1000 for specific DTFs: tries Odos only first, falls back to Zapper if Odos fails
  - When input value >= $1000: tries both sources in parallel as before
  - Removed error throwing when below minimum value for better UX

## [1.5.2] - 2025-11-11

### Added

- Minimum value to use zapper for a given list of DTFs

## [1.5.1] - 2025-11-07

### Added

- WBNB as input token on BSC

## [1.5.0] - 2025-10-27

### Added

- New `simple` mode that provides a launcher interface
  - Shows minimal UI with input field and "Get started" button
  - Pre-loads quotes in the background as user types
  - Opens full modal with preserved input and loaded quote on button click
  - Ideal for embedding in landing pages or simplified UIs
- Documentation for missing props in README (`debug`, `defaultSource`)

### Changed

- Updated TypeScript interfaces to support new simple mode
- Enhanced demo application with mode selector for testing all three modes
- Improved component lifecycle handling to preserve state during mode transitions

## [1.4.3] - 2025-10-24

### Changed

- Adjust report button style

## [1.4.2] - 2025-10-24

### Changed

- Removed button to copy traceId
- Adjust error styles

## [1.4.1] - 2025-10-20

### Added

- Report error button
- Insufficient gas balance check

## [1.4.0] - 2025-10-06

### Added

- Quote invalidation based on simulation
- Copy trace id button
- Time event tracking

## [1.3.8] - 2025-10-02

### Added

- Tracking docs

## [1.3.7] - 2025-10-01

### Changed

- Tracking was improved (sessionId, quoteId, sourceId, retryId)

## [1.3.6] - 2025-09-26

### Fixed

- ETH price
- TX reverted tracking

### Added

- More error tracking

## [1.3.5] - 2025-09-25

### Fix

- Increased gas limit multiplier

## [1.3.4] - 2025-09-23

### Added

- Added `defaultSource` param

## [1.3.3] - 2025-09-22

### Added

- Added `debug` mode feature

## [1.3.2] - 2025-09-16

### Fixed

- Fixed some animations

## [1.3.1] - 2025-09-16

### Changed

- Removed graphql and graphql-request dependencies

## [1.3.0] - 2025-09-12

### Added

- Mixpanel tracking for winning quote source in `selectBestQuote` function
  - Tracks which provider (Zap or Odos) won the quote comparison
  - Includes reason for selection (better_output, tie_prefer_zap, only_x_available)
- Export for styles via `@reserve-protocol/react-zapper/styles.css`

### Changed

- Simplified CSS import strategy - users now import styles separately as needed
- Package works for both Tailwind and non-Tailwind projects with a single approach

## [1.2.0] - 2025-09-09

### Added

- Odos DEX aggregator integration
- Quote source selector (Best Quote, Zap, Odos)
- Source tracking in analytics events

### Changed

- Quote fetching now compares both Zap and Odos prices
- Updated quote details UI to show provider information

## [1.1.3] - 2025-08-28

### Added

- High dust warning banner
- Loading skeletons

### Changed

- Data refresh period

## [1.1.2] - 2025-08-26

### Removed

- USDC as an option for BSC zaps

## [1.0.9] - 2025-07-29

### Added

- BSC support

## [1.0.8] - 2025-07-21

### Changed

- Updated mixpanel tracking
- Input disabled when wallet is disconnected

## [1.0.7] - 2025-07-10

### Changed

- Updated refresh block intervals.
- Refactored switch chain logic

## [1.0.6] - 2025-07-10

### Changed

- Updated refresh block intervals

## [1.0.5] - 2025-07-10

### Added

- Add `connectWallet?: () => void` prop to Zapper component for custom wallet connection handling
- Add switch chain button when connected wallet is on different chain than DTF

### Changed

- Updated token balance display precision for better readability

## [1.0.4] - 2025-07-07

### Changed

- Update docs
- Fix zapper healthcheck

## [1.0.3] - 2025-07-07

### Changed

- Updated wagmi setup

## [1.0.2] - 2025-07-04

### Changed

- Update peer dependencies

## [1.0.1] - 2025-07-04

### Fixed

- Fixed GitHub Actions publishing workflow that wasn't including compiled files (dist/) in the npm package
- Added dependency installation and build step before publishing

## [1.0.0] - 2025-07-04

### Added

- Initial version
