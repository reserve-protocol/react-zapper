import { useQueryClient } from '@tanstack/react-query'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import type { ProviderId } from '../../utils/providers'
import {
  useTrackIndexDTFZap,
  useTrackIndexDTFZapClick,
  useTrackIndexDTFZapError,
} from '../../utils/tracking'
import TransactionButton, {
  TransactionButtonContainer,
} from '../transaction-button'
import { Button } from '../ui/button'
import {
  openZapMintModalAtom,
  openingFromSimpleModeAtom,
  zapDustWarningCheckboxAtom,
  zapHighDustValueAtom,
  zapHighPriceImpactAtom,
  zapMintInputCachedAtom,
  zapOngoingTxAtom,
  zapTxReceiptAtom,
  zapperCurrentTabAtom,
  zapPriceImpactWarningCheckboxAtom,
  zapRefetchAtom,
} from './atom'
import ZapDustWarningCheckbox from './zap-dust-warning-checkbox'
import ZapErrorMsg, { ZapTxErrorMsg } from './zap-error-msg'
import ZapSuccess from './zap-success'
import ZapPriceImpactWarningCheckbox from './zap-warning-checkbox'
import { minBigInt } from '@/utils'

// EIP-7825: Transaction Gas Limit Cap
const FUSAKA_GAS_LIMIT = 2n ** 24n

const GetStartedButton = ({
  fetchingZapper,
  showTxButton,
  disabled,
}: {
  fetchingZapper: boolean
  showTxButton: boolean
  disabled?: boolean
}) => {
  const setOpenModal = useSetAtom(openZapMintModalAtom)
  const setOpeningFromSimple = useSetAtom(openingFromSimpleModeAtom)

  const handleClick = () => {
    setOpeningFromSimple(true)
    setOpenModal(true)
  }

  return (
    <Button
      size="lg"
      className="w-full rounded-xl"
      disabled={disabled || fetchingZapper || !showTxButton}
      onClick={handleClick}
    >
      {fetchingZapper ? 'Loading...' : 'Get started'}
    </Button>
  )
}

