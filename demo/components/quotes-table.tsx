import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { Address, formatUnits, Hex, parseUnits } from 'viem'
import { useConfig } from 'wagmi'
import { estimateGas } from 'wagmi/actions'
import { CHAIN_TAGS } from '@/utils/chains'
import {
  formatCurrency,
  formatPercentage,
  formatToSignificantDigits,
} from '@/utils/format'
import { Token } from '@/types'
import { PLACEHOLDER_SIGNER } from '@/utils/constants'
import { DiscoverDTF } from '../lib/dtf-discover'
import {
  buildZapEndpoint,
  DTF_DECIMALS,
  fetchZapQuote,
  QuoteRequest,
  Simulation,
  SimulateTx,
} from '../lib/zap-quote'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'

export type ChainInput = {
  token: Token
  amount: string
}

export type QuotesTableProps = {
  dtfs: DiscoverDTF[]
  inputs: Record<number, ChainInput>
  prices: Record<number, number | null>
  zapperApiUrl: string
  slippage: number
  forceMint: boolean
  deepLiquidity: boolean
  /**
   * Connected wallet, when there is one: quotes are then signed for a real
   * account and each row's transaction is simulated.
   */
  account?: Address
  /**
   * Reports the chain's zapper spender as soon as a quote reveals it, so the
   * inputs can be approved without a per-row approve button.
   */
  onApprovalTarget: (chainId: number, approvalAddress: Address) => void
  /**
   * Bumped by "Refresh now": part of every row's query key, so a click always
   * fetches a new round instead of re-serving the last one.
   */
  round: number
  /** Rows stay idle until the first refresh — nothing is quoted on page load. */
  armed: boolean
  autoRefreshMs: number | null
}

const SimulationCell = ({
  simulation,
}: {
  simulation: Simulation | null
}) => {
  if (!simulation) {
    return <span className="text-muted-foreground">no wallet</span>
  }
  if (simulation.status === 'ok') return <span className="text-success">ok</span>
  if (simulation.status === 'reverted') {
    return (
      <span className="text-destructive" title={simulation.error}>
        reverts
      </span>
    )
  }
  return (
    <span className="text-muted-foreground" title={simulation.reason}>
      {simulation.reason}
    </span>
  )
}

const impactClass = (value: number) =>
  value > 3
    ? 'text-destructive'
    : value > 1
      ? 'text-warning'
      : 'text-foreground'

