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

2. **`Quote Source Winner`** - 4 events

   - `reason: 'only_zap_available'` - Only Zap provided valid quote
   - `reason: 'only_odos_available'` - Only Odos provided valid quote
   - `reason: 'better_output'` - Winner had better minAmountOut
   - `reason: 'tie_prefer_zap'` - Equal outputs, Zap selected

3. **`transaction`** - 2 events

   - `action: 'transaction_succeeded'` - Transaction confirmed on-chain
   - `action: 'transaction_reverted'` - Transaction failed/reverted

4. **`alert`** - 1 event

   - `cta: 'zap_success_notification'` - Successful zap completion alert

5. **`tap`** - 5 events
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
- `source`: 'zap' | 'odos'
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

### 2. `Quote Source Winner` (4 total)

Tracks which quote source (Zap or Odos) provided the best quote.

#### Properties:

- `source`: 'zap' | 'odos'
- `reason`: Why this source was selected (4 possible reasons)
  - `'only_zap_available'`: Only Zap returned a valid quote (Odos failed or unavailable)
  - `'only_odos_available'`: Only Odos returned a valid quote (Zap failed or unavailable)
  - `'better_output'`: This source provided a better minAmountOut value
  - `'tie_prefer_zap'`: Both sources returned identical output amounts, Zap selected as default
- `tokenIn`: Input token address
- `tokenOut`: Output token address
- `dtfTicker`: DTF ticker symbol
- `chainId`: Chain ID
- `type`: 'buy' | 'sell'
- `zapMinAmountOut`: Zap's minimum output amount (when both available)
- `odosMinAmountOut`: Odos's minimum output amount (when both available)

#### When Emitted:

- In `selectBestQuote()` when choosing between Zap and Odos quotes
- Only emitted when `quoteSource` is set to 'best'

### 3. `transaction` (2 total)

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

### 4. `alert` (1 total)

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
- `source`: 'zap' | 'odos' (optional)

#### When Emitted:

- When a zap transaction completes successfully (`zap_success_notification`)

### 5. `tap` (5 total)

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
- `source`: 'zap' | 'odos' (optional, for zap-related clicks)

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
- **Values**: 'zap' | 'odos'
- **Generation Triggers**:
  - When calling and waiting for the response from each API source
  - When a quote source is selected as winner
- **Purpose**: Track which source was ultimately used
