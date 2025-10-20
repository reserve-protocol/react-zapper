import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { balancesAtom, chainIdAtom, indexDTFAtom } from '../../state/atoms'
import { Token, TokenBalance } from '../../types'
import { reducedZappableTokens } from '../../utils/constants'

export const openZapMintModalAtom = atom(false)
export const zapperCurrentTabAtom = atom<'buy' | 'sell'>('buy')
export const showZapSettingsAtom = atom<boolean>(false)
export const zapMintInputAtom = atomWithReset<string>('')
export const zapMintInputCachedAtom = atom<string>('')
export const indexDTFBalanceAtom = atom<bigint>(0n)
export const zapperDebugAtom = atom<boolean>(false)

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
