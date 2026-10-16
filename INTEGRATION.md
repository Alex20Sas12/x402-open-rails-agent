# Integrating Open Rails Data Agent with `@x402/fetch`

This guide explains how to connect your AI agent or script to the Open Rails Data Agent (`open-rails-data-agent.shablony-pro.workers.dev`) to query Celo on-chain data programmatically with automatic x402 micropayments.

## Prerequisites

- Node.js 18+ or a compatible runtime.
- An EVM private key with a small balance of USDC, USDT, or USA₮ on **Celo Mainnet** (`eip155:42220`) to cover the per-call micro-fees ($0.0005 – $0.002).
- Packages:
  ```bash
  npm install @x402/fetch @x402/evm viem
  ```

## Quickstart Client Script

Below is a complete, working client implementation (mirroring `agent/buyer-e2e.mjs` and `agent/buy-post.mjs`) that wraps standard `fetch` with `@x402/fetch` and signs EIP-3009 payment authorizations automatically when the worker returns `402 Payment Required`.

```javascript
import { x402Client, wrapFetchWithPayment } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Load your EVM signer (Celo mainnet account)
const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY_HERE');

// 2. Initialize the x402 client and register the Celo EVM scheme
const client = new x402Client();
client.register('eip155:42220', new ExactEvmScheme(account, {
  rpcUrl: 'https://forno.celo.org'
}));

// 3. Wrap fetch to automatically intercept 402, sign EIP-3009, and retry
const payFetch = wrapFetchWithPayment(fetch, client);

async function queryPaidData() {
  // Example: Query latest Celo block number (costs 500 USDC base units = $0.0005)
  const url = 'https://open-rails-data-agent.shablony-pro.workers.dev/celo/block';
  
  const response = await payFetch(url, {
    headers: { 'X-Idempotency-Key': 'client-' + Date.now() }
  });

  console.log('HTTP Status:', response.status);
  
  const data = await response.json();
  console.log('Response Data:', data);

  // Optional: Inspect settlement details returned by the facilitator in headers
  const paymentResponse = response.headers.get('x-payment-response');
  if (paymentResponse) {
    const settlement = JSON.parse(Buffer.from(paymentResponse, 'base64').toString('utf8'));
    console.log('On-Chain Settlement:', settlement);
  }
}

queryPaidData().catch(console.error);
```

## Available Endpoints & Pricing

| Route | Price (USDC base units) | USD Value | Description |
|---|---|---|---|
| `GET /celo/block` | 500 | $0.0005 | Latest Celo block number |
| `GET /celo/gas-price` | 500 | $0.0005 | Current Celo gas price (wei + gwei) |
| `GET /celo/balance?address=` | 1000 | $0.001 | Native CELO balance |
| `GET /celo/token-balance?token=&address=` | 1000 | $0.001 | ERC-20 token balance with decimals |
| `GET /celo/tx?hash=` | 2000 | $0.002 | Transaction by hash |
| `GET /celo/tx-receipt?hash=` | 2000 | $0.002 | Transaction receipt (status, gas, logs) |
| `GET /celo/erc8004-uri?id=` | 2000 | $0.002 | ERC-8004 agent URI by agentId |

## How It Works

1. **Initial Request**: Your script calls `payFetch(url)`. Without payment headers, the Cloudflare Worker responds with `402 Payment Required` and includes a JSON challenge body plus the base64 `PAYMENT-REQUIRED` header (`X-PAYMENT-VERSION: 2`) detailing accepted assets, price, recipient (`payTo`), and the hackathon attribution tag (`celo_d77d36f60ddb`).
2. **Automatic Signing**: `@x402/fetch` and `ExactEvmScheme` parse the challenge, select the appropriate token (USDC, USDT, or USA₮), and prompt your account to sign an EIP-3009 transfer authorization off-chain (**zero gas for the buyer**).
3. **Facilitator Settlement**: The signature is attached in the `X-PAYMENT` header. The worker verifies the signature against the Celo x402 facilitator (`api.x402.celo.org`), settles the payment directly to the agent wallet, and returns the requested data with `paid: true`.
