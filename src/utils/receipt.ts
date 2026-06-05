import { erc20Abi, parseEventLogs, type Log } from 'viem'

/**
 * Sum the ERC20 `Transfer` amounts for `token` credited to `account` in a tx
 * receipt — i.e. how much of the output token actually landed in the wallet.
 * Returns 0n when no matching transfer is found (e.g. native-token outputs,
 * which don't emit a Transfer log; callers should fall back to the quote).
 */
export function getReceivedAmount(
  logs: Log[],
  token: string,
  account: string
): bigint {
  if (!token || !account) return 0n
  try {
    const transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: 'Transfer',
      logs,
    })
    return transfers
      .filter(
        (t) =>
          t.address.toLowerCase() === token.toLowerCase() &&
          (t.args.to as string)?.toLowerCase() === account.toLowerCase()
      )
      .reduce((acc, t) => acc + ((t.args.value as bigint) ?? 0n), 0n)
  } catch {
    return 0n
  }
}