const LoadingButton = ({
  fetchingZapper,
  insufficientBalance,
  zapperErrorMessage,
  buttonLabel,
  mode,
}: {
  fetchingZapper: boolean
  insufficientBalance: boolean
  zapperErrorMessage: string
  buttonLabel: string
  mode?: 'modal' | 'inline' | 'simple'
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
      {mode !== 'simple' && <ZapErrorMsg error={zapperErrorMessage} />}
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
  onSuccess,
  mode = 'modal',
  disabled,
}: {
  data: ZapResult
  source?: ProviderId
  chainId: number
  buttonLabel: string
  inputSymbol: string
  outputSymbol: string
  inputAmount: string
  outputAmount: string
  onSuccess?: () => void
  mode?: 'modal' | 'inline' | 'simple'
  disabled?: boolean
}) => {
  const warningAccepted = useAtomValue(zapPriceImpactWarningCheckboxAtom)
  const dustWarningAccepted = useAtomValue(zapDustWarningCheckboxAtom)
  const highPriceImpact = useAtomValue(zapHighPriceImpactAtom)
  const highDustValue = useAtomValue(zapHighDustValueAtom)

  const { trackClick } = useTrackIndexDTFZapClick('overview')
  const { track } = useTrackIndexDTFZap('alert', 'overview')

  const [ongoingTx, setOngoingTx] = useAtom(zapOngoingTxAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const setTxReceipt = useSetAtom(zapTxReceiptAtom)
  const setInputAmountCached = useSetAtom(zapMintInputCachedAtom)
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

  const gasLimit = useMemo(() => {
    const gasMultiplier = chainId === mainnet.id ? 2n : 3n
    return (
      minBigInt(BigInt(gas ?? 0) * gasMultiplier, FUSAKA_GAS_LIMIT) || undefined
    )
  }, [gas, chainId])

  const { error: simulationError, failureReason: simulationFailureReason } =
    useEstimateGas({
      to: tx?.to as Address,
      data: tx?.data as Hex,
      value: BigInt(tx?.value || 0),
      gas: gasLimit,
      chainId,
      query: {
        // Stop simulating once a tx is in flight / completed; otherwise the
        // spent balance makes the simulation fail and forces a quote refetch,
        // overwriting the frozen success result.
        enabled: readyToSubmit && !!tx && !ongoingTx,
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
  })

  const execute = useCallback(() => {
    if (!tx || !readyToSubmit) return
    setInputAmountCached(inputAmount)
    sendTransaction({
      data: tx.data as Hex,
      gas: gasLimit,
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
    gasLimit,
    chainId,
  ])

  const error =
    approvalError ||
    approvalValidationError ||
    approvalTxError ||
    sendError ||
    (txError ? Error(txError) : undefined)

  // `track` is recreated every render, so this effect re-runs constantly. Guard
  // with a ref so success is handled exactly once per tx — otherwise it would
  // re-set `mintSuccess` after the modal close resets it (reopening the sheet).
  const successHandledRef = useRef(false)
  useEffect(() => {
    if (receipt?.status === 'success' && !successHandledRef.current) {
      successHandledRef.current = true
      track('zap_success_notification', inputSymbol, outputSymbol, source)
      setTxReceipt(receipt)
      onSuccess?.()
    }
  }, [
    receipt,
    inputSymbol,
    outputSymbol,
    source,
    track,
    onSuccess,
    setTxReceipt,
  ])

  useEffect(() => {
    // Keep the ongoing-tx flag set after a successful swap so the success
    // screen stays mounted and the quote stays disabled. Otherwise the spent
    // balance refreshes, the kept input turns "insufficient", and the button
    // would tear down before the success message can show.
    if (receipt?.status === 'success') return
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

  if (receipt?.status === 'success' && data) {
    return (
      <ZapSuccess
        hash={data}
        chainId={chainId}
        isMint={currentTab === 'buy'}
        mode={mode}
      />
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {mode !== 'simple' && (
        <>
          <ZapPriceImpactWarningCheckbox priceImpact={truePriceImpact} />
          <ZapDustWarningCheckbox
            dustValue={dustValue ?? undefined}
            amountOutValue={amountOutValue ?? undefined}
          />
        </>
      )}
      <TransactionButton
        disabled={
          disabled ||
          simulationFailed ||
          (mode !== 'simple' && highPriceImpact && !warningAccepted) ||
          (mode !== 'simple' && highDustValue && !dustWarningAccepted) ||
          (approvalNeeded
            ? !approvalReady || confirmingApproval || approving
            : !readyToSubmit || loadingTx || validatingTx)
        }
        loading={approving || loadingTx || validatingTx || confirmingApproval}
        gas={readyToSubmit ? gasLimit : undefined}
        onClick={() => {
          if (disabled) return
          setOngoingTx(true)
          setTxReceipt(undefined)
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
      {mode !== 'simple' && <ZapTxErrorMsg error={error} />}
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
  mode = 'modal',
  disabled,
}: {
  data?: ZapResult
  source?: ProviderId
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
  mode?: 'modal' | 'inline' | 'simple'
  disabled?: boolean
}) => {
  const zapOngoingTx = useAtomValue(zapOngoingTxAtom)

  // Simple mode: show Get Started button instead of transaction button
  if (mode === 'simple' && !zapOngoingTx) {
    return (
      <GetStartedButton
        fetchingZapper={fetchingZapper}
        showTxButton={showTxButton}
        disabled={disabled}
      />
    )
  }

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
      mode={mode}
      disabled={disabled}
    />
  ) : (
    <TransactionButtonContainer disabled={disabled}>
      <LoadingButton
        fetchingZapper={fetchingZapper}
        insufficientBalance={insufficientBalance}
        zapperErrorMessage={zapperErrorMessage}
        buttonLabel={buttonLabel}
        mode={mode}
      />
    </TransactionButtonContainer>
  )
}

export default SubmitZap
