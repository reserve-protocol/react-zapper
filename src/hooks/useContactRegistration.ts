import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { UPDATES_STORAGE_URL } from '../utils/constants'

// Checks whether a wallet is already registered for DTF updates.
// The worker responds with `{ ok, address, registered }`.
export const useContactRegistration = (account?: Address, enabled = true) =>
  useQuery({
    queryKey: ['contact-registration', account],
    queryFn: async (): Promise<boolean> => {
      const res = await fetch(`${UPDATES_STORAGE_URL}status/${account}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      return Boolean(json?.registered)
    },
    enabled: !!account && enabled,
    staleTime: 60_000,
    retry: 1,
  })
