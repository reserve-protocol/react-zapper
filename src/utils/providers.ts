import type { ComponentType } from 'react'
import { Zap } from 'lucide-react'
import EnsoIcon from '../components/icons/enso'
import OdosIcon from '../components/icons/odos'
import VeloraIcon from '../components/icons/velora'
import zapper, { ZapPayload } from '../types/api'
import { AvailableChain, ChainId } from './chains'

export type ProviderId = 'zap' | 'odos' | 'velora' | 'enso'

export type ProviderKind = 'native' | 'aggregator'

export type IconComponent = ComponentType<{
  size?: string | number
  className?: string
}>

export type EndpointParams = ZapPayload

export interface ProviderConfig {
  id: ProviderId
  label: string
  kind: ProviderKind
  Icon: IconComponent
  /**
   * URL slug used by the reserve-api for aggregator providers
   * (e.g. `odos` => `{apiUrl}odos/swap`). Undefined for the native zap provider.
   */
  apiSlug?: string
  /**
   * Builds the swap endpoint URL for the provider. Returns null when parameters
   * are insufficient (the caller should skip the fetch).
   */
  buildEndpoint: (params: EndpointParams) => string | null
}

/**
 * Per-chain × per-provider enablement matrix.
 *
 * Flip a boolean to `false` to disable a source on a specific chain — e.g. if
 * Odos consistently underperforms on BSC we can set
 * `PROVIDER_ENABLED[ChainId.BSC].odos = false` and the zapper will skip it
 * automatically (both in `best` mode and as an option in the settings UI).
 */
export const PROVIDER_ENABLED: Partial<
  Record<AvailableChain, Record<ProviderId, boolean>>
> = {
  [ChainId.Mainnet]: { zap: true, odos: true, velora: true, enso: true },
  [ChainId.Base]: { zap: true, odos: true, velora: true, enso: true },
  [ChainId.Arbitrum]: { zap: true, odos: true, velora: true, enso: true },
  [ChainId.BSC]: { zap: true, odos: true, velora: true, enso: true },
}

const buildAggregatorEndpoint =
  (slug: string) =>
  (params: EndpointParams): string | null => {
    if (
      !params.tokenIn ||
      !params.tokenOut ||
      !params.signer ||
      isNaN(Number(params.amountIn)) ||
      Number(params.amountIn) === 0
    ) {
      return null
    }
    return zapper.aggregator(slug, params)
  }

const buildZapEndpoint = (params: EndpointParams): string | null => {
  if (
    !params.tokenIn ||
    !params.tokenOut ||
    !params.signer ||
    isNaN(Number(params.amountIn)) ||
    Number(params.amountIn) === 0
  ) {
    return null
  }
  return zapper.zap(params)
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  zap: {
    id: 'zap',
    label: 'Zap',
    kind: 'native',
    Icon: Zap,
    buildEndpoint: buildZapEndpoint,
  },
  odos: {
    id: 'odos',
    label: 'Odos',
    kind: 'aggregator',
    apiSlug: 'odos',
    Icon: OdosIcon,
    buildEndpoint: buildAggregatorEndpoint('odos'),
  },
  velora: {
    id: 'velora',
    label: 'Velora',
    kind: 'aggregator',
    apiSlug: 'velora',
    Icon: VeloraIcon,
    buildEndpoint: buildAggregatorEndpoint('velora'),
  },
  enso: {
    id: 'enso',
    label: 'Enso',
    kind: 'aggregator',
    apiSlug: 'enso',
    Icon: EnsoIcon,
    buildEndpoint: buildAggregatorEndpoint('enso'),
  },
}

export const ALL_PROVIDER_IDS: ProviderId[] = [
  'zap',
  'odos',
  'velora',
  'enso',
]

export const isProviderEnabled = (
  chainId: AvailableChain | number,
  id: ProviderId
): boolean => {
  const chainMap = PROVIDER_ENABLED[chainId as AvailableChain]
  return chainMap?.[id] ?? false
}

export const getEnabledProviders = (
  chainId: AvailableChain | number
): ProviderConfig[] =>
  ALL_PROVIDER_IDS.filter((id) => isProviderEnabled(chainId, id)).map(
    (id) => PROVIDERS[id]
  )

export const getEnabledAggregators = (
  chainId: AvailableChain | number
): ProviderConfig[] =>
  getEnabledProviders(chainId).filter((p) => p.kind === 'aggregator')
