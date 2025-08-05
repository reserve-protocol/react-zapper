import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { useAtomValue } from 'jotai'
import { apiUrlAtom } from '@/state/atoms'

/**
 * Hook to fetch price data for a token using Reserve API
 */
export function usePrice(
  chainId: number,
  tokenAddress: Address,
  apiUrl?: string
): number | null {
  const atomUrl = useAtomValue(apiUrlAtom)
  const { data } = useQuery({
    queryKey: ['chainlinkPrice', chainId, tokenAddress, apiUrl, atomUrl],
    queryFn: async () => {
      if (!tokenAddress) return null

      const baseUrl = apiUrl || atomUrl
      const url = `${baseUrl}current/prices?chainId=${chainId}&tokens=${tokenAddress}`

      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch price: ${response.status}`)
        }

        const data = await response.json()

        if (Array.isArray(data) && data.length > 0) {
          return data[0]?.price || null
        }

        return null
      } catch (error) {
        console.error('Error fetching token price:', error)
        return null
      }
    },
    enabled: !!chainId && !!tokenAddress,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
    retry: 2,
  })

  return data ?? null
}
