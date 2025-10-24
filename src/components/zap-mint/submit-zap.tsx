import { useQueryClient } from '@tanstack/react-query'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo } from 'react'
import { Address, erc20Abi, Hex } from 'viem'
import { mainnet } from 'viem/chains'
import {
  useEstimateGas,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi'
import useContractWrite from '../../hooks/useContractWrite'
import useWatchTransaction from '../../hooks/useWatchTransaction'
import { ZapResult } from '../../types/api'
import { formatCurrency } from '../../utils/format'
import {
  useTrackIndexDTFZap,
  useTrackIndexDTFZapClick,
  useTrackIndexDTFZapError,
} from '../../utils/tracking'
import FusionTokenLogo from '../fusion-token-logo'
import TransactionButton, {
  TransactionButtonContainer,
} from '../transaction-button'
import { Button } from '../ui/button'
import {
  zapDustWarningCheckboxAtom,
  zapHighDustValueAtom,
  zapHighPriceImpactAtom,
  zapMintInputCachedAtom,
  zapOngoingTxAtom,
  zapperCurrentTabAtom,
  zapPriceImpactWarningCheckboxAtom,
  zapRefetchAtom,
} from './atom'
import ZapDustWarningCheckbox from './zap-dust-warning-checkbox'
import ZapErrorMsg, { ZapTxErrorMsg } from './zap-error-msg'
import ZapPriceImpactWarningCheckbox from './zap-warning-checkbox'

const LoadingButton = ({
  fetchingZapper,
  insufficientBalance,
  zapperErrorMessage,
  buttonLabel,
}: {
  fetchingZapper: boolean
  insufficientBalance: boolean
  zapperErrorMessage: string
  buttonLabel: string
}) => {
  return (
    <>
      <Button size="lg" className="w-full rounded-xl" disabled>
        {fetchingZapper
          ? 'Loading...'
          : insufficientBalance
          ? 'Insufficient balance'
          : buttonLabel}
      </Button>
      <ZapErrorMsg error={zapperErrorMessage} />
    </>
  )
}

const SubmitZapButton = ({
  data: {
    tokenIn,
    tokenOut,
    approvalNeeded,
    approvalAddress,
    amountIn,
    tx,
    gas,
    truePriceImpact,
    dustValue,
    amountOutValue,
  },
  source,
  chainId,
  buttonLabel,
  inputSymbol,
  outputSymbol,
  inputAmount,
  outputAmount,
  onSuccess,
}: {
  data: ZapResult
  source?: 'zap' | 'odos'
  chainId: number
  buttonLabel: string
  inputSymbol: string
  outputSymbol: string
  inputAmount: string
  outputAmount: string
  onSuccess?: () => void
}) => {
  const warningAccepted = useAtomValue(zapPriceImpactWarningCheckboxAtom)
  const dustWarningAccepted = useAtomValue(zapDustWarningCheckboxAtom)
  const highPriceImpact = useAtomValue(zapHighPriceImpactAtom)
  const highDustValue = useAtomValue(zapHighDustValueAtom)

  const { trackClick } = useTrackIndexDTFZapClick('overview')
  const { track } = useTrackIndexDTFZap('alert', 'overview')

  const setOngoingTx = useSetAtom(zapOngoingTxAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const [inputAmountCached, setInputAmountCached] = useAtom(
    zapMintInputCachedAtom
  )
  const refetchQuote = useAtomValue(zapRefetchAtom)

  const {
    write: approve,
    isReady: approvalReady,
    isLoading: approving,
    hash: approvalHash,
    error: approvalError,
    validationError: approvalValidationError,
    isError: isErrorApproval,
  } = useContractWrite({
    abi: erc20Abi,
    address: tokenIn,
    functionName: 'approve',
    args: [approvalAddress, (BigInt(amountIn) * 120n) / 100n],
    query: { enabled: approvalNeeded },
    chainId,
  })

  const {
    data: approvalReceipt,
    isLoading: confirmingApproval,
    error: approvalTxError,
  } = useWaitForTransactionReceipt({
    hash: approvalHash,
    chainId,
  })

  const addStepOneLabel =
    approvalNeeded && approvalReceipt?.status !== 'success'
  const addStepTwoLabel = approvalReceipt?.status === 'success'
  const readyToSubmit = !approvalNeeded || approvalReceipt?.status === 'success'

  const {
    data,
    isPending: loadingTx,
    sendTransaction,
    error: sendError,
    isError: isErrorSend,
  } = useSendTransaction()

  const gasMultiplier = useMemo(
    () => (chainId === mainnet.id ? 2n : 3n),
    [chainId]
  )

  const { error: simulationError, failureReason: simulationFailureReason } =
    useEstimateGas({
      to: tx?.to as Address,
      data: tx?.data as Hex,
      value: BigInt(tx?.value || 0),
      gas: BigInt(gas ?? 0) * gasMultiplier || undefined,
      chainId,
      query: {
        enabled: readyToSubmit && !!tx,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        refetchInterval: 2_000,
      },
    })

  const simulationFailed = useMemo(
    () => Boolean(simulationError || simulationFailureReason),
    [simulationError, simulationFailureReason]
  )

  const queryClient = useQueryClient()
  useEffect(() => {
    if (simulationFailed) {
      queryClient.setQueriesData({ queryKey: ['zapDeploy'] }, () => undefined)
      queryClient.invalidateQueries({ queryKey: ['zapDeploy'] })
      refetchQuote.fn?.()
    }
  }, [simulationFailed, refetchQuote, queryClient])

  const {
    data: receipt,
    isMining: validatingTx,
    error: txError,
  } = useWatchTransaction({
    hash: data,
    label: `Swapped ${inputSymbol} for ${outputSymbol}`,
    successMessage: {
      title: `Swapped`,
      subtitle: `${formatCurrency(
        Number(inputAmountCached)
      )} ${inputSymbol} for ${formatCurrency(
        Number(outputAmount)
      )} ${outputSymbol}`,
      type: 'success',
      icon: (
        <FusionTokenLogo
          left={{ symbol: inputSymbol, chainId, address: tokenIn }}
          right={{ symbol: outputSymbol, chainId, address: tokenOut }}
        />
      ),
    },
  })

  const execute = useCallback(() => {
    if (!tx || !readyToSubmit) return
    setInputAmountCached(inputAmount)
    sendTransaction({
      data: tx.data as Hex,
      gas: BigInt(gas ?? 0) * gasMultiplier || undefined,
      to: tx.to as Address,
      value: BigInt(tx.value),
      chainId,
    })
  }, [
    tx,
    readyToSubmit,
    setInputAmountCached,
    inputAmount,
    sendTransaction,
    gas,
    gasMultiplier,
    chainId,
  ])

  const error =
    approvalError ||
    approvalValidationError ||
    approvalTxError ||
    sendError ||
    (txError ? Error(txError) : undefined)

  useEffect(() => {
    if (receipt?.status === 'success') {
      track('zap_success_notification', inputSymbol, outputSymbol, source)
      onSuccess?.()
    }
  }, [receipt?.status, inputSymbol, outputSymbol, source, track, onSuccess])

  useEffect(() => {
    if (
      approvalReceipt ||
      approvalTxError ||
      receipt ||
      txError ||
      isErrorApproval ||
      isErrorSend
    ) {
      setOngoingTx(false)
    }
  }, [
    receipt,
    approvalReceipt,
    approvalTxError,
    txError,
    isErrorApproval,
    isErrorSend,
    setOngoingTx,
  ])

  useTrackIndexDTFZapError({
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    zapError: error?.message?.split('\n')[0] || error?.name || '',
    source,
  })

  return (
    <div className="flex flex-col gap-1">
      <ZapPriceImpactWarningCheckbox priceImpact={truePriceImpact} />
      <ZapDustWarningCheckbox
        dustValue={dustValue ?? undefined}
        amountOutValue={amountOutValue ?? undefined}
      />
      <TransactionButton
        disabled={
          simulationFailed ||
          (highPriceImpact && !warningAccepted) ||
          (highDustValue && !dustWarningAccepted) ||
          (approvalNeeded
            ? !approvalReady || confirmingApproval || approving
            : !readyToSubmit || loadingTx || validatingTx)
        }
        loading={approving || loadingTx || validatingTx || confirmingApproval}
        gas={
          readyToSubmit
            ? gas
              ? BigInt(gas) * gasMultiplier
              : undefined
            : undefined
        }
        onClick={() => {
          setOngoingTx(true)
          if (readyToSubmit) {
            trackClick(`zap_${currentTab}`, inputSymbol, outputSymbol, source)
            execute()
          } else {
            trackClick('zap-approve', inputSymbol, outputSymbol, source)
            approve()
          }
        }}
        className="rounded-xl"
      >
        {simulationFailed
          ? 'Simulation failed - Refetching quote'
          : readyToSubmit
          ? `${addStepTwoLabel ? 'Step 2. ' : ''}${buttonLabel}`
          : `${addStepOneLabel ? 'Step 1. ' : ''}Approve use of ${inputSymbol}`}
      </TransactionButton>
      <ZapTxErrorMsg error={error} />
    </div>
  )
}

const SubmitZap = ({
  data,
  source,
  chainId,
  buttonLabel,
  inputSymbol,
  outputSymbol,
  inputAmount,
  outputAmount,
  showTxButton,
  fetchingZapper,
  insufficientBalance,
  zapperErrorMessage,
  onSuccess,
}: {
  data?: ZapResult
  source?: 'zap' | 'odos'
  chainId: number
  buttonLabel: string
  inputSymbol: string
  outputSymbol: string
  inputAmount: string
  outputAmount: string
  showTxButton: boolean
  fetchingZapper: boolean
  insufficientBalance: boolean
  zapperErrorMessage: string
  onSuccess?: () => void
}) => {
  const zapOngoingTx = useAtomValue(zapOngoingTxAtom)

  return (showTxButton || zapOngoingTx) && data ? (
    <SubmitZapButton
      data={data}
      source={source}
      chainId={chainId}
      buttonLabel={buttonLabel}
      inputSymbol={inputSymbol}
      outputSymbol={outputSymbol}
      inputAmount={inputAmount}
      outputAmount={outputAmount}
      onSuccess={onSuccess}
    />
  ) : (
    <TransactionButtonContainer>
      <LoadingButton
        fetchingZapper={fetchingZapper}
        insufficientBalance={insufficientBalance}
        zapperErrorMessage={zapperErrorMessage}
        buttonLabel={buttonLabel}
      />
    </TransactionButtonContainer>
  )
}

export default SubmitZap
