import { chainIdAtom } from '../state/atoms'
import { ChainId } from '../utils/chains'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem'
import {
  useBlockNumber,
  useReadContract,
  useReadContracts,
  type UseReadContractsParameters,
  type UseReadContractParameters,
  type UseReadContractReturnType,
  type UseReadContractsReturnType,
  type Config,
  type ResolvedRegister,
} from 'wagmi'
import { type ReadContractData, type ReadContractsData } from 'wagmi/query'

type ContractCall = { abi?: unknown; address?: unknown; functionName?: unknown }

const REFRESH_BLOCKS = {
  [ChainId.Mainnet]: 1n,
  [ChainId.Base]: 2n,
  [ChainId.Arbitrum]: 2n,
  [ChainId.BSC]: 2n,
}

export const useShouldRefresh = (chain?: number) => {
  const rTokenChain = useAtomValue(chainIdAtom)
  const chainId = chain || rTokenChain
  const { data: blockNumber } = useBlockNumber({ watch: true, chainId })

  return Boolean(
    blockNumber && blockNumber % (REFRESH_BLOCKS[chainId] || 5n) === 0n
  )
}

export function useWatchReadContract<
  const abi extends Abi | readonly unknown[],
  functionName extends ContractFunctionName<abi, 'pure' | 'view'>,
  args extends ContractFunctionArgs<abi, 'pure' | 'view', functionName>,
  config extends Config = ResolvedRegister['config'],
  selectData = ReadContractData<abi, functionName, args>
>(
  parameters: UseReadContractParameters<
    abi,
    functionName,
    args,
    config,
    selectData
  > = {} as UseReadContractParameters<abi, functionName, args, config, selectData>
): UseReadContractReturnType<abi, functionName, args, selectData> {
  const result = useReadContract(
    parameters as UseReadContractParameters
  ) as UseReadContractReturnType<abi, functionName, args, selectData>
  const shouldRefresh = useShouldRefresh(parameters?.chainId)
  const { refetch } = result

  useEffect(() => {
    if (shouldRefresh) {
      refetch()
    }
  }, [shouldRefresh, refetch])

  return result
}

export function useWatchReadContracts<
  const contracts extends readonly unknown[],
  allowFailure extends boolean = true,
  config extends Config = ResolvedRegister['config'],
  selectData = ReadContractsData<contracts, allowFailure>
>(
  parameters: UseReadContractsParameters<
    contracts,
    allowFailure,
    config,
    selectData
  > = {}
): UseReadContractsReturnType<contracts, allowFailure, selectData> {
  const contracts = (parameters.contracts ?? []) as readonly ContractCall[]
  const isReady =
    contracts.length > 0 &&
    contracts.every(
      ({ abi, address, functionName }) => abi && address && functionName
    )
  // wagmi v3 dropped v2's guard that skipped the query while a contract had no address.
  const result = useReadContracts({
    ...parameters,
    query: {
      ...parameters.query,
      enabled: Boolean(isReady && (parameters.query?.enabled ?? true)),
    },
  } as typeof parameters)
  const shouldRefresh = useShouldRefresh(
    (parameters.contracts?.[0] as { chainId?: number } | undefined)?.chainId
  )
  const { refetch } = result

  useEffect(() => {
    if (shouldRefresh) {
      refetch()
    }
  }, [shouldRefresh, refetch])

  return result
}
