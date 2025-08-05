import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { apiUrlAtom } from '@/state/atoms'

// Available chain IDs type
type AvailableChain = number

interface ZapperStatus {
  chainId: number
  ok: boolean
}

const useZapHealthcheck = (chainId: AvailableChain) => {
  const api = useAtomValue(apiUrlAtom)
  const { data } = useQuery({
    queryKey: ['zapper-healthcheck', chainId, api],
    queryFn: async (): Promise<ZapperStatus[]> => {
      const response = await fetch(`${api}zapper/healthcheck`)

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      return response.json()
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
