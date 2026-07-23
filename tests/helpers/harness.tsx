/**
 * Shared test harness: mounts the real <Buy> flow (quote query, pre-selection
 * simulation, submit button) against a scriptable local JSON-RPC server and a
 * mocked quote API, driven by the wagmi mock connector.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { connect } from 'wagmi/actions'
import { createStore, Provider as JotaiProvider, useAtomValue } from 'jotai'
import { createServer, type Server } from 'node:http'
import React from 'react'
import { ethAddress } from 'viem'
import { http, WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'
import { expect } from 'vitest'

import Buy from '../../src/components/zap-mint/buy'
import {
  selectedTokenAtom,
  zapFetchingAtom,
  zapOngoingTxAtom,
  zapSuccessAtom,
  zapSwapEndpointAtom,
} from '../../src/components/zap-mint/atom'
import { ZapperI18nProvider } from '../../src/i18n/provider'
import {
  balancesAtom,
  chainIdAtom,
  indexDTFAtom,
  QuoteSource,
  quoteSourceAtom,
  walletAtom,
} from '../../src/state/atoms'
import { reducedZappableTokens } from '../../src/utils/constants'

export const ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const DTF = '0x1000000000000000000000000000000000000001'
export const ZAP_ROUTER = '0x2000000000000000000000000000000000000002'
export const TX_HASH =
  '0x9999999999999999999999999999999999999999999999999999999999999999'
export const COW_UID = `0x${'cd'.repeat(56)}`
export const WETH_TOKEN = reducedZappableTokens[1].find(
  (t) => t.symbol === 'WETH'
)!
const BLOOM = `0x${'0'.repeat(512)}`
const APPROVE_SELECTOR = '0x095ea7b3'
const ALLOWANCE_SELECTOR = '0xdd62ed3e'
const MAX_UINT256 = 2n ** 256n - 1n

export type Scenario = {
  // how eth_sendTransaction behaves
  send: 'reject' | 'accept'
  // receipt status once mined
  receiptStatus: '0x0' | '0x1'
  // delay before eth_sendTransaction responds (wallet prompt open)
  sendDelayMs: number
  // eth_estimateGas fails for this many ms after the first send attempt
  // (models the stale/expired quote that keeps reverting until refreshed)
  estimateFailWindowMs: number
  sendAttempted: boolean
  sendAttemptedAt: number
  // how long quotes stay valid
  quoteTtlMs: number
  // delay before the quote API responds
  quoteDelayMs: number
  // calldatas whose eth_estimateGas always reverts
  revertData: string[]
  // next N eth_estimateGas calls fail with a transient (rate-limit) error
  estimateFailTransient: number
  // count of quote-API fetches served by the fetch mock
  quoteFetches: number
  // log of rpc methods, for debugging and assertions
  calls: string[]
  // allowance returned by the erc20 allowance eth_call (atoms, decimal string)
  allowance: string
  // CoW order status sequence served per GET orders/{uid}; last entry repeats
  cowStatuses: string[]
  cowExecutedBuyAmount: string
  // recorded POST /orders bodies (the signed order creation payloads)
  cowPostedOrders: Record<string, unknown>[]
  // count of CoW quote requests served by the fetch mock
  cowQuoteFetches: number
  // recorded CoW quote request bodies
  cowQuoteBodies: Record<string, unknown>[]
  // GET orders/{uid} 404s until an order was placed (POST /orders or an
  // eth-flow createOrder tx) — mirrors the real order book and keeps the
  // eth-flow uid-collision precheck from seeing a phantom order
  cowOrderPlaced: boolean
  // recorded eth_sendTransaction params (eth-flow createOrder calls land here)
  sentTransactions: Record<string, unknown>[]
}

export let scenario: Scenario
let server: Server
let rpcUrl: string
export const getRpcUrl = () => rpcUrl
let blockNumber = 0x1000
let lastQueryClient: QueryClient

const defaultScenario = (): Scenario => ({
  send: 'accept',
  receiptStatus: '0x1',
  sendDelayMs: 0,
  estimateFailWindowMs: 0,
  sendAttempted: false,
  sendAttemptedAt: 0,
  quoteTtlMs: 60_000,
  quoteDelayMs: 0,
  revertData: [],
  estimateFailTransient: 0,
  quoteFetches: 0,
  calls: [],
  allowance: MAX_UINT256.toString(),
  cowStatuses: ['open', 'fulfilled'],
  cowExecutedBuyAmount: '1000000000000000000000',
  cowPostedOrders: [],
  cowQuoteFetches: 0,
  cowQuoteBodies: [],
  cowOrderPlaced: false,
  sentTransactions: [],
})

export const queryStates = () => {
  try {
    return lastQueryClient
      .getQueryCache()
      .getAll()
      .filter((q) => {
        let k = ''
        try {
          k = JSON.stringify(q.queryKey, (_, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )
        } catch {
          k = String(q.queryKey?.[0])
        }
        return k.includes('zapDeploy') || k.includes('estimateGas')
      })
      .map((q) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const params = q.queryKey?.[1] as any
        const key = `${String(q.queryKey?.[0])}[to=${params?.to ?? params?.tokenIn ?? String(params).slice(0, 24)},gas=${params?.gas ?? '-'}]`
        return `${key} st=${q.state.status}/${q.state.fetchStatus} err=${q.state.errorUpdateCount} upd=${q.state.dataUpdateCount} obs=${q.getObserversCount()}`
      })
      .join(' || ')
  } catch (e) {
    return `queryStates-error: ${e}`
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const rpcHandler = async (
  method: string,
  params: unknown[]
): Promise<unknown> => {
  switch (method) {
    case 'eth_chainId':
      return '0x1'
    case 'eth_accounts':
    case 'eth_requestAccounts':
      return [ACCOUNT]
    case 'eth_blockNumber':
      return `0x${(++blockNumber).toString(16)}`
    case 'eth_getBalance':
      return '0x8ac7230489e80000' // 10 ETH
    case 'eth_estimateGas': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = String((params?.[0] as any)?.data)
      if (scenario.estimateFailTransient > 0) {
        scenario.estimateFailTransient--
        throw { code: -32005, message: 'rate limited' }
      }
      if (scenario.revertData.includes(data)) {
        throw { code: 3, message: 'execution reverted: BAD_ROUTE', data: '0x' }
      }
      if (
        scenario.estimateFailWindowMs > 0 &&
        scenario.sendAttempted &&
        Date.now() - scenario.sendAttemptedAt < scenario.estimateFailWindowMs
      ) {
        throw { code: 3, message: 'execution reverted: STALE_QUOTE', data: '0x' }
      }
      return '0x30d40'
    }
    case 'eth_gasPrice':
    case 'eth_maxPriorityFeePerGas':
      return '0x3b9aca00'
    case 'eth_getTransactionCount':
      return '0x1'
    case 'eth_feeHistory':
      return {
        oldestBlock: '0x1',
        baseFeePerGas: ['0x3b9aca00', '0x3b9aca00'],
        gasUsedRatio: [0.5],
        reward: [['0x3b9aca00']],
      }
    case 'eth_getBlockByNumber':
      return {
        number: `0x${blockNumber.toString(16)}`,
        hash: '0x' + 'ab'.repeat(32),
        parentHash: '0x' + 'cd'.repeat(32),
        timestamp: '0x64000000',
        baseFeePerGas: '0x3b9aca00',
        gasLimit: '0x1c9c380',
        gasUsed: '0x5208',
        miner: ACCOUNT,
        difficulty: '0x0',
        totalDifficulty: '0x0',
        extraData: '0x',
        logsBloom: BLOOM,
        nonce: '0x0000000000000000',
        mixHash: '0x' + '00'.repeat(32),
        receiptsRoot: '0x' + '00'.repeat(32),
        sha3Uncles: '0x' + '00'.repeat(32),
        size: '0x220',
        stateRoot: '0x' + '00'.repeat(32),
        transactions: [],
        transactionsRoot: '0x' + '00'.repeat(32),
        uncles: [],
      }
    case 'eth_sendTransaction':
      scenario.sendAttempted = true
      scenario.sendAttemptedAt = Date.now()
      scenario.sentTransactions.push(
        (params?.[0] as Record<string, unknown>) ?? {}
      )
      if (scenario.sendDelayMs) await sleep(scenario.sendDelayMs)
      if (scenario.send === 'reject') {
        throw { code: 4001, message: 'User rejected the request.' }
      }
      // an eth-flow createOrder tx counts as order placement
      scenario.cowOrderPlaced = true
      return TX_HASH
    case 'eth_getTransactionReceipt':
      return {
        transactionHash: TX_HASH,
        transactionIndex: '0x0',
        blockHash: '0x' + 'ab'.repeat(32),
        blockNumber: `0x${blockNumber.toString(16)}`,
        from: ACCOUNT,
        to: ZAP_ROUTER,
        cumulativeGasUsed: '0x5208',
        gasUsed: '0x5208',
        contractAddress: null,
        logs: [],
        logsBloom: BLOOM,
        status: scenario.receiptStatus,
        effectiveGasPrice: '0x3b9aca00',
        type: '0x2',
      }
    case 'eth_getTransactionByHash':
      return {
        hash: TX_HASH,
        nonce: '0x1',
        blockHash: '0x' + 'ab'.repeat(32),
        blockNumber: `0x${blockNumber.toString(16)}`,
        transactionIndex: '0x0',
        from: ACCOUNT,
        to: ZAP_ROUTER,
        value: '0xde0b6b3a7640000',
        gas: '0x30d40',
        input: '0x12345678',
        maxFeePerGas: '0x77359400',
        maxPriorityFeePerGas: '0x3b9aca00',
        gasPrice: '0x3b9aca00',
        type: '0x2',
        chainId: '0x1',
        accessList: [],
        r: '0x' + '11'.repeat(32),
        s: '0x' + '22'.repeat(32),
        v: '0x1',
        yParity: '0x1',
      }
    case 'eth_signTypedData_v4':
      // the mock connector forwards signing to the transport — serve a canned
      // 65-byte ECDSA signature (r + s + v)
      return `0x${'ab'.repeat(64)}1c`
    case 'eth_call': {
      // approve simulation (useSimulateContract) must succeed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const callData = String((params?.[0] as any)?.data)
      if (callData.startsWith(APPROVE_SELECTOR)) {
        return `0x${'0'.repeat(63)}1`
      }
      if (callData.startsWith(ALLOWANCE_SELECTOR)) {
        return `0x${BigInt(scenario.allowance).toString(16).padStart(64, '0')}`
      }
      // replaying a reverted tx for the revert reason
      throw { code: 3, message: 'execution reverted: SLIPPAGE', data: '0x' }
    }
    default:
      throw { code: -32601, message: `mock rpc: unhandled method ${method}` }
  }
}

const startRpcServer = () =>
  new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        const respond = (payload: unknown) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(payload))
        }
        ;(async () => {
          try {
            const parsed = JSON.parse(body)
            const batch = Array.isArray(parsed) ? parsed : [parsed]
            const results = await Promise.all(
              batch.map(async (msg) => {
                scenario.calls.push(
                  msg.method === 'eth_call' || msg.method === 'eth_estimateGas'
                    ? `${msg.method}(to=${msg.params?.[0]?.to},data=${String(msg.params?.[0]?.data).slice(0, 18)})`
                    : msg.method
                )
                try {
                  return {
                    jsonrpc: '2.0',
                    id: msg.id,
                    result: await rpcHandler(msg.method, msg.params),
                  }
                } catch (error) {
                  return { jsonrpc: '2.0', id: msg.id, error }
                }
              })
            )
            respond(Array.isArray(parsed) ? results : results[0])
          } catch {
            respond({ jsonrpc: '2.0', id: 0, error: { code: -32700, message: 'parse error' } })
          }
        })()
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      rpcUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
      resolve()
    })
  })

/**
 * Builds a quote-API response. Overrides are shallow-merged into `result`.
 */
