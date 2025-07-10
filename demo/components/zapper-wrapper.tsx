import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Zapper, ZapperProps } from '@reserve-protocol/react-zapper'
import React from 'react'
import { useAccount } from 'wagmi'

const ZapperWithConnect = (props: ZapperProps) => {
  const { openConnectModal } = useConnectModal()
  return <Zapper {...props} connectWallet={openConnectModal} />
}

const ZapperWrapper = (props: ZapperProps) => {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return <ZapperWithConnect {...props} />
  }

  return <Zapper {...props} />
}

export default ZapperWrapper
