import { useCallback, useMemo } from 'react'
import {
  useEstimateGas,
  useSimulateContract,
  UseSimulateContractParameters,
  useWriteContract,
} from 'wagmi'
import { encodeFunctionData, type Abi, type ContractFunctionName } from 'viem'

// Gas multiplier helper function
const getSafeGasLimit = (gas: bigint, multiplier = 200n) =>
  (gas * multiplier) / 100n

type UseContractWriteResult = {
  gas: bigint | undefined
  validationError: Error | null
  isReady: boolean
  isLoading: boolean
  hash: ReturnType<typeof useWriteContract>['data']
  write: () => void
  writeContract: () => void
  isError: boolean
  error: Error | null
}

/**
 * Hook for contract write operations with gas estimation and validation
 * Extends wagmi to include gas estimate and gas limit multiplier
 */
const useContractWrite = <
  TAbi extends Abi | readonly unknown[],
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'>
>(
  call: UseSimulateContractParameters<
    TAbi,
    TFunctionName
  > = {} as UseSimulateContractParameters<TAbi, TFunctionName>
): UseContractWriteResult => {
  const { data, error, isSuccess } = useSimulateContract(
    call as UseSimulateContractParameters
  )

  const enabled =
    call?.query?.enabled !== undefined ? call?.query?.enabled : true

  // Development logging commented out to avoid process reference
  // if (call.args && enabled) {
  //   console.log(
  //     'callData',
  //     encodeFunctionData({
  //       abi: call.abi as any,
  //       functionName: call.functionName,
  //       args: call.args as any,
  //     })
  //   )
  // }

  const { data: gas } = useEstimateGas(
    data?.request && enabled
      ? {
          to: data.request.address,
          data: encodeFunctionData({
            abi: call.abi as Abi,
            functionName: call.functionName,
            args: call.args as readonly unknown[],
          }),
        }
      : undefined
  )

  const contractWrite = useWriteContract()
  const { writeContract } = contractWrite

  const handleWrite = useCallback(() => {
    if (data?.request && gas) {
      writeContract({ ...data.request, gas: getSafeGasLimit(gas) })
    }
  }, [data?.request, writeContract, gas])

  return useMemo<UseContractWriteResult>(
    () => ({
      gas,
      validationError: error,
      isReady: !!data?.request && isSuccess,
      isLoading: contractWrite.isPending,
      hash: contractWrite.data,
      write: handleWrite,
      writeContract: () => {
        if (data?.request && gas) {
          writeContract({ ...data.request, gas: getSafeGasLimit(gas) })
        }
      },
      isError: !!error || contractWrite.isError,
      error: error || contractWrite.error,
    }),
    [
      error,
      contractWrite,
      gas,
      handleWrite,
      data?.request,
      isSuccess,
      writeContract,
    ]
  )
}

export default useContractWrite
