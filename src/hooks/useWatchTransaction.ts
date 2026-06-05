import { useAtomValue } from 'jotai'
import { ReactNode, useEffect, useRef } from 'react'
import { chainIdAtom } from '../state/atoms'
import { CHAIN_TAGS } from '../utils/chains'
import { Hex, TransactionReceipt } from 'viem'
import { useWaitForTransactionReceipt } from 'wagmi'
import { mixpanelTrack } from '@/utils'

interface WatchOptions {
  hash: Hex | undefined
  label: ReactNode
}

interface WatchResult {
  data?: TransactionReceipt
  isMining?: boolean
  status: 'success' | 'error' | 'pending' | 'idle'
  error?: string
}

// Watch tx status and track history
const useWatchTransaction = ({ hash, label }: WatchOptions): WatchResult => {
  const chainId = useAtomValue(chainIdAtom)
  const trackedRef = useRef<{ [key: string]: boolean }>({})

  const {
    data,
    status,
    error,
    isLoading: isMining,
  } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (!hash) return

    const trackKey = `${hash}-${status}`

    if (trackedRef.current[trackKey]) return

    if (status === 'success' && data) {
      trackedRef.current[trackKey] = true
      mixpanelTrack('transaction', {
        product: label,
        action: 'transaction_succeeded',
        payload: {
          type: label,
          chain: CHAIN_TAGS[chainId],
          hash: hash,
          blocknumber: Number(data.blockNumber),
        },
      })
    } else if (status === 'error') {
      trackedRef.current[trackKey] = true
      mixpanelTrack('transaction', {
        product: label,
        action: 'transaction_reverted',
        payload: {
          type: label,
          chain: CHAIN_TAGS[chainId],
          hash: hash,
          error: error?.message,
        },
      })
    }
  }, [hash, data, status, error, label, chainId])

  return {
    data,
    isMining,
    status,
    error: error?.message,
  }
}

export default useWatchTransaction
