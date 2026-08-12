import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Address, erc20Abi, parseUnits } from 'viem'
import {
  useAccount,
  useConfig,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { AvailableChain, CHAIN_TAGS } from '@/utils/chains'
import { Button } from './ui/button'
import { ChainInput } from './quotes-table'

type ApproveInputsProps = {
  chains: AvailableChain[]
  inputs: Record<number, ChainInput>
  /**
   * Zapper spender per chain, as reported by that chain's quotes
   * (`ZapResult.approvalAddress`) — a chain can't be approved before it has
   * quoted at least once.
   */
  approvalTargets: Record<number, Address | undefined>
}

/**
 * Simulation is the reason this exists: an unapproved input makes every row on
 * that chain unverifiable, so the inputs are approved once, for the whole
 * table, instead of per row.
 */
const ApproveInputs = ({
  chains,
  inputs,
  approvalTargets,
}: ApproveInputsProps) => {
  const { address, chainId: connectedChain } = useAccount()
  const config = useConfig()
  const queryClient = useQueryClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The widget approves 20% above the quoted input; matching it means a small
  // amount bump doesn't demand a new approval.
  const required = (chainId: number) => {
    const input = inputs[chainId]
    if (!input || !(Number(input.amount) > 0)) return null
    return (parseUnits(input.amount, input.token.decimals) * 120n) / 100n
  }

  // Only the chains whose spender is known can be read; the rest simply stay
  // out of the allowance query (and out of `missing`).
  const readable = address
    ? chains.filter((chainId) => !!approvalTargets[chainId])
    : []

  const { data: allowances, refetch: refetchAllowances } = useReadContracts({
    allowFailure: false,
    contracts: readable.map((chainId) => ({
      chainId,
      abi: erc20Abi,
      address: inputs[chainId].token.address,
      functionName: 'allowance' as const,
      args: [address!, approvalTargets[chainId]!] as const,
    })),
  })

  const missing = readable.filter((chainId, index) => {
    const needed = required(chainId)
    if (needed == null) return false
    const allowance = allowances?.[index]
    return allowance == null || allowance < needed
  })

  const approveAll = async () => {
    setBusy(true)
    setError(null)
    try {
      for (const chainId of missing) {
        const target = approvalTargets[chainId]
        const needed = required(chainId)
        if (!target || needed == null) continue
        if (connectedChain !== chainId) await switchChainAsync({ chainId })
        const hash = await writeContractAsync({
          chainId,
          abi: erc20Abi,
          address: inputs[chainId].token.address,
          functionName: 'approve',
          args: [target, needed],
        })
        await waitForTransactionReceipt(config, { hash, chainId })
      }
      await refetchAllowances()
      // Re-quote so the simulation column moves off "approval needed".
      await queryClient.invalidateQueries({ queryKey: ['dtf-zap-quote'] })
    } catch (e) {
      setError(e instanceof Error ? e.message.split('\n')[0] : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!address) return null

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        disabled={busy || missing.length === 0}
        onClick={approveAll}
      >
        {busy
          ? 'Approving…'
          : missing.length === 0
            ? 'Inputs approved'
            : `Create approvals (${missing.length})`}
      </Button>
      <p className="text-xs text-muted-foreground">
        {missing.length === 0
          ? 'Every chain input is approved for the zapper.'
          : `Needs approval: ${missing
              .map((chainId) => `${CHAIN_TAGS[chainId]} ${inputs[chainId].token.symbol}`)
              .join(', ')}. One transaction per chain.`}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default ApproveInputs