const Age = ({ updatedAt }: { updatedAt: number }) => {
  const [, forceRender] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => forceRender((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!updatedAt) return <span className="text-muted-foreground">–</span>
  return <span>{Math.round((Date.now() - updatedAt) / 1000)}s ago</span>
}

const QuoteRow = ({
  dtf,
  input,
  tokenInPrice,
  zapperApiUrl,
  slippage,
  forceMint,
  deepLiquidity,
  account,
  onApprovalTarget,
  round,
  armed,
  autoRefreshMs,
}: Omit<QuotesTableProps, 'dtfs' | 'inputs' | 'prices'> & {
  dtf: DiscoverDTF
  input?: ChainInput
  tokenInPrice: number | null
}) => {
  const amountIn =
    input && Number(input.amount) > 0
      ? parseUnits(input.amount, input.token.decimals).toString()
      : null

  const request: QuoteRequest | null =
    input && amountIn
      ? {
          zapperApiUrl,
          chainId: dtf.chainId,
          tokenIn: input.token.address,
          tokenInDecimals: input.token.decimals,
          tokenInPrice,
          amountIn,
          tokenOut: dtf.address,
          tokenOutPrice: dtf.price ?? null,
          slippage,
          forceMint,
          deepLiquidity,
          signer: account ?? PLACEHOLDER_SIGNER,
        }
      : null

  const config = useConfig()
  // Pure revert check: chainId and account are explicit so wagmi uses the
  // public client for the DTF's chain and never prompts the wallet.
  const simulate: SimulateTx | undefined = account
    ? (tx) =>
        estimateGas(config, {
          chainId: dtf.chainId as (typeof config)['chains'][number]['id'],
          account,
          to: tx.to,
          data: tx.data as Hex,
          value: BigInt(tx.value || 0),
        }).then(() => undefined)
    : undefined

  const query = useQuery({
    queryKey: [
      'dtf-zap-quote',
      dtf.chainId,
      dtf.address,
      input?.token.address,
      amountIn,
      slippage,
      forceMint,
      deepLiquidity,
      zapperApiUrl,
      account,
      round,
    ],
    queryFn: () => fetchZapQuote(request!, simulate),
    enabled: armed && !!request,
    refetchInterval: autoRefreshMs ?? false,
    retry: false,
    // quotes are short-lived: never re-serve a previous round's numbers
    gcTime: 0,
  })

  const result = query.data?.result
  const approvalAddress = result?.approvalAddress

  React.useEffect(() => {
    if (approvalAddress) onApprovalTarget(dtf.chainId, approvalAddress)
  }, [approvalAddress, dtf.chainId, onApprovalTarget])

  return (
    <TableRow>
      <TableCell className="font-medium">
        <span>{dtf.symbol}</span>
        <span className="ml-2 text-xs text-muted-foreground">{dtf.name}</span>
        {dtf.status !== 'active' && (
          <span className="ml-2 text-xs text-warning">{dtf.status}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {CHAIN_TAGS[dtf.chainId]}
      </TableCell>
      <TableCell>
        {input ? `${input.amount} ${input.token.symbol}` : '–'}
      </TableCell>
      {!armed ? (
        <TableCell colSpan={8} className="text-muted-foreground">
          Idle — hit Refresh now to quote
        </TableCell>
      ) : query.isPending ? (
        <TableCell colSpan={8} className="text-muted-foreground">
          Quoting…
        </TableCell>
      ) : query.error ? (
        <TableCell
          colSpan={8}
          className="max-w-md truncate text-destructive"
          title={
            query.error instanceof Error ? query.error.message : undefined
          }
        >
          {query.error instanceof Error ? query.error.message : 'Quote failed'}
        </TableCell>
      ) : (
        <>
          <TableCell>
            {formatToSignificantDigits(
              Number(formatUnits(BigInt(result!.amountOut), DTF_DECIMALS))
            )}{' '}
            <span className="text-xs text-muted-foreground">{dtf.symbol}</span>
          </TableCell>
          <TableCell>
            {result!.amountOutValue != null
              ? `$${formatCurrency(result!.amountOutValue)}`
              : '–'}
          </TableCell>
          <TableCell className={impactClass(result!.priceImpact)}>
            {formatPercentage(result!.priceImpact)}
          </TableCell>
          <TableCell className={impactClass(result!.truePriceImpact)}>
            {formatPercentage(result!.truePriceImpact)}
          </TableCell>
          <TableCell>
            {result!.dustValue != null
              ? `$${formatCurrency(result!.dustValue)}`
              : '–'}
          </TableCell>
          <TableCell>
            <SimulationCell simulation={query.data!.simulation} />
          </TableCell>
          <TableCell className="text-muted-foreground">
            {result!.gas ? formatCurrency(Number(result!.gas), 0) : '–'}
          </TableCell>
          <TableCell className="text-muted-foreground">
            {query.data!.durationMs}ms
          </TableCell>
        </>
      )}
      <TableCell className="text-muted-foreground">
        {armed && !query.isPending ? <Age updatedAt={query.dataUpdatedAt} /> : '–'}
      </TableCell>
      <TableCell>
        {request && (
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={buildZapEndpoint(request)}
            target="_blank"
            rel="noreferrer"
          >
            raw
          </a>
        )}
      </TableCell>
    </TableRow>
  )
}

const QuotesTable = ({ dtfs, inputs, prices, ...rowProps }: QuotesTableProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>DTF</TableHead>
        <TableHead>Chain</TableHead>
        <TableHead>Input</TableHead>
        <TableHead>Output</TableHead>
        <TableHead>Output value</TableHead>
        <TableHead>Price impact</TableHead>
        <TableHead>True price impact</TableHead>
        <TableHead>Dust</TableHead>
        <TableHead>Simulation</TableHead>
        <TableHead>Gas</TableHead>
        <TableHead>Latency</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead>Quote</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {dtfs.map((dtf) => (
        <QuoteRow
          key={`${dtf.chainId}-${dtf.address}`}
          dtf={dtf}
          input={inputs[dtf.chainId]}
          tokenInPrice={prices[dtf.chainId] ?? null}
          {...rowProps}
        />
      ))}
    </TableBody>
  </Table>
)

export default QuotesTable
