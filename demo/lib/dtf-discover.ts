import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { AvailableChain } from '@/utils/chains'

export type DiscoverDTF = {
  address: Address
  name: string
  symbol: string
  price: number
  marketCap: number
  chainId: AvailableChain
  type: 'index' | 'yield'
  status: 'active' | 'deprecated' | 'unsupported'
}

// Same list the app's discover page is built from. Index and yield DTFs are
// both shown; the zapper only quotes Index DTFs (yield DTFs use the legacy
// zap v2 flow), so yield rows surface whatever the zapper answers.
export const useDiscoverDTFs = (
  apiUrl: string,
  { includeDeprecated }: { includeDeprecated: boolean }
) =>
  useQuery({
    queryKey: ['discover-dtfs', apiUrl, includeDeprecated],
    queryFn: async (): Promise<DiscoverDTF[]> => {
      const response = await fetch(`${apiUrl}discover/dtfs`)
      if (!response.ok) {
        throw new Error(`Failed to fetch DTFs: ${response.status}`)
      }
      const data: DiscoverDTF[] = await response.json()
      return data
        .filter((dtf) => includeDeprecated || dtf.status === 'active')
        .sort((a, b) => b.marketCap - a.marketCap)
    },
    refetchInterval: 1000 * 60 * 10,
    staleTime: 1000 * 60,
  })
