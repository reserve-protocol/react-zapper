import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Address, erc20Abi, formatUnits, Hex } from 'viem'
import { mainnet } from 'viem/chains'
import {
  useEstimateGas,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from 'wagmi'
import useContractWrite from '../../hooks/useContractWrite'
import useQuoteCountdown from '../../hooks/useQuoteCountdown'
import useWatchTransaction from '../../hooks/useWatchTransaction'
import { walletAtom } from '../../state/atoms'
import { ZapResult } from '../../types/api'
import type { ProviderId } from '../../utils/providers'
import { getReceivedAmount } from '../../utils/receipt'
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
  selectedTokenOrDefaultAtom,
  zapDustWarningCheckboxAtom,
  zapHighDustValueAtom,
  zapHighPriceImpactAtom,
  zapFetchingAtom,
  zapMintInputCachedAtom,
  zapOngoingTxAtom,
  zapSuccessAtom,
  zapperCurrentTabAtom,
  zapPriceImpactWarningCheckboxAtom,
  zapRefetchAtom,
} from './atom'
import ZapDustWarningCheckbox from './zap-dust-warning-checkbox'
import ZapErrorMsg, { ZapTxErrorMsg } from './zap-error-msg'
import ZapPriceImpactWarningCheckbox from './zap-warning-checkbox'
import { cn } from '../../utils/cn'
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
      {fetchingZapper ? <Trans>Loading...</Trans> : <Trans>Get started</Trans>}
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
        {fetchingZapper ? (
          <Trans>Loading...</Trans>
        ) : insufficientBalance ? (
          <Trans>Insufficient balance</Trans>
        ) : (
          buttonLabel
        )}
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
    amountInValue,
    amountOut,
    tx,
    gas,
    truePriceImpact,
    dustValue,
    amountOutValue,
    validUntil,
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
  const { t } = useLingui()
  const warningAccepted = useAtomValue(zapPriceImpactWarningCheckboxAtom)
  const dustWarningAccepted = useAtomValue(zapDustWarningCheckboxAtom)
  const highPriceImpact = useAtomValue(zapHighPriceImpactAtom)
  const highDustValue = useAtomValue(zapHighDustValueAtom)

  const { trackClick } = useTrackIndexDTFZapClick('overview')
  const { track } = useTrackIndexDTFZap('alert', 'overview')

  const [ongoingTx, setOngoingTx] = useAtom(zapOngoingTxAtom)
  const currentTab = useAtomValue(zapperCurrentTabAtom)
  const account = useAtomValue(walletAtom)
  const selectedToken = useAtomValue(selectedTokenOrDefaultAtom)
  const setZapSuccess = useSetAtom(zapSuccessAtom)
  const setInputAmountCached = useSetAtom(zapMintInputCachedAtom)
  const refetchQuote = useAtomValue(zapRefetchAtom)
  const fetchingZapper = useAtomValue(zapFetchingAtom)

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

  const {
    error: simulationError,
    failureReason: simulationFailureReason,
    refetch: refetchSimulation,
  } = useEstimateGas({
    to: tx?.to as Address,
    data: tx?.data as Hex,
    value: BigInt(tx?.value || 0),
    gas: gasLimit,
    chainId,
    query: {
      // Stop simulating once a tx is in flight/done — a failed simulation
      // would force a quote refetch and overwrite the frozen result.
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
      queryClient.invalidateQueries({ queryKey: ['zapDeploy'] })
      refetchQuote.fn?.()
    }
  }, [simulationFailed, refetchQuote, queryClient])

  // Once its retries are exhausted, an errored estimateGas query never runs
  // again on its own, and a refreshed quote can carry identical tx bytes
  // (same queryKey). Re-arm the simulation whenever a quote lands while the
  // last simulation failed, so a failed attempt can't leave the CTA disabled
  // forever.
  useEffect(() => {
    if (ongoingTx || !readyToSubmit || !tx || !simulationFailed) return
    refetchSimulation()
  }, [
    tx,
    validUntil,
    ongoingTx,
    readyToSubmit,
    simulationFailed,
    refetchSimulation,
  ])

  const {
    data: receipt,
    isMining: validatingTx,
    error: txError,
  } = useWatchTransaction({
    hash: data,
    label: `Swapped ${inputSymbol} for ${outputSymbol}`,
  })

  // While the CTA is clicked and the quote refresh is paused (signing in the
  // wallet or waiting for the approval to mine), count down to quote expiry.
  const countdownActive =
    ongoingTx && !receipt && !validatingTx && !simulationFailed
  const secondsLeft = useQuoteCountdown(validUntil, countdownActive)
  const quoteExpired = countdownActive && secondsLeft === 0
  const heartbeat =
    countdownActive &&
    secondsLeft !== null &&
    secondsLeft > 0 &&
    secondsLeft <= 5

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

  // `track` changes identity each render, so guard with a ref to handle success
  // exactly once per tx (otherwise it re-sets the snapshot after a close reset).
  const successHandledRef = useRef(false)
  useEffect(() => {
    if (receipt?.status !== 'success' || successHandledRef.current) return
    successHandledRef.current = true
    track('zap_success_notification', inputSymbol, outputSymbol, source)

    // Snapshot the actual received amount from the tx logs (output token credited
    // to the wallet), valued at the quote's implied unit price.
    const outputDecimals = currentTab === 'buy' ? 18 : selectedToken.decimals
    const receivedRaw = account
      ? getReceivedAmount(receipt.logs, tokenOut, account)
      : 0n
    const receivedAmount =
      receivedRaw > 0n
        ? formatUnits(receivedRaw, outputDecimals)
        : formatUnits(BigInt(amountOut || 0), outputDecimals)
    const quotedOut = Number(formatUnits(BigInt(amountOut || 0), outputDecimals))
    const unitPrice = amountOutValue && quotedOut ? amountOutValue / quotedOut : 0

    setZapSuccess({
      isMint: currentTab === 'buy',
      chainId,
      txHash: receipt.transactionHash,
      inputSymbol,
      inputAddress: tokenIn,
      inputValue: amountInValue ?? 0,
      outputSymbol,
      outputAddress: tokenOut,
      receivedAmount,
      receivedValue: Number(receivedAmount) * unitPrice,
    })
    onSuccess?.()
  }, [
    receipt,
    inputSymbol,
    outputSymbol,
    source,
    track,
    onSuccess,
    setZapSuccess,
    currentTab,
    selectedToken,
    account,
    tokenIn,
    tokenOut,
    amountInValue,
    amountOut,
    amountOutValue,
    chainId,
  ])

  useEffect(() => {
    // Keep ongoingTx set after a successful swap so the success screen stays
    // mounted and the quote stays frozen (a balance refresh would otherwise mark
    // the kept input "insufficient" and tear the button down).
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
    // The quote was frozen while the tx was in flight, so after a failure it
    // is stale (often already expired) — replace it right away instead of
    // waiting for the next refresh tick.
    if (approvalTxError || txError || isErrorApproval || isErrorSend) {
      refetchQuote.fn?.()
    }
  }, [
    receipt,
    approvalReceipt,
    approvalTxError,
    txError,
    isErrorApproval,
    isErrorSend,
    setOngoingTx,
    refetchQuote,
  ])

  useTrackIndexDTFZapError({
    tokenIn: tokenIn,
    tokenOut: tokenOut,
    zapError: error?.message?.split('\n')[0] || error?.name || '',
    source,
  })

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
        loading={
          fetchingZapper ||
          approving ||
          loadingTx ||
          validatingTx ||
          confirmingApproval
        }
        gas={readyToSubmit ? gasLimit : undefined}
        onClick={() => {
          if (disabled) return
          setOngoingTx(true)
          setZapSuccess(undefined)
          if (readyToSubmit) {
            trackClick(`zap_${currentTab}`, inputSymbol, outputSymbol, source)
            execute()
          } else {
            trackClick('zap-approve', inputSymbol, outputSymbol, source)
            approve()
          }
        }}
        className={cn('rounded-xl', heartbeat && 'animate-heartbeat')}
      >
        {quoteExpired
          ? t`Quote expired`
          : simulationFailed
          ? t`Simulation failed - Refetching quote`
          : `${
              readyToSubmit
                ? `${addStepTwoLabel ? t`Step 2. ` : ''}${buttonLabel}`
                : `${addStepOneLabel ? t`Step 1. ` : ''}${t`Approve use of ${inputSymbol}`}`
            }${secondsLeft !== null && secondsLeft > 0 ? ` (${secondsLeft}s)` : ''}`}
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
