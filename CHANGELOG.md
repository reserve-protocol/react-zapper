## [2.7.0] - 2026-07-22

### Added

- CoW Swap as a new RFQ/intent quote source (`cowswap`). Instead of an atomic transaction, the user signs a gasless EIP-712 order that CoW solvers fill off-chain: quote and approval flow through the existing pipeline (spender = CoW Vault Relayer), the quote competes in `best` mode by `minAmountOut`, and after submit the button shows "Waiting for order to fill..." while the order status is polled (2-minute order validity). On fill the regular success view is shown with a link to the order on CoW Explorer; if the order expires or is cancelled without filling, the flow resets and a fresh quote is fetched. Enabled on Ethereum, Base, Arbitrum, and BSC.
- Extensible RFQ adapter seam (`RfqAdapter`, `RFQ_ADAPTERS`, `isRfqProvider`) so more intent venues (e.g. PancakeSwap X on BSC) can be added as additional adapters without touching the quote/submit pipeline.
- New dependency: `@cowprotocol/cow-sdk` (order-book client, EIP-712 order types, CoW contract addresses).

- Native-token inputs (ETH/BNB) are supported through CoW's eth-flow: a single `createOrder` transaction to the EthFlow contract carrying the native amount — no approval, no signature. Eth-flow orders have a 10-minute validity; if one expires unfilled, the UI explains that CoW's refunder returns the funds automatically within a few minutes.
- PancakeSwap X (`pcsx`) as a second RFQ source, on BSC only, proxied through the Reserve API: the quote returns a ready-to-sign Permit2 Dutch order, the user signs gasless `PermitWitnessTransferFrom` typed data (approval spender = Permit2), and the order is submitted and polled via `{apiUrl}pcsx/order`. Requires the matching Reserve API endpoints (extended `/pcsx/quote` with `signer`, new `/pcsx/order` submit/status).

### Notes

- RFQ quotes carry no transaction, so the pre-selection simulation filter and gas estimation don't apply to them.

## [2.6.1] - 2026-07-17

### Fixed

- Expired quotes can no longer be submitted. Some quotes carry short-lived signed calldata (BSC Ondo GM attestations live ~15s), and sending one past its `validUntil` is a guaranteed on-chain revert surfaced as an opaque "Unknown" error. The submit handler now checks `validUntil` at send time and refetches a fresh quote instead of handing dead calldata to the wallet.
- The quote query no longer re-serves a previously cached quote when the swap parameters change back to an earlier value (or the widget remounts). The cached quote appeared instantly with the submit button armed while its calldata was already expired; a fresh quote is now always fetched.

## [2.6.0] - 2026-07-13

### Fixed

- Cross-chain navigation no longer fires a wrong-chain request on first render. `ChainIdUpdater` synced its `chain` prop into the widget's internal chain atom in an effect that lagged the first render, so the DTF and basket updaters briefly queried the default (mainnet) subgraph/price endpoint for a Base/BSC DTF before the prop applied. The chain is now seeded synchronously during render, so the first read already targets the correct chain.

### Changed

- Upgraded `jotai` from v1 to v2 (`^2.19.1`). No changes to the public component API.

## [2.5.1] - 2026-07-08

### Changed

- The input token selector now orders tokens by the USD value of the user's holdings (largest first), and the default selected token is the one the user holds the most of. The order is computed once per wallet/chain when balances and prices resolve, so the list doesn't reshuffle mid-session. Without a connected wallet, or if balances/prices can't be fetched, the selector keeps the previous fixed order.

### Added

- Loading skeleton on the token selector and balance while balances/prices are being fetched, so the list doesn't visibly reorder or switch the selected token after rendering.

## [2.5.0] - 2026-07-08

### Changed

- In `best` mode, candidate quotes are now simulated before selection and quotes whose transaction reverts are excluded, so aggregator quotes that would fail on-chain are no longer offered. If every candidate reverts, selection falls back to the raw best. Simulation is skipped when the user's balance is insufficient.
- While a quote is being fetched, the submit CTA now reads "Fetching quote..." instead of keeping the previous step label. Sub-second refreshes don't blink the button: the fetching state only shows when it lasts, and stays up long enough to be readable.

### Fixed

- After a rejected or reverted transaction the submit CTA no longer cycles rapidly between disabled/refetching/simulating; recovery is now bounded to the regular quote refresh cadence.
- The submit CTA no longer flashes "Simulation failed" on transient RPC errors (rate limits, timeouts): only an actual on-chain revert of the quoted transaction disables the button, and while a new quote is being fetched the fetching label takes precedence.

## [2.4.2] - 2026-07-08

### Changed

- Options disabled via `disabledSettings` are now hidden from the zap settings panel instead of rendered as frozen unchecked checkboxes.

### Removed

- "Send dust back to wallet" row from the zap settings panel. Dust is always collected; behavior is unchanged.

### Fixed

- Help tooltips no longer get clipped by the dialog edge — tooltip content now renders in a portal.

## [2.4.1] - 2026-07-08

### Fixed

