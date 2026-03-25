import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { zapperApiUrlAtom } from '@/state/atoms'

// Available chain IDs type
type AvailableChain = number

interface ZapperStatus {
  chainId: number
  ok: boolean
}

interface HealthResponse {
  ok: boolean
  chains: ZapperStatus[]
}

const useZapHealthcheck = (chainId: AvailableChain) => {
  const api = useAtomValue(zapperApiUrlAtom)
  const { data } = useQuery({
    queryKey: ['zapper-healthcheck', chainId, api],
    queryFn: async (): Promise<ZapperStatus[]> => {
      const response = await fetch(`${api}health`)

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const json: HealthResponse = await response.json()
      return json.chains
    },
    staleTime: 120_000,
    refetchInterval: 60_000,
  })

  const status = data?.find((status) => status.chainId === chainId)
  if (!status) {
    return true
  }

  return status.ok
}

export default useZapHealthcheck
