import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { Address } from 'viem'
import { apiUrlAtom } from '../state/atoms'
import zapper from '../types/api'

// Checks whether a wallet is already registered for DTF updates.
// The Reserve API responds with `{ ok, address, registered }`.
export const useContactRegistration = (account?: Address, enabled = true) => {
  const apiUrl = useAtomValue(apiUrlAtom)

  return useQuery({
    queryKey: ['contact-registration', apiUrl, account],
    queryFn: async (): Promise<boolean> => {
      const res = await fetch(zapper.updatesStatus(apiUrl, account!))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return Boolean(json?.registered)
    },
    enabled: !!account && enabled,
    staleTime: 60_000,
    retry: 1,
  })
}