- The submit CTA no longer stays disabled/loading indefinitely after a transaction reverts or is rejected in the wallet. The quote is now refreshed immediately on failure (instead of resuming from the stale, often expired, frozen quote), and the gas-estimate simulation is re-run whenever a new quote lands — previously an errored simulation query could never recover when the refreshed quote carried identical tx bytes, leaving the button stuck on "Simulation failed - Refetching quote".

## [2.4.0] - 2026-07-08

### Added

- New optional `disabledSettings` prop (`{ deepLiquidity?: boolean; forceMint?: boolean }`). A disabled option renders its checkbox frozen unchecked in the zap settings panel and the corresponding behavior is forced off in quote requests.

## [2.3.6] - 2026-07-07

### Added

- New optional `scheduleCall` prop. When set, the post-purchase success view shows a "schedule an intro call" panel for larger buys — gated on the purchase size (`minUsd`, default $500). The consumer supplies the URL, an already-scheduled flag, and an `onSchedule` callback; the panel stays visible within the current view and only disappears once the consumer passes `scheduled: true` on a later render.

### Changed

- The "Stay informed" subscribe panel is now hidden entirely for wallets already subscribed to the DTF (previously it showed an "already subscribed" confirmation).
- Removed the dedicated "Close" button from the success view; the header close (X) is the single way to dismiss it.

## [2.3.5] - 2026-07-02

### Added

- Configurable quote refresh rate via the new `refreshRate` prop (defaults to 9 seconds).
- Quote expiration countdown on the submit button while confirming in the wallet.

## [2.3.4] - 2026-07-01

### Changed

- Replaced the slow-loading animation with a new theme-aware generative loader that adapts to light and dark mode.
- The post-transaction contact capture is now email-only.
- Wallets that are already subscribed now see an "already subscribed" confirmation instead of the contact form.
- Quotes now refresh every 9 seconds (down from 12), and the submit CTA is disabled with a spinner during each refresh.

## [2.3.3] - 2026-06-23

### Fixed

- Sell mode no longer shows a zero balance for the DTF token. The balance map is keyed by the lowercase subgraph address, but the lookup used the raw `dtfAddress` prop; when the host passed a checksummed (mixed-case) address the lookup missed and the balance stayed `0`, which also blocked sells via a false insufficient-balance check. `indexDTFBalanceAtom` now derives from `balancesAtom` using the same key the map is built with, mirroring the buy-mode pattern. Refresh cadence is unchanged.

## [2.3.2] - 2026-06-23

### Changed

- Replaced the hardcoded hex colors in the post-transaction success view with the existing Tailwind theme tokens (`success`, `destructive`, `border-secondary`, `background`), matching the rest of the components. As a side effect the success view is now theme-aware and adapts to dark mode instead of using fixed light-mode colors.

## [2.3.1] - 2026-06-22

### Changed

- The post-transaction "Stay informed" contact flow now surfaces the submission result instead of failing silently. A successful subscribe replaces the input and "No thanks" with a confirmation message ("Thanks for getting involved…") and a "Close" button; a failure shows a predefined error message above the input (with a link to submit a help request) and keeps the form editable so the user can retry. New strings are translated for `es`, `ko`, and `zh`.

## [2.3.0] - 2026-06-17

### Added

- Optional localization. A new `locale` prop (`'en' | 'es' | 'ko' | 'zh'`) switches the zapper UI language; it defaults to `'en'` and any untranslated string falls back to English, so existing behavior is unchanged. Localization is fully self-contained — the i18n runtime (Lingui) and all message catalogs are bundled inside the package, so consumers need no extra dependencies and no provider setup. Spanish, Korean, and Chinese catalogs are complete and aligned with Register's terminology; the Korean and Chinese strings were machine-assisted and warrant a native review.

### Note

- The `Zapper` component is unaffected — it wraps its own UI in the new i18n provider automatically. Only consumers that mount the lower-level `ZapperContent` export directly now need to wrap it in the also-exported `ZapperI18nProvider` (it renders translated text and requires the provider in context).

## [2.2.1] - 2026-06-09

### Changed

- The zapper modal now fades in/out on open and dismiss (the previous animation classes were no-ops). The success view stays rendered through the fade-out: the success snapshot is now cleared when the modal opens instead of on close, so dismissing no longer flashes the empty Buy/Sell form mid-animation.
- The success view's contact CTA is now inset inside the input and renamed from "Get updates" to "Subscribe", giving the input full width.

## [2.2.0] - 2026-06-09

### Changed

- Reworked the post-transaction success state into a single inline view that matches the latest design and now covers redeem as well as mint. The modal switches to a green alert with collapsible details — Received (the exact output token credited to the wallet, read from the tx logs), Used (the USD spent), and Transaction (a link to the block explorer) — with the "Successful Purchase" / "Successful Redemption" alert animating up and the rest fading in. The close button is preserved, and the view adapts to mobile.
- Removed the slide-out contact side panel and its desktop-only breakpoint; the "Stay informed" section now renders inline below the success alert across all modes, in a bordered card.
- Simplified the contact input to email or Telegram (email default) with a separate "Get updates" button and a "No thanks" dismissal (disabled once a contact is submitted); removed the post-submit copy button. The storage payload is now `{ address, value, dtf, chainId, txHash, telegram, email }`.

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
