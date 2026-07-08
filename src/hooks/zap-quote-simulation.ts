import {
  Address,
  BaseError,
  ExecutionRevertedError,
  Hex,
  InsufficientFundsError,
} from 'viem'
import type { Config } from 'wagmi'
import { estimateGas } from 'wagmi/actions'
import type { ProviderQuote } from './zap-quote-providers'

export type SimulateQuote = (quote: ProviderQuote) => Promise<void>

export class SimulationTimeoutError extends Error {}

export const SIMULATION_TIMEOUT_MS = 3_500

// EIP-1474 "execution error" — what nodes return when a call reverts
const RPC_REVERT_CODE = 3

/**
 * Decides whether an estimateGas failure disqualifies the quote ('revert') or
 * says nothing about it ('infra': RPC hiccups, rate limits, the user's
 * balance...). Quotes are only dropped on positive evidence of an on-chain
 * revert.
 */
export const classifyEstimateGasError = (
  error: unknown
): 'revert' | 'infra' => {
  if (error instanceof SimulationTimeoutError) return 'infra'
  if (!(error instanceof BaseError)) {
    return error instanceof Error && /execution reverted/i.test(error.message)
      ? 'revert'
      : 'infra'
  }
  // Balance problems are the user's, not the quote's
  if (error.walk((e) => e instanceof InsufficientFundsError)) return 'infra'
  if (
    error.walk(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: unknown }).code === RPC_REVERT_CODE
    )
  ) {
    return 'revert'
  }
  const reverted = error.walk((e) => e instanceof ExecutionRevertedError)
  if (reverted instanceof BaseError) {
    // geth reports balance-capped estimation as "gas required exceeds
    // allowance" and viem also maps that message to ExecutionRevertedError —
    // it is not a bad quote
    return /gas required exceeds allowance/i.test(reverted.message)
      ? 'infra'
      : 'revert'
  }
  return 'infra'
}

/**
 * Simulates every quote in parallel and splits them into `kept` (simulated
 * fine, unverifiable, or failed for reasons unrelated to the quote) and
 * `filtered` (the tx reverts). Preserves input order and never throws.
 */
export const filterQuotesBySimulation = async (
  quotes: ProviderQuote[],
  simulate: SimulateQuote,
  timeoutMs = SIMULATION_TIMEOUT_MS
): Promise<{
  kept: ProviderQuote[]
  filtered: { quote: ProviderQuote; error: unknown }[]
}> => {
  const verdicts = await Promise.all(
    quotes.map(async (quote): Promise<{ keep: boolean; error?: unknown }> => {
      // Without the token approval in place the swap tx is guaranteed to
      // revert, so quotes still needing approval can't be verified — keep
      // them (approvalAddress differs per provider, so this is per-quote).
      if (!quote.result?.tx || quote.result.approvalNeeded) {
        return { keep: true }
      }
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new SimulationTimeoutError('simulation timed out')),
            timeoutMs
          )
        })
        const run = simulate(quote)
        // avoid an unhandled rejection when the timeout wins the race
        run.catch(() => {})
        await Promise.race([run, timeout])
        return { keep: true }
      } catch (error) {
        return { keep: classifyEstimateGasError(error) === 'infra', error }
      } finally {
        clearTimeout(timer)
      }
    })
  )

  const kept: ProviderQuote[] = []
  const filtered: { quote: ProviderQuote; error: unknown }[] = []
  verdicts.forEach((verdict, i) => {
    if (verdict.keep) kept.push(quotes[i])
    else filtered.push({ quote: quotes[i], error: verdict.error })
  })

  return { kept, filtered }
}

export const makeWagmiSimulator = (
  config: Config,
  { chainId, account }: { chainId: number; account: Address }
): SimulateQuote => {
  return async (quote) => {
    const tx = quote.result?.tx
    if (!tx) return
    // chainId + account are always explicit so wagmi resolves the public
    // client for the target chain and never touches the wallet connector.
    // No `gas` param: this is a pure revert check — the capped gas limit is
    // still applied by the submit button's own simulation.
    await estimateGas(config, {
      chainId: chainId as (typeof config)['chains'][number]['id'],
      account,
      to: tx.to,
      data: tx.data as Hex,
      value: BigInt(tx.value || 0),
    })
  }
}
