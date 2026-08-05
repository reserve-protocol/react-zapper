# Tracking Documentation

This document describes the analytics tracking implementation using Mixpanel in the React Zapper library.

## Events Summary

**Total Events Tracked: 17**

The library tracks 5 main event types with the following distribution:

1. **`index-dtf-zap-swap`** - 5 events

   - `status: 'requested'` - Quote request initiated
   - `status: 'success'` - Quote successfully received
   - `status: 'error'` - API/Network error
   - `status: 'user_error'` - User validation error
   - `status: 'user_tx_error'` - Transaction execution error

2. **`Quote Source Winner`** - 2 reason families

   - `reason: 'only_<source>_available'` - Only one provider survived the round
   - `reason: 'better_output'` - Winner had the best minAmountOut

3. **`Quote Source Picked`** - 1 event

   - Fired on every effective submit with the submitted source vs the round's best

4. **`transaction`** - 2 events

   - `action: 'transaction_succeeded'` - Transaction confirmed on-chain
   - `action: 'transaction_reverted'` - Transaction failed/reverted

5. **`alert`** - 1 event

   - `cta: 'zap_success_notification'` - Successful zap completion alert

6. **`tap`** - 5 events
   - `cta: 'zap_settings'` - Settings button clicked
   - `cta: 'zap_refresh'` - Refresh quotes button clicked
   - `cta: 'zap_buy'` - Execute buy transaction clicked
   - `cta: 'zap_sell'` - Execute sell transaction clicked
   - `cta: 'zap-approve'` - Token approval clicked

### 1. `index-dtf-zap-swap` (5 total)

Main event for tracking swap/zap operations.

#### Properties:

- `event`: 'index-dtf-zap-swap'
- `wa`: wallet address
- `ca`: token input address
- `ticker`: DTF ticker symbol
- `chainId`: blockchain chain ID
- `type`: 'buy' | 'sell'
- `endpoint`: API endpoint URL
- `status`: Event status (5 different statuses)
  - `'requested'`: Quote requested from API - tracks when a quote is initiated
  - `'success'`: Successful API response with valid quote data
  - `'error'`: HTTP error from API (network issues, server errors)
  - `'user_error'`: User-facing validation error (insufficient balance, invalid input, etc.)
  - `'user_tx_error'`: Transaction execution error on blockchain
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `source`: winning provider id (e.g. 'zap', 'velora')
- `error`: HTTP error code (only when status='error')
- `userError`: Error message (only when status='user_error' or 'user_tx_error')
- `amountInValue`: Input amount (when result available)
- `amountOutValue`: Output amount (when result available)
- `dustValue`: Dust value (when result available)
- `truePriceImpact`: True price impact percentage (when result available)

#### When Emitted:

- When requesting a quote from the API
- When receiving API responses (success or error)
- When user errors occur
- When transaction errors occur

### 2. `Quote Source Winner`

Tracks which quote source won each comparison round (the automatic best).

#### Properties:

- `source`: winning provider id (e.g. 'zap', 'velora')
- `reason`: Why this source was selected
  - `'only_<source>_available'`: Only one provider survived the round (e.g. `only_zap_available`)
  - `'better_output'`: This source provided the best minAmountOut value
- `winningMinAmountOut`: The winner's minimum output amount (multi-candidate rounds)
- `comparedProviders`: Comma-joined provider ids that competed (multi-candidate rounds)
- `simulationFiltered`: Comma-joined provider ids excluded by the revert simulation (when any)
- `simulationFallback`: `true` when every candidate reverted and selection fell back to the raw pool
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `dtfTicker`: DTF ticker symbol
- `chainId`: Chain ID
- `type`: 'buy' | 'sell'

#### When Emitted:

- In `pickBestQuote()` when a comparison round completes (not on single-provider rounds forced by tests)

### 3. `Quote Source Picked`

Tracks the source actually used at submit time vs the automatic best, so picked-vs-best behavior can be analyzed. The route list pre-selects the best source; the user may pick another row.

#### Properties:

