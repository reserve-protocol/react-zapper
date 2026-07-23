import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex, TypedDataDomain } from 'viem'
import { useConfig, useSendTransaction, useSignTypedData } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { zapperCurrentTabAtom } from '../components/zap-mint/atom'
import { indexDTFAtom, walletAtom } from '../state/atoms'
import { RFQ_ADAPTERS } from '../utils/rfq'
import type { RfqOrder, RfqPreparedOrder } from '../utils/rfq/types'
import { trackRfqOrder } from '../utils/tracking'

const POLL_INTERVAL_MS = 4_000
// Solvers may settle right at the order's expiry — give the last poll a
// little room before declaring a timeout.
const POLL_GRACE_MS = 10_000

export type RfqExecutionPhase = 'idle' | 'signing' | 'submitting' | 'filling'

export type RfqFillResult = {
  executedBuyAmount: bigint
  txHash?: string
  orderUid: string
  explorerUrl: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Drives an RFQ order end to end: EIP-712 signature -> submit to the order
 * book -> poll the fill status until fulfilled, a terminal state, or the
 * order's expiry. Success/terminal outcomes are reported via callbacks so the
 * submit button can reuse its existing success/failure paths.
 */
const useRfqOrderExecution = ({
  order,
  tokenIn,
  tokenOut,
  onFilled,
  onTerminal,
}: {
  order?: RfqOrder
  tokenIn: Address
  tokenOut: Address
  onFilled: (result: RfqFillResult) => void
  onTerminal: (
    reason: 'expired' | 'cancelled' | 'timeout',
    notice: string | null
  ) => void
}) => {
  const account = useAtomValue(walletAtom)
  const indexDTF = useAtomValue(indexDTFAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const { signTypedDataAsync } = useSignTypedData()
  const { sendTransactionAsync } = useSendTransaction()
  const wagmiConfig = useConfig()

  const [phase, setPhase] = useState<RfqExecutionPhase>('idle')
  const [orderUid, setOrderUid] = useState<string>()
  const [error, setError] = useState<Error | null>(null)

  // Latest-callback refs so the polling loop never acts on stale closures.
  const onFilledRef = useRef(onFilled)
  onFilledRef.current = onFilled
  const onTerminalRef = useRef(onTerminal)
  onTerminalRef.current = onTerminal

  // Bumping the token invalidates any in-flight run (unmount / re-execute):
  // the stale loop stops without touching state.
  const runTokenRef = useRef(0)
  useEffect(
    () => () => {
      runTokenRef.current++
    },
    []
  )

  const dtfTicker = indexDTF?.token.symbol || ''

  const execute = useCallback(async () => {
    if (!order || !account) return
    const adapter = RFQ_ADAPTERS[order.adapter]
    if (!adapter) return

    const run = ++runTokenRef.current
    const active = () => runTokenRef.current === run
    const analytics = {
      source: order.adapter,
      chainId: order.chainId,
      dtfTicker,
      type: currentTab,
      account,
      tokenIn,
      tokenOut,
    }

    setError(null)
    setOrderUid(undefined)

    let failurePhase: RfqExecutionPhase = 'signing'
    try {
      setPhase('signing')
      const prepared: RfqPreparedOrder = await adapter.prepareOrder(order)
      if (!active()) return

      let uid: string
      let placementTxHash: string | undefined
      if (prepared.mode === 'transaction') {
        // On-chain-placed order (eth-flow): the wallet prompt is a tx, the
        // venue indexes the order from the event — no submit call.
        const txHash = await sendTransactionAsync({
          to: prepared.tx.to,
          data: prepared.tx.data,
          value: prepared.tx.value,
          chainId: order.chainId,
        })
        if (!active()) return

        failurePhase = 'submitting'
        setPhase('submitting')
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          hash: txHash,
          chainId: order.chainId as (typeof wagmiConfig)['chains'][number]['id'],
        })
        if (!active()) return
        if (receipt.status !== 'success') {
          throw new Error('Order placement transaction reverted')
        }
        uid = prepared.orderUid
        placementTxHash = txHash
      } else {
        const signature = (await signTypedDataAsync({
          domain: prepared.typedData.domain as TypedDataDomain,
          types: prepared.typedData.types,
          primaryType: prepared.typedData.primaryType,
          message: prepared.typedData.message,
        })) as Hex
        if (!active()) return

        failurePhase = 'submitting'
        setPhase('submitting')
        uid = await adapter.submitOrder(
          order,
          prepared,
          signature,
          account as Address
        )
        if (!active()) return
      }
      setOrderUid(uid)
      trackRfqOrder({
        status: 'order_submitted',
        orderUid: uid,
        txHash: placementTxHash,
        ...analytics,
      })

      setPhase('filling')
      const startedAt = Date.now()
      const deadline = prepared.validTo * 1000 + POLL_GRACE_MS
      while (active()) {
        try {
          const status = await adapter.getOrderStatus(order.chainId, uid)
          if (!active()) return
          if (status.state === 'fulfilled') {
            trackRfqOrder({
              status: 'order_filled',
              orderUid: uid,
              waitMs: Date.now() - startedAt,
              ...analytics,
            })
            // Keep phase 'filling': the success snapshot swaps the view out,
            // so the button never flashes back to an actionable state.
            onFilledRef.current({
              executedBuyAmount: status.executedBuyAmount,
              txHash: status.txHash,
              orderUid: uid,
              explorerUrl: adapter.orderExplorerUrl(order.chainId, uid),
            })
            return
          }
          if (status.state === 'expired' || status.state === 'cancelled') {
            trackRfqOrder({
              status:
                status.state === 'expired' ? 'order_expired' : 'order_cancelled',
              orderUid: uid,
              waitMs: Date.now() - startedAt,
              ...analytics,
            })
            setPhase('idle')
            onTerminalRef.current(
              status.state,
              status.state === 'expired'
                ? (adapter.expiryNotice?.(order) ?? null)
                : null
            )
            return
          }
        } catch {
          // Transient order-book errors: keep polling until the deadline.
        }
        if (Date.now() >= deadline) {
          trackRfqOrder({
            status: 'order_timeout',
            orderUid: uid,
            waitMs: Date.now() - startedAt,
            ...analytics,
          })
          setPhase('idle')
          onTerminalRef.current('timeout', adapter.expiryNotice?.(order) ?? null)
          return
        }
        await sleep(POLL_INTERVAL_MS)
      }
    } catch (e) {
      if (!active()) return
      const err = e instanceof Error ? e : new Error(String(e))
      trackRfqOrder({
        status:
          failurePhase === 'signing' ? 'order_sign_rejected' : 'order_failed',
        error: err.message.split('\n')[0].slice(0, 180),
        ...analytics,
      })
      setPhase('idle')
      setError(err)
    }
  }, [
    order,
    account,
    signTypedDataAsync,
    sendTransactionAsync,
    wagmiConfig,
    dtfTicker,
    currentTab,
    tokenIn,
    tokenOut,
  ])

  const reset = useCallback(() => {
    runTokenRef.current++
    setPhase('idle')
    setOrderUid(undefined)
    setError(null)
  }, [])

  return {
    phase,
    orderUid,
    error,
    isError: !!error,
    busy: phase !== 'idle',
    execute,
    reset,
  }
}

export default useRfqOrderExecution
