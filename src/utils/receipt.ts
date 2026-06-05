import { erc20Abi, parseEventLogs, type Log } from 'viem'

// Sum of ERC20 `Transfer` amounts for `token` credited to `account` in a receipt.
// Returns 0n when none is found (e.g. native outputs emit no Transfer log).
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
