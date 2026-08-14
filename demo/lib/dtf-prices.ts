import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { DiscoverDTF } from './dtf-discover'

export type PriceKey = `${number}-${string}`

export const priceKey = (chainId: number, address: Address): PriceKey =>
  `${chainId}-${address.toLowerCase()}`

type ApiPrice = { address: string; price: number | null }

/**
 * DTF prices straight from the Reserve price API, the same endpoint the widget
 * prices tokens with. The discover payload also carries a price, but it is a
 * snapshot of the list query rather than the live price feed, so both sides of
 * a quote are priced here from `current/prices` to keep them comparable.
 * One request per chain covers every row on that chain.
 */
export const useDTFPrices = (apiUrl: string, dtfs: DiscoverDTF[]) => {
  const byChain = dtfs.reduce<Record<number, Address[]>>((acc, dtf) => {
    acc[dtf.chainId] = [...(acc[dtf.chainId] ?? []), dtf.address]
    return acc
  }, {})
  const chains = Object.keys(byChain)
    .map(Number)
    .sort((a, b) => a - b)

  return useQuery({
    queryKey: [
      'dtf-prices',
      apiUrl,
      chains.map((chainId) => `${chainId}:${byChain[chainId].join(',')}`),
    ],
    queryFn: async (): Promise<Record<PriceKey, number>> => {
      const responses = await Promise.all(
        chains.map(async (chainId) => {
          const url = `${apiUrl}current/prices?chainId=${chainId}&tokens=${byChain[
            chainId
          ].join(',')}`
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(
              `Failed to fetch DTF prices for chain ${chainId}: ${response.status}`
            )
          }
          const prices: ApiPrice[] = await response.json()
          return [chainId, prices] as const
        })
      )

      return Object.fromEntries(
        responses.flatMap(([chainId, prices]) =>
          prices
            .filter((price) => price.price != null)
            .map((price) => [
              priceKey(chainId, price.address as Address),
              price.price as number,
            ])
        )
      )
    },
    enabled: chains.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