export const makeQuote = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  status: 'success',
  result: {
    tokenIn: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    amountIn: '1000000000000000000',
    amountInValue: 3000,
    tokenOut: DTF,
    amountOut: '1000000000000000000000',
    amountOutValue: 2995,
    minAmountOut: '995000000000000000000',
    approvalAddress: ZAP_ROUTER,
    approvalNeeded: false,
    insufficientFunds: false,
    dust: [],
    dustValue: 0,
    gas: '200000',
    priceImpact: 0.05,
    truePriceImpact: 0.05,
    tx: {
      data: '0x12345678',
      to: ZAP_ROUTER,
      value: '1000000000000000000',
    },
    validUntil: Date.now() + scenario.quoteTtlMs,
    ...overrides,
  },
})

type QuoteBuilder = (url: string) => Record<string, unknown>
let quoteBuilder: QuoteBuilder = () => makeQuote()

/** Customize the quote served per endpoint URL (e.g. per provider). */
export const setQuoteBuilder = (builder: QuoteBuilder) => {
  quoteBuilder = builder
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// Mocked CoW order-book API: quote -> order placement -> status polls -> trades.
const handleCowFetch = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const method = (init?.method ?? 'GET').toUpperCase()
  const body = init?.body ? JSON.parse(String(init.body)) : {}

  if (url.includes('/app_data/') && method === 'PUT') {
    return jsonResponse({ fullAppData: body.fullAppData ?? '' }, 201)
  }
  if (url.includes('/quote') && method === 'POST') {
    scenario.cowQuoteFetches++
    scenario.cowQuoteBodies.push(body)
    if (scenario.quoteDelayMs) await sleep(scenario.quoteDelayMs)
    return jsonResponse({
      quote: {
        sellToken: body.sellToken ?? WETH_TOKEN.address,
        buyToken: body.buyToken ?? DTF,
        receiver: ACCOUNT,
        sellAmount: '990000000000000000',
        buyAmount: '1000000000000000000000',
        validTo: 0,
        appData: `0x${'00'.repeat(32)}`,
        feeAmount: '10000000000000000',
        kind: 'sell',
        partiallyFillable: false,
        sellTokenBalance: 'erc20',
        buyTokenBalance: 'erc20',
        gasAmount: '0',
        gasPrice: '0',
        sellTokenPrice: '0',
      },
      from: ACCOUNT,
      expiration: new Date(Date.now() + scenario.quoteTtlMs).toISOString(),
      id: 12345,
      verified: true,
    })
  }
  if (url.includes('/orders') && method === 'POST') {
    scenario.cowPostedOrders.push(body)
    scenario.cowOrderPlaced = true
    return jsonResponse(COW_UID, 201)
  }
  if (url.includes(`/orders/`)) {
    if (!scenario.cowOrderPlaced) {
      return jsonResponse({ errorType: 'NoSuchOrder', description: '' }, 404)
    }
    const status =
      scenario.cowStatuses.length > 1
        ? scenario.cowStatuses.shift()!
        : scenario.cowStatuses[0]
    const posted = scenario.cowPostedOrders[0] ?? {}
    return jsonResponse({
      ...posted,
      uid: COW_UID,
      status,
      creationDate: new Date().toISOString(),
      owner: ACCOUNT,
      executedSellAmount: '0',
      executedSellAmountBeforeFees: '0',
      executedFeeAmount: '0',
      executedBuyAmount:
        status === 'fulfilled' ? scenario.cowExecutedBuyAmount : '0',
      invalidated: false,
    })
  }
  if (url.includes('/trades')) {
    return jsonResponse([{ orderUid: COW_UID, txHash: TX_HASH }])
  }
  return jsonResponse({})
}

