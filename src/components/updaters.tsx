import { AvailableChain } from '@/utils/chains'
import { useQuery } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import React, { useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useIndexBasket } from '../hooks/use-index-basket'
import { useIndexDTF } from '../hooks/use-index-dtf'
import {
  apiUrlAtom,
  chainIdAtom,
  connectWalletAtom,
  indexDTFAtom,
  indexDTFBasketAmountsAtom,
  indexDTFBasketAtom,
  indexDTFBasketPricesAtom,
  indexDTFBasketSharesAtom,
  indexDTFBrandAtom,
  indexDTFIconsAtom,
  QuoteSource,
  quoteSourceAtom,
  walletAtom,
} from '../state/atoms'
import { Token } from '../types'
import TokenBalancesUpdater from './updaters/token-balances-updater'
import SessionTracker from './updaters/session-tracker'
import { zapperDebugAtom } from './zap-mint/atom'

type IndexDTFBrand = {
  dtf?: {
    icon?: string
  }
}

interface UpdatersProps {
  dtfAddress: string
  chainId: AvailableChain
  apiUrl?: string
  connectWallet?: () => void
  defaultSource?: QuoteSource
  debug?: boolean
  mode?: 'modal' | 'inline' | 'simple'
}

const IndexDTFMetadataUpdater: React.FC<{
  dtfAddress: string
}> = ({ dtfAddress }) => {
  const api = useAtomValue(apiUrlAtom)
  const chainId = useAtomValue(chainIdAtom)
  const setIndexDTF = useSetAtom(indexDTFAtom)
  const setIndexDTFBrand = useSetAtom(indexDTFBrandAtom)
  const { data } = useIndexDTF(dtfAddress, chainId)

  const { data: brandData } = useQuery({
    queryKey: ['brand', api, data?.id],
    queryFn: async () => {
      if (!data) return undefined

      const res = await fetch(
        `${api}folio-manager/read?folio=${data.id.toLowerCase()}&chainId=${chainId}`
      )

      const response = await res.json()

      if (response.status !== 'ok')
        throw new Error('Failed to fetch brand data')

      return response.parsedData as IndexDTFBrand
    },
    enabled: !!data,
  })

  useEffect(() => {
    if (data) {
      setIndexDTF(data)
    }
  }, [data, setIndexDTF])

  useEffect(() => {
    if (brandData) {
      setIndexDTFBrand(brandData)
    }
  }, [brandData, setIndexDTFBrand])

  return null
}

const IndexDTFBasketUpdater: React.FC<{
  dtfAddress: string
}> = ({ dtfAddress }) => {
  const chainId = useAtomValue(chainIdAtom)
  const setBasket = useSetAtom(indexDTFBasketAtom)
  const setBasketPrices = useSetAtom(indexDTFBasketPricesAtom)
  const setBasketAmounts = useSetAtom(indexDTFBasketAmountsAtom)
  const setBasketShares = useSetAtom(indexDTFBasketSharesAtom)

  const basketResult = useIndexBasket(dtfAddress, chainId)

  useEffect(() => {
    if (basketResult && !basketResult.isLoading && basketResult.data) {
      setBasket(
        basketResult.data.basket.sort(
          (a: Token, b: Token) =>
            Number(basketResult.data.shares[b.address]) -
            Number(basketResult.data.shares[a.address])
        )
      )
      setBasketPrices(basketResult.data.prices)
      setBasketAmounts(basketResult.data.amounts)
      setBasketShares(basketResult.data.shares)
    }
  }, [
    basketResult,
    setBasket,
    setBasketPrices,
    setBasketAmounts,
    setBasketShares,
  ])

  return null
}

const ApiUrlUpdater = ({ apiUrl }: { apiUrl?: string }) => {
  const setApiUrl = useSetAtom(apiUrlAtom)

  useEffect(() => {
    if (apiUrl) {
      setApiUrl(apiUrl)
    }
  }, [apiUrl, setApiUrl])

  return null
}

const ChainIdUpdater: React.FC<{ chainId: AvailableChain }> = ({ chainId }) => {
  const setChainId = useSetAtom(chainIdAtom)

  useEffect(() => {
    setChainId(chainId)
  }, [chainId, setChainId])

  return null
}

const WalletUpdater = () => {
  const setWallet = useSetAtom(walletAtom)
  const { address } = useAccount()

  useEffect(() => {
    setWallet(address)
  }, [address, setWallet])

  return null
}

const ConnectWalletUpdater = ({ connect }: { connect?: () => void }) => {
  const setConnectWallet = useSetAtom(connectWalletAtom)

  useEffect(() => {
    if (connect) {
      setConnectWallet({ fn: connect })
    }
  }, [connect, setConnectWallet])

  return null
}

const IndexDTFIconsUpdater = () => {
  const api = useAtomValue(apiUrlAtom)
  const setIcons = useSetAtom(indexDTFIconsAtom)

  const { data } = useQuery({
    queryKey: ['icons', api],
    queryFn: async () => {
      const res = await fetch(api + 'dtf/icons')
      return res.json()
    },
  })

  useEffect(() => {
    if (data) {
      setIcons(data)
    }
  }, [data, setIcons])

  return null
}

const QuoteSourceUpdater = ({
  defaultSource,
}: {
  defaultSource?: QuoteSource
}) => {
  const setQuoteSource = useSetAtom(quoteSourceAtom)

  useEffect(() => {
    setQuoteSource(defaultSource ?? 'best')
  }, [defaultSource, setQuoteSource])

  return null
}

const DebugUpdater = ({ debug }: { debug?: boolean }) => {
  const setDebug = useSetAtom(zapperDebugAtom)

  useEffect(() => {
    setDebug(debug ?? false)
  }, [debug, setDebug])

  return null
}

const Updaters: React.FC<UpdatersProps> = ({
  dtfAddress,
  chainId,
  apiUrl,
  connectWallet,
  defaultSource,
  debug,
  mode = 'modal',
}) => {
  return (
    <>
      <ConnectWalletUpdater connect={connectWallet} />
      <ApiUrlUpdater apiUrl={apiUrl} />
      <WalletUpdater />
      <ChainIdUpdater chainId={chainId} />
      <IndexDTFMetadataUpdater dtfAddress={dtfAddress} />
      <IndexDTFBasketUpdater dtfAddress={dtfAddress} />
      <IndexDTFIconsUpdater />
      <TokenBalancesUpdater dtfAddress={dtfAddress} />
      <QuoteSourceUpdater defaultSource={defaultSource} />
      <DebugUpdater debug={debug} />
      <SessionTracker mode={mode} />
    </>
  )
}

export default Updaters
