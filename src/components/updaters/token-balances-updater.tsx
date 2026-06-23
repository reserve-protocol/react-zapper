import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { Address, erc20Abi, ethAddress, formatUnits } from 'viem'
import { useBalance } from 'wagmi'
import { useWatchReadContracts } from '../../hooks/use-watch-read-contracts'
import {
  balancesAtom,
  chainIdAtom,
  indexDTFAtom,
  walletAtom,
} from '../../state/atoms'
import { TokenBalance } from '../../types'
import { reducedZappableTokens } from '../../utils/constants'

const balancesCallAtom = atom((get) => {
  const wallet = get(walletAtom)
  const chainId = get(chainIdAtom)
  const indexDTF = get(indexDTFAtom)

  if (!wallet) {
    return undefined
  }

  const tokens: [Address, number][] = reducedZappableTokens[chainId]
    .slice(1)
    .map((token) => [token.address, token.decimals])

  if (indexDTF) {
    tokens.unshift([indexDTF.id, indexDTF.token.decimals])
  }

  return {
    tokens: tokens ?? [],
    calls: (tokens ?? []).map(([address]) => ({
      address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet],
      chainId,
    })),
  }
})

export const TokenBalancesUpdater = () => {
  const { tokens, calls } = useAtomValue(balancesCallAtom) ?? {}
  const setBalances = useSetAtom(balancesAtom)
  const wallet = useAtomValue(walletAtom)
  const chainId = useAtomValue(chainIdAtom)

  const { data }: { data: bigint[] | undefined } = useWatchReadContracts({
    contracts: calls,
    allowFailure: false,
  })
  const { data: balance } = useBalance({
    address: wallet || undefined,
    chainId,
  })

  useEffect(() => {
    if (data && tokens) {
      const balances = data.reduce((prev, value, index) => {
        const [address, decimals] = tokens[index]
        prev[address] = {
          balance: formatUnits(value, decimals),
          value,
          decimals,
        }

        return prev
      }, {} as Record<string, TokenBalance>)

      balances[ethAddress] = {
        balance: balance ? balance.formatted : '0',
        value: balance ? balance.value : 0n,
        decimals: 18,
      }

      setBalances(balances)
    }
  }, [data, balance, setBalances, tokens])

  return null
}

export default TokenBalancesUpdater
