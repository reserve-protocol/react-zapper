import type { ProviderId } from '../providers'
import { cowswapAdapter } from './cowswap'
import type { RfqAdapter } from './types'

export * from './types'
export {
  applySlippage,
  computeEthFlowOrderUid,
  cowswapAdapter,
  COWSWAP_APP_DATA,
  COWSWAP_APP_DATA_HASH,
  COWSWAP_ORDER_VALIDITY_SECONDS,
  ETHFLOW_ORDER_VALIDITY_SECONDS,
  mapCowQuoteToZapResult,
  type CowRfqOrder,
} from './cowswap'

export const RFQ_ADAPTERS: Partial<Record<ProviderId, RfqAdapter>> = {
  cowswap: cowswapAdapter,
}

export const isRfqProvider = (id: ProviderId): boolean => id in RFQ_ADAPTERS
