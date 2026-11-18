import { useConnectModal } from 'solariskit'
import { Zapper, ZapperProps } from '@reserve-protocol/react-zapper'
import React from 'react'
import { useConnection } from 'wagmi'

const ZapperWithConnect = (props: ZapperProps) => {
  const { openConnectModal } = useConnectModal()
  return <Zapper {...props} connectWallet={openConnectModal} />
}

const ZapperWrapper = (props: ZapperProps) => {
  const { isConnected } = useConnection()

  if (!isConnected) {
    return <ZapperWithConnect {...props} />
  }

  return <Zapper {...props} />
}

export default ZapperWrapper
