import { ChainId } from '../utils/chains'
import { useQuery } from '@tanstack/react-query'
import { Address, formatEther } from 'viem'

const INDEX_DTF_SUBGRAPH_URL = {
  [ChainId.Mainnet]:
    'https://api.goldsky.com/api/public/project_cmgzim3e100095np2gjnbh6ry/subgraphs/dtf-index-mainnet/prod/gn',
  [ChainId.Base]:
    'https://api.goldsky.com/api/public/project_cmgzim3e100095np2gjnbh6ry/subgraphs/dtf-index-base/prod/gn',
  [ChainId.Arbitrum]:
    'https://api.goldsky.com/api/public/project_cmgzim3e100095np2gjnbh6ry/subgraphs/dtf-index-bsc/prod/gn',
  [ChainId.BSC]:
    'https://api.goldsky.com/api/public/project_cmgzim3e100095np2gjnbh6ry/subgraphs/dtf-index-bsc/prod/gn',
}

type DTFQueryResponse = {
  dtf: {
    id: Address
    mintingFee: string // bigint D18
    tvlFee: string // bigint D18
    token: {
      id: Address
      name: string
      symbol: string
      decimals: number
      totalSupply: string
    }
  }
}

const dtfQuery = `
  query getDTF($id: String!) {
    dtf(id: $id) {
      id
      mintingFee
      tvlFee
      token {
        id
        name
        symbol
        decimals
        totalSupply
      }
    }
  }
`

export const useIndexDTF = (address: string | undefined, chainId: number) => {
  return useQuery({
    queryKey: ['index-dtf-metadata', address, chainId],
    queryFn: async () => {
      if (!address) return undefined

      const subgraphUrl =
        INDEX_DTF_SUBGRAPH_URL[chainId as keyof typeof INDEX_DTF_SUBGRAPH_URL]

      if (!subgraphUrl) throw new Error(`Unsupported chain ID: ${chainId}`)
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: dtfQuery,
          variables: { id: address.toLowerCase() },
        }),
      })

      if (!response.ok) {
        throw new Error(
          `Subgraph request failed: ${response.status} ${response.statusText}`
        )
      }

      const json: {
        data?: DTFQueryResponse
        errors?: Array<{ message: string }>
      } = await response.json()

      if (json.errors && json.errors.length > 0) {
        throw new Error(
          `Subgraph GraphQL errors: ${json.errors
            .map((e) => e.message)
            .join('; ')}`
        )
      }

      const { dtf } = json.data ?? ({} as DTFQueryResponse)
      if (!dtf) return undefined

      return {
        ...dtf,
        chainId,
        mintingFee: +formatEther(BigInt(dtf.mintingFee)),
        tvlFee: +formatEther(BigInt(dtf.tvlFee)),
      }
    },
    enabled: !!address,
  })
}
