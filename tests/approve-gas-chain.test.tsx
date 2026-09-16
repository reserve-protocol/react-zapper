/**
 * The approval gas limit must be estimated on the chain the widget trades on,
 * not on the wallet's current network. Since the network switch moved into the
 * CTA click (2.10.2), a wallet sitting on another chain used to estimate the
 * approve there — against an address with no contract (plain-transfer gas,
 * 22,825 on mainnet for Base USDC) — and the approve then ran out of gas once
 * the wallet switched to the target chain.
 */
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import React from 'react'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { erc20Abi } from 'viem'
import { base, mainnet } from 'viem/chains'
import { connect } from 'wagmi/actions'
import { mock } from 'wagmi/connectors'
import { WagmiProvider, createConfig, http } from 'wagmi'

import useContractWrite from '../src/hooks/useContractWrite'

const ACCOUNT = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ONEINCH_ROUTER = '0x111111125421cA6dc452d289314280a0f8842A65'

// Figures observed on-chain for this exact approve (2026-09-16).
const ESTIMATE_BY_CHAIN: Record<number, bigint> = {
  [mainnet.id]: 22_825n, // no contract at the Base USDC address on mainnet
  [base.id]: 56_240n, // real zero → non-zero USDC approve on Base
}

let server: Server
let rpcUrl = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    const chainId = Number(req.url?.split('/')[1])
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const parsed = JSON.parse(body)
      const answer = (msg: { id: number; method: string }) => {
        switch (msg.method) {
          case 'eth_chainId':
            return { jsonrpc: '2.0', id: msg.id, result: `0x${chainId.toString(16)}` }
          case 'eth_estimateGas':
            return { jsonrpc: '2.0', id: msg.id, result: `0x${ESTIMATE_BY_CHAIN[chainId].toString(16)}` }
          case 'eth_call': // approve simulation returns `true`
            return { jsonrpc: '2.0', id: msg.id, result: `0x${'0'.repeat(63)}1` }
          case 'eth_accounts':
          case 'eth_requestAccounts':
            return { jsonrpc: '2.0', id: msg.id, result: [ACCOUNT] }
          case 'eth_blockNumber':
            return { jsonrpc: '2.0', id: msg.id, result: '0x1000' }
          default:
            return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: msg.method } }
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(Array.isArray(parsed) ? parsed.map(answer) : answer(parsed)))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  rpcUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('useContractWrite approval gas', () => {
  it('estimates on the target chain while the wallet is still on another network', async () => {
    // the mock connector talks to each chain's default rpcUrl, not the transport
    const local = <T extends typeof mainnet | typeof base>(chain: T): T => ({
      ...chain,
      rpcUrls: { default: { http: [`${rpcUrl}/${chain.id}`] } },
    })
    const config = createConfig({
      chains: [local(mainnet), local(base)],
      connectors: [mock({ accounts: [ACCOUNT] })],
      transports: {
        [mainnet.id]: http(`${rpcUrl}/${mainnet.id}`),
        [base.id]: http(`${rpcUrl}/${base.id}`),
      },
      storage: null,
      batch: { multicall: false },
    })
    // the mock connector lands on the first chain: the wallet is on mainnet
    await connect(config, { connector: config.connectors[0], chainId: mainnet.id })
    expect(config.state.chainId).toBe(mainnet.id)

    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WagmiProvider config={config} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    )

    const { result } = renderHook(
      () =>
        useContractWrite({
          abi: erc20Abi,
          address: BASE_USDC,
          functionName: 'approve',
          args: [ONEINCH_ROUTER, 1_200_000n],
          chainId: base.id,
        }),
      { wrapper }
    )

    await waitFor(() => expect(result.current.gas).toBeDefined())
    expect(result.current.gas).toBe(ESTIMATE_BY_CHAIN[base.id])
  })
})
