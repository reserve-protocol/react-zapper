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