- `source`: submitted provider id (the active quote's source)
- `bestSource`: the round winner's provider id
- `isBest`: `true` when the submitted source is the round winner
- `picked`: `true` when the user explicitly picked the source from the route list, `false` for auto-best
- `minAmountOut`: submitted quote's minimum output amount
- `bestMinAmountOut`: best quote's minimum output amount
- `account`, `tokenIn`, `tokenOut`, `dtfTicker`, `chainId`, `type`: same context as `Quote Source Winner`

#### When Emitted:

- On every effective submit — right when the transaction is sent or the RFQ order signing starts (not on approvals, not on row clicks, not on programmatic `defaultSource` seeding)

Additionally, `bestSource` is registered as a super-property alongside `source`/`sourceId`, so every downstream event (`index-dtf-zap-swap`, `tap`, `alert`) carries both the active and the best source.

### 4. `transaction` (2 total)

Tracks blockchain transaction results.

#### Properties:

- `product`: Product label (e.g., 'Zap', 'Approve')
- `action`: Transaction action (2 possible actions)
  - `'transaction_succeeded'`: Transaction was mined and confirmed successfully on-chain
  - `'transaction_reverted'`: Transaction failed or was reverted during execution
- `chain`: Chain ID (optional)
- `hash`: Transaction hash (optional)

#### When Emitted:

- When a transaction is confirmed on-chain (success)
- When a transaction is reverted or fails on-chain

### 5. `alert` (1 total)

Tracks important user notifications and alerts.

#### Properties:

- `page`: Page context ('overview')
- `subpage`: Sub-page context (optional)
- `cta`: 'zap_success_notification'
- `ca`: DTF contract address
- `ticker`: DTF ticker symbol
- `chain`: Chain ID
- `input`: Input token symbol
- `output`: Output token symbol
- `source`: provider id (optional)

#### When Emitted:

- When a zap transaction completes successfully (`zap_success_notification`)

### 6. `tap` (5 total)

Generic click tracking event for UI interactions.

#### Properties:

- `page`: Page where the click occurred
- `subpage`: Sub-page context (optional)
- `cta`: Call-to-action identifier (5 possible values)
  - `'zap_settings'`: User clicked the settings button to open zap configuration
  - `'zap_refresh'`: User clicked the refresh button to get new quotes
  - `'zap_buy'`: User clicked the submit button to execute a buy transaction
  - `'zap_sell'`: User clicked the submit button to execute a sell transaction
  - `'zap-approve'`: User clicked to approve token spending before the zap
- `ca`: DTF contract address
- `ticker`: DTF ticker symbol
- `chain`: Chain ID
- `input`: Input token symbol (for zap-related clicks)
- `output`: Output token symbol (for zap-related clicks)
- `source`: provider id (optional, for zap-related clicks)

#### When Emitted:

- Settings button clicked
- Refresh quote button clicked
- Tab changes (Buy/Sell)
- Any tracked UI interaction

## Global Properties (Super Properties)

These properties are registered globally using `mixpanelRegister()` and automatically included in all events:

### Session ID

- **Property**: `sessionId`
- **Generation Triggers**:
  - Modal opens (modal mode)
  - Component mounts (inline mode)
  - Wallet address changes
- **Purpose**: Track all actions within a user session

### Quote ID

- **Property**: `quoteId`
- **Generation Triggers**:
  - Quote parameters change (chainId, tokenIn, tokenOut, amountIn, slippage)
- **Purpose**: Group all API calls for the same quote request

### Retry ID

- **Property**: `retryId`
- **Generation Triggers**:
  - Each API call attempt
- **Purpose**: Track individual API call attempts and retries

### Source ID

- **Property**: `sourceId`
- **Generation Triggers**:
  - When calling and waiting for the response from each API source
  - When a quote source is selected as winner
- **Purpose**: Uniquely identify the selected quote source

### Source

- **Property**: `source`
- **Values**: provider id (e.g. 'zap', 'velora', 'enso')
- **Generation Triggers**:
  - When the active quote changes (round completion, user pick from the route list, or fallback)
- **Purpose**: Track which source was ultimately used

### Best Source

- **Property**: `bestSource`
- **Values**: provider id (e.g. 'zap', 'velora', 'enso')
- **Generation Triggers**:
  - When a comparison round completes with a winner
- **Purpose**: Compare the active (possibly user-picked) source against the automatic best on any downstream event
