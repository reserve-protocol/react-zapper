import { useAtomValue } from 'jotai'
import mixpanel from 'mixpanel-browser/src/loaders/loader-module-core'
import { ReactNode, useEffect, useRef } from 'react'
import { chainIdAtom } from '../state/atoms'
import { CHAIN_TAGS } from '../utils/chains'
import { Hex, TransactionReceipt } from 'viem'
import { useWaitForTransactionReceipt } from 'wagmi'
import useNotification from './use-notification'

interface WatchOptions {
  hash: Hex | undefined
  label: ReactNode
  successMessage?: {
    title: string
    subtitle?: string
    type?: 'success' | 'error'
    icon?: ReactNode
  }
}

interface WatchResult {
  data?: TransactionReceipt
  isMining?: boolean
  status: 'success' | 'error' | 'pending' | 'idle'
  error?: string
}

// Watch tx status, send notifications and track history
const useWatchTransaction = ({
  hash,
  label,
  successMessage,
}: WatchOptions): WatchResult => {
  const notify = useNotification()
  const chainId = useAtomValue(chainIdAtom)
  const notifiedRef = useRef<{ [key: string]: boolean }>({})

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

    const notificationKey = `${hash}-${status}`

    if (notifiedRef.current[notificationKey]) return

    if (status === 'success' && data) {
      notifiedRef.current[notificationKey] = true
      notify(
        successMessage?.title ?? `Transaction confirmed`,
        successMessage?.subtitle ?? `At block ${Number(data.blockNumber)}`,
        successMessage?.type ?? 'success',
        successMessage?.icon
      )
      mixpanel.track('transaction', {
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
      notifiedRef.current[notificationKey] = true
      notify(`Transaction reverted`, error?.message ?? 'Unknown error', 'error')
      mixpanel.track('transaction', {
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
  }, [
    hash,
    data,
    status,
    error,
    notify,
    successMessage?.title,
    successMessage?.subtitle,
    successMessage?.type,
    successMessage?.icon,
    label,
    chainId,
  ])

  return {
    data,
    isMining,
    status,
    error: error?.message,
  }
}

export default useWatchTransaction
