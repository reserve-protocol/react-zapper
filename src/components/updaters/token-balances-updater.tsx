import { useQuery } from '@tanstack/react-query'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { Address, erc20Abi, ethAddress, formatUnits } from 'viem'
import { useBalance } from 'wagmi'
import { useWatchReadContracts } from '../../hooks/use-watch-read-contracts'
import {
  apiUrlAtom,
  balancesAtom,
  chainIdAtom,
  indexDTFAtom,
  tokenSelectorLoadingAtom,
  walletAtom,
  zappableTokenOrderAtom,
} from '../../state/atoms'
import { TokenBalance } from '../../types'
import { reducedZappableTokens } from '../../utils/constants'
import { sortTokensByUsdValue } from '../../utils/token-order'

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
  const apiUrl = useAtomValue(apiUrlAtom)
  const [tokenOrder, setTokenOrder] = useAtom(zappableTokenOrderAtom)
  const setSelectorLoading = useSetAtom(tokenSelectorLoadingAtom)

  const erc20Query = useWatchReadContracts({
    contracts: calls,
    allowFailure: false,
  })
  const data = erc20Query.data as bigint[] | undefined
  const nativeQuery = useBalance({
    address: wallet || undefined,
    chainId,
  })
  const { data: balance } = nativeQuery

  const pricesQuery = useQuery({
    queryKey: ['zappable-token-prices', chainId, apiUrl],
    queryFn: async () => {
      const addresses = reducedZappableTokens[chainId]
        .map((token) => token.address)
        .join(',')
      const response = await fetch(
        `${apiUrl}current/prices?chainId=${chainId}&tokens=${addresses}`
      )
      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.status}`)
      }
      const data: { address?: string; price?: number }[] = await response.json()
      return data.reduce((acc, { address, price }) => {
        if (address && typeof price === 'number') {
          acc[address.toLowerCase()] = price
        }
        return acc
      }, {} as Record<string, number>)
    },
    enabled: !!wallet,
    staleTime: Infinity,
    retry: 2,
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

  // The frozen order only applies to the current wallet/chain
  useEffect(() => {
    setTokenOrder(undefined)
  }, [wallet, chainId, setTokenOrder])

  const erc20Settled = erc20Query.isSuccess || erc20Query.isError
  const nativeSettled = nativeQuery.isSuccess || nativeQuery.isError
  const pricesSettled = pricesQuery.isSuccess || pricesQuery.isError

  // Freeze the token list order (by USD value of holdings) once balances and
  // prices first resolve. If anything failed, freeze the default order so the
  // selector skeleton always resolves.
  useEffect(() => {
    if (!wallet) {
      setSelectorLoading(false)
      return
    }
    if (tokenOrder !== undefined) return
    if (!erc20Settled || !nativeSettled || !pricesSettled) {
      setSelectorLoading(true)
      return
    }

    const zappable = reducedZappableTokens[chainId]
    const prices = pricesQuery.data
    const sortable =
      erc20Query.isSuccess &&
      nativeQuery.isSuccess &&
      pricesQuery.isSuccess &&
      !!prices &&
      !!data &&
      !!tokens &&
      !!balance

    if (!sortable) {
      setTokenOrder(zappable.map((token) => token.address.toLowerCase()))
      setSelectorLoading(false)
      return
    }

    const formatted: Record<string, string> = {
      [ethAddress.toLowerCase()]: balance.formatted,
    }
    tokens.forEach(([address, decimals], index) => {
      formatted[address.toLowerCase()] = formatUnits(data[index], decimals)
    })

    setTokenOrder(sortTokensByUsdValue(zappable, formatted, prices))
    setSelectorLoading(false)
  }, [
    wallet,
    chainId,
    tokenOrder,
    erc20Settled,
    nativeSettled,
    pricesSettled,
    erc20Query.isSuccess,
    nativeQuery.isSuccess,
    pricesQuery.isSuccess,
    pricesQuery.data,
    data,
    tokens,
    balance,
    setTokenOrder,
    setSelectorLoading,
  ])

  return null
}

export default TokenBalancesUpdater
