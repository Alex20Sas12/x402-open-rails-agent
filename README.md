# Open Rails Data Agent

x402 pay-per-call data agent on **Celo mainnet** for the
[Agents on Open Rails Hackathon](https://www.loops.house/agents-on-open-rails).

- **Agent wallet (payTo + sender):** `0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952`
- **Attribution tag (ERC-8021, Schema 0):** `celo_d77d36f60ddb` — appended to the calldata of
  every transaction the agent sends, before it is sent (see `agent/register.mjs`).
- **ERC-8004 identity:** registered from the agent wallet with the tag embedded
  (proof of the flow on Celo Sepolia: agentId `542`,
  [tx](https://celo-sepolia.blockscout.com/tx/0xf812be3f986ee6c3ea63bcbf90d702f4e86a22b7dc99edca7737d6c272709792),
  tag verified on-chain with `verifyTx` → `codes: ["celo_d77d36f60ddb"]`).
  The mainnet registration runs the same script against
  `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` once the wallet holds gas.
- **Live service:** https://open-rails-data-agent.shablony-pro.workers.dev (Cloudflare Worker)

## What it does

Sells deterministic Celo on-chain data over the x402 protocol. A buyer (human or agent)
GETs an endpoint, receives `402 Payment Required` with prices in **USDC / USDT / USA₮ on
Celo mainnet** (settlement through the hosted facilitator `api.x402.celo.org`), signs an
EIP-3009 authorization — **no gas for the buyer** — and the facilitator settles
buyer → agent wallet directly. Funds never touch a custodian.

| Route | Price (USDC base units) | Description |
|---|---|---|
| `GET /celo/block` | 500 ($0.0005) | Latest Celo block number |
| `GET /celo/gas-price` | 500 | Gas price, wei + gwei |
| `GET /celo/balance?address=` | 1000 ($0.001) | Native CELO balance |
| `GET /celo/token-balance?token=&address=` | 1000 | Any ERC-20 balance with decimals |
| `GET /celo/tx?hash=` | 2000 ($0.002) | Transaction by hash |
| `GET /celo/tx-receipt?hash=` | 2000 | Receipt with logs |
| `GET /celo/erc8004-uri?id=` | 2000 | ERC-8004 agent URI by agentId |

Add `?network=sepolia` to hit the Celo Sepolia stack (development).
Discovery: `/openapi.json`, `/` (index with prices and contracts).

### Tracks

- **Open Corridors — USA₮ with x402:** real settlement between independent parties in
  USD₮/USA₮/USDC via Celo's x402 facilitator. The 402 contract additionally declares the
  `builder-code` extension (`a = celo_d77d36f60ddb`) so settlements attribute to this
  entry once the hosted facilitator emits Schema-2 suffixes (upstream:
  [x402-rs#99](https://github.com/x402-rs/x402-rs/pull/99); today's facilitator settlements
  are untagged by design — noted in the submission).
- **Build with buy:** the agent itself consumes paid services through buy/x402
  (verified paid calls into services it doesn't control), and its 330+ endpoint
  toolbox lineage (`x402-toolbox`, Base+Solana, live since Sept 2026) demonstrates the
  demand side.

## Layout

```
agent.json            ERC-8004 agent registration file (served from this repo's raw URL)
agent/register.mjs    register ERC-8004 identity WITH the attribution tag (sepolia|mainnet)
agent/feedback.mjs    client-side giveFeedback (reputation) WITH the tag (sepolia|mainnet)
agent/mintkey.mjs     mint the x402 facilitator API key by signature (no dashboard, no gas)
agent/buyer-e2e.mjs   official @x402 buyer against the deployed worker
worker/               Cloudflare Worker (service) — wrangler.toml + src/worker.js
```

## Verified flow (Celo Sepolia, 2026-10-07)

1. `register.mjs sepolia` → identity `agentId 542`, suffix decoded on-chain to
   `celo_d77d36f60ddb` (`verifyTx` + `fromDataSuffix`).
2. `feedback.mjs sepolia 542` from a second wallet → NewFeedback event,
   [tx](https://celo-sepolia.blockscout.com/tx/0x9a5cf4226ca79c91b3736a0ecb925ff16f249af9fea1ca0113b89c13a28d9fa0).
3. `mintkey.mjs` → facilitator API key by wallet signature (20 mainnet + 1000 testnet credits).
4. `buyer-e2e.mjs` → worker 402 → buyer signs → worker calls facilitator `/verify` →
   verdict `insufficient_funds` (buyer unfunded on Sepolia) — full wiring proven.

## Run

```bash
cd worker && npx wrangler deploy && \
  npx wrangler secret put X402_API_KEY   # from agent/mintkey.mjs
cd .. && node agent/register.mjs mainnet # once the wallet has Celo mainnet gas
```

Sepolia CELO: https://faucet.celo.org · Mainnet USA₮ (Self KYC):
https://cloud.google.com/application/web3/faucet/celo/mainnet

Written during the hackathon window (opened 2026-10-06). Apache-2.0 intent; toolbox lineage MIT.
