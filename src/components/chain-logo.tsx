import React, { SVGProps } from 'react'
import { ChainId } from '../utils/chains'
import Base from './icons/Base'
import Ethereum from './icons/Ethereum'
import Arbitrum from './icons/Arbitrum'
import BSC from './icons/BSC'

export const chainIcons: Record<number | string, React.FC<SVGProps<SVGSVGElement>>> = {
  [ChainId.Mainnet]: Ethereum,
  [ChainId.Base]: Base,
  [ChainId.Arbitrum]: Arbitrum,
  [ChainId.BSC]: BSC,
}

interface Props extends SVGProps<SVGSVGElement> {
  chain: number | string
}

const ChainLogo = ({ chain, ...props }: Props) => {
  const Icon = chainIcons[chain]

  return Icon ? <Icon {...props} /> : <></>
}

export default React.memo(ChainLogo)
