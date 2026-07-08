import { Token } from '../types'

/**
 * Orders tokens by the USD value of the user's holdings (balance × price),
 * descending. Balances and prices are keyed by lowercase address; missing
 * entries count as zero, and ties preserve the incoming order (stable sort).
 * Returns the ordered lowercase addresses.
 */
export const sortTokensByUsdValue = (
  tokens: Token[],
  balances: Record<string, string>,
  prices: Record<string, number>
): string[] =>
  tokens
    .map((token) => {
      const address = token.address.toLowerCase()
      return {
        address,
        value: Number(balances[address] ?? 0) * (prices[address] ?? 0),
      }
    })
    .sort((a, b) => b.value - a.value)
    .map(({ address }) => address)