const realFetch = globalThis.fetch.bind(globalThis)
const installFetchMock = () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init)
    if (url.includes('api.cow.fi')) return handleCowFetch(url, init)
    if (url.includes('tokenIn=')) {
      scenario.quoteFetches++
      if (scenario.quoteDelayMs) await sleep(scenario.quoteDelayMs)
      return new Response(JSON.stringify(quoteBuilder(url)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (url.includes('current/prices')) {
      return new Response(JSON.stringify([{ price: 3000 }]), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch
}

const Probe = () => {
  const ongoingTx = useAtomValue(zapOngoingTxAtom)
  const fetching = useAtomValue(zapFetchingAtom)
  const endpoint = useAtomValue(zapSwapEndpointAtom)
  const zapSuccess = useAtomValue(zapSuccessAtom)
  return (
    <>
      <div data-testid="probe">
        {JSON.stringify({
          ongoingTx,
          fetching,
          success: !!zapSuccess,
          receivedAmount: zapSuccess?.receivedAmount,
          txHash: zapSuccess?.txHash,
          orderExplorerUrl: zapSuccess?.orderExplorerUrl,
        })}
      </div>
      <div data-testid="probe-endpoint">{endpoint}</div>
    </>
  )
}

const dtf = {
  id: DTF,
  chainId: 1,
  mintingFee: 0.003,
  tvlFee: 0.01,
  token: {
    id: DTF,
    name: 'Test DTF',
    symbol: 'TEST',
    decimals: 18,
    totalSupply: '1000000000000000000000000',
  },
}

const ethBalance = {
  value: 10n * 10n ** 18n,
  balance: '10',
  decimals: 18,
}

export const setup = async ({
  quoteSource = 'zap',
  inputAmount = '1',
  inputToken,
}: {
  quoteSource?: QuoteSource
  inputAmount?: string
  // 'weth' switches the input to an ERC-20 (RFQ sources skip native inputs)
  inputToken?: 'eth' | 'weth'
} = {}) => {
  const chain = {
    ...mainnet,
    rpcUrls: { default: { http: [rpcUrl] } },
  }
  const config = createConfig({
    chains: [chain],
    connectors: [mock({ accounts: [ACCOUNT], features: { reconnect: true } })],
    transports: { [mainnet.id]: http(rpcUrl) },
    pollingInterval: 100,
    storage: null,
    batch: { multicall: false },
  })
  await connect(config, { connector: config.connectors[0] })
  const queryClient = new QueryClient()
  lastQueryClient = queryClient

  const store = createStore()
  store.set(chainIdAtom, 1)
  store.set(walletAtom, ACCOUNT)
  store.set(indexDTFAtom, dtf)
  store.set(quoteSourceAtom, quoteSource)
  if (inputToken === 'weth') {
    store.set(selectedTokenAtom, WETH_TOKEN)
    store.set(balancesAtom, {
      [ethAddress]: ethBalance,
      [WETH_TOKEN.address]: ethBalance,
    })
  } else {
    store.set(balancesAtom, { [ethAddress]: ethBalance })
  }

  const utils = render(
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>
          <ZapperI18nProvider>
            <Probe />
            <Buy mode="modal" />
          </ZapperI18nProvider>
        </JotaiProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )

  // type the input amount
  const input = utils.container.querySelector('input')
  expect(input).toBeTruthy()
  fireEvent.change(input!, { target: { value: inputAmount } })

  return utils
}

const ctaMatcher =
  /Buy TEST|Quote expired|Simulation failed|Fetching quote|Loading|Insufficient|Approve use of|Waiting for order/i

export const getCta = () => {
  const buttons = screen.getAllByRole('button')
  const cta = buttons.find((b) => ctaMatcher.test(b.textContent || ''))
  if (!cta) throw new Error('CTA not found. buttons: ' + buttons.map((b) => b.textContent).join(' | '))
  return cta as HTMLButtonElement
}

export const dumpState = (label: string) => {
  const probe = screen.getByTestId('probe').textContent
  let cta = 'not-found'
  try {
    const b = getCta()
    cta = `text="${b.textContent}" disabled=${b.disabled} spinner=${!!b.querySelector('.animate-spin')}`
  } catch (e) {
    cta = String(e)
  }
  console.log(`[${label}] probe=${probe} cta=${cta}`)
  const errEls = document.querySelectorAll('[class*="text-red"], [class*="destructive"]')
  errEls.forEach((el) => {
    if (el.textContent?.trim()) console.log(`[${label}] error-msg: ${el.textContent.trim().slice(0, 200)}`)
  })
  console.log(`[${label}] rpc calls: ${scenario.calls.slice(-25).join(',')}`)
}

export const waitForReadyCta = async () => {
  await waitFor(
    () => {
      const cta = getCta()
      expect(cta.textContent).toMatch(/Buy TEST/i)
      expect(cta.disabled).toBe(false)
      expect(cta.querySelector('.animate-spin')).toBeNull()
    },
    { timeout: 20_000, interval: 200 }
  )
}

export const harnessBeforeEach = async (): Promise<Scenario> => {
  blockNumber = 0x1000
  scenario = defaultScenario()
  quoteBuilder = () => makeQuote()
  installFetchMock()
  await startRpcServer()
  return scenario
}

export const harnessAfterEach = async () => {
  cleanup()
  globalThis.fetch = realFetch
  await new Promise((r) => server.close(r))
}
