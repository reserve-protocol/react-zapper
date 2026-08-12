import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Address, erc20Abi, parseUnits } from 'viem'
import { useAccount, useConfig, useSwitchChain, useWriteContract } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { AvailableChain, CHAIN_TAGS } from '@/utils/chains'
import { Button } from './ui/button'
import { ChainInput } from './quotes-table'

type ApproveInputsProps = {
  chains: AvailableChain[]
  inputs: Record<number, ChainInput>
  /**
   * Zapper spender per chain, as reported by that chain's quotes
   * (`ZapResult.approvalAddress`) — it isn't a constant anywhere in the
   * package, so a chain can't be approved before it has quoted once.
   */
  approvalTargets: Record<number, Address | undefined>
}

/**
 * Simulation is the reason this exists: an unapproved input makes every row on
 * that chain unverifiable, so the inputs are approved once, for the whole
 * table, instead of per row. Every configured input is approved — re-approving
 * an already-approved token is harmless, and checking allowances first would
 * only trade a redundant transaction for extra state.
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

  const pending = chains.filter(
    (chainId) => approvalTargets[chainId] && Number(inputs[chainId].amount) > 0
  )

  const approveAll = async () => {
    setBusy(true)
    setError(null)
    try {
      for (const chainId of pending) {
        const { token, amount } = inputs[chainId]
        if (connectedChain !== chainId) await switchChainAsync({ chainId })
        const hash = await writeContractAsync({
          chainId,
          abi: erc20Abi,
          address: token.address,
          functionName: 'approve',
          // The widget approves 20% above the quoted input; matching it means a
          // small amount bump doesn't demand a new approval.
          args: [
            approvalTargets[chainId]!,
            (parseUnits(amount, token.decimals) * 120n) / 100n,
          ],
        })
        await waitForTransactionReceipt(config, { hash, chainId })
      }
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
        disabled={busy || pending.length === 0}
        onClick={approveAll}
      >
        {busy ? 'Approving…' : `Create approvals (${pending.length})`}
      </Button>
      <p className="text-xs text-muted-foreground">
        {pending.length === 0
          ? 'Quote once so the zapper reports its spender for each chain.'
          : `Approves ${pending
              .map(
                (chainId) =>
                  `${CHAIN_TAGS[chainId]} ${inputs[chainId].token.symbol}`
              )
              .join(', ')} — one transaction per chain.`}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export default ApproveInputs
