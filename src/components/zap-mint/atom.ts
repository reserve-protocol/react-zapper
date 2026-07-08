import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import type { UseQuoteResult } from '../../hooks/useQuote'
import { balancesAtom, chainIdAtom, indexDTFAtom } from '../../state/atoms'
import {
  DisabledSettingsConfig,
  ScheduleCallConfig,
  Token,
  TokenBalance,
} from '../../types'
import { reducedZappableTokens } from '../../utils/constants'

const openZapMintModalBaseAtom = atom(false)
export const zapperCurrentTabAtom = atom<'buy' | 'sell'>('buy')
export const showZapSettingsAtom = atom<boolean>(false)
export const zapMintInputAtom = atomWithReset<string>('')
export const zapMintInputCachedAtom = atom<string>('')
export const indexDTFBalanceAtom = atom<bigint>((get) => {
  const balances = get(balancesAtom)
  const indexDTF = get(indexDTFAtom)
  if (!indexDTF) return 0n
  return balances[indexDTF.id]?.value ?? 0n
})
export const zapperDebugAtom = atom<boolean>(false)
export const sellOnlyAtom = atom<boolean>(false)
export const openingFromSimpleModeAtom = atom<boolean>(false)
export const showContactInfoAtom = atom<boolean>(true)
export const scheduleCallAtom = atom<ScheduleCallConfig | undefined>(undefined)
export const disabledSettingsAtom = atom<DisabledSettingsConfig | undefined>(
  undefined
)

// Snapshot of the last successful zap; drives the success view. Captured at
// confirmation so the view survives the Buy/Sell form unmounting.
export type ZapSuccessData = {
  isMint: boolean
  chainId: number
  txHash: string
  inputSymbol: string
  inputAddress: string
  inputValue: number
  outputSymbol: string
  outputAddress: string
  receivedAmount: string
  receivedValue: number
}
export const zapSuccessAtom = atom<ZapSuccessData | undefined>(undefined)

// The success snapshot is cleared when the modal opens rather than on close,
// so the success view stays rendered through the dialog's fade-out animation.
export const openZapMintModalAtom = atom(
  (get) => get(openZapMintModalBaseAtom),
  (get, set, update: boolean | ((prev: boolean) => boolean)) => {
    const prev = get(openZapMintModalBaseAtom)
    const next = typeof update === 'function' ? update(prev) : update
    if (next && !prev) set(zapSuccessAtom, undefined)
    set(openZapMintModalBaseAtom, next)
  }
)

export const selectedTokenAtom = atom<Token | undefined>(undefined)
export const defaultSelectedTokenAtom = atom<Token>((get) => {
  const chainId = get(chainIdAtom)
  return reducedZappableTokens[chainId][0]
})
export const selectedTokenOrDefaultAtom = atom<Token>((get) => {
  const selectedToken = get(selectedTokenAtom)
  const defaultToken = get(defaultSelectedTokenAtom)
  return selectedToken || defaultToken
})

export const selectedTokenBalanceAtom = atom<TokenBalance | undefined>(
  (get) => {
    const balances = get(balancesAtom)
    const token = get(selectedTokenOrDefaultAtom)
    return balances[token.address]
  }
)

export const tokensAtom = atom<(Token & { balance?: string })[]>((get) => {
  const chainId = get(chainIdAtom)
  const balances = get(balancesAtom)
  return reducedZappableTokens[chainId].map((token) => ({
    ...token,
    balance: balances[token.address]?.balance,
  }))
})

export const tokenInAtom = atom<Token | undefined>((get) => {
  const indexDTF = get(indexDTFAtom)
  const indexDTFToken = indexDTF?.token as unknown as Token
  const currentTab = get(zapperCurrentTabAtom)
  const selectedToken = get(selectedTokenAtom)
  const defaultToken = get(defaultSelectedTokenAtom)
  return currentTab === 'buy' ? selectedToken || defaultToken : indexDTFToken
})

export const tokenOutAtom = atom<Token | undefined>((get) => {
  const indexDTF = get(indexDTFAtom)
  const indexDTFToken = indexDTF?.token
    ? { ...indexDTF.token, address: indexDTF.id }
    : undefined
  const currentTab = get(zapperCurrentTabAtom)
  const selectedToken = get(selectedTokenAtom)
  const defaultToken = get(defaultSelectedTokenAtom)
  return currentTab === 'buy' ? indexDTFToken : selectedToken || defaultToken
})

/**
 * Live quote state lifted from the active Buy/Sell flow so package consumers
 * can observe it via the public `useQuote` hook and render UI around the Zapper.
 */
export const zapQuoteStateAtom = atom<UseQuoteResult>({
  data: undefined,
  loading: false,
  error: undefined,
})

export const slippageAtom = atomWithReset<string>('100')
export const forceMintAtom = atomWithReset<boolean>(false)
export const zapRefetchAtom = atom<{ fn: () => void }>({ fn: () => {} })
export const zapFetchingAtom = atom<boolean>(false)
export const zapOngoingTxAtom = atom<boolean>(false)
export const zapSwapEndpointAtom = atom<string>('')
export const zapPriceImpactWarningCheckboxAtom = atom(false)
export const zapHighPriceImpactAtom = atom<boolean>(false)
export const zapDustWarningCheckboxAtom = atom(false)
export const zapHighDustValueAtom = atom<boolean>(false)
