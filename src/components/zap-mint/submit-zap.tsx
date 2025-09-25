import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect } from 'react'
import { Address, erc20Abi } from 'viem'
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import useContractWrite from '../../hooks/useContractWrite'
import useWatchTransaction from '../../hooks/useWatchTransaction'
import { ZapResult } from '../../types/api'
import { formatCurrency } from '../../utils/format'
import {
  useTrackIndexDTFZap,
  useTrackIndexDTFZapClick,
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
} from './atom'
import ZapDustWarningCheckbox from './zap-dust-warning-checkbox'
import ZapErrorMsg, { ZapTxErrorMsg } from './zap-error-msg'
import ZapPriceImpactWarningCheckbox from './zap-warning-checkbox'
import { mainnet } from 'viem/chains'

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
    const multiplier = chainId === mainnet.id ? 2n : 3n

    setInputAmountCached(inputAmount)
    sendTransaction({
      data: tx.data as Address,
      gas: BigInt(gas ?? 0) * multiplier || undefined,
      to: tx.to as Address,
      value: BigInt(tx.value),
      chainId,
    })
  }, [
    tx,
    readyToSubmit,
    inputAmount,
    gas,
    tx?.to,
    tx?.value,
    chainId,
    setInputAmountCached,
    sendTransaction,
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

  return (
    <div className="flex flex-col gap-1">
      <ZapPriceImpactWarningCheckbox priceImpact={truePriceImpact} />
      <ZapDustWarningCheckbox
        dustValue={dustValue ?? undefined}
        amountOutValue={amountOutValue ?? undefined}
      />
      <TransactionButton
        disabled={
          (highPriceImpact && !warningAccepted) ||
          (highDustValue && !dustWarningAccepted) ||
          (approvalNeeded
            ? !approvalReady || confirmingApproval || approving
            : !readyToSubmit || loadingTx || validatingTx)
        }
        loading={approving || loadingTx || validatingTx || confirmingApproval}
        // gas={readyToSubmit ? (gas ? BigInt(gas) : undefined) : approvalGas}
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
        {readyToSubmit
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
