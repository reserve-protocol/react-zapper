## [1.3.0] - 2025-09-12

### Added

- Multiple entry points for better Tailwind CSS compatibility
  - `@reserve-protocol/react-zapper` - For projects with existing Tailwind setup
  - `@reserve-protocol/react-zapper/styled` - For projects without Tailwind (includes pre-compiled CSS)
- Mixpanel tracking for winning quote source in `selectBestQuote` function

### Changed

- Removed CSS import from main entry point to prevent style conflicts in Tailwind projects
- Package now works out-of-the-box for both Tailwind and non-Tailwind projects

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
