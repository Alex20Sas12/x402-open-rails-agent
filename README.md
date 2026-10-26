# Open Rails Data Agent

[![CI](https://github.com/Alex20Sas12/x402-open-rails-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/Alex20Sas12/x402-open-rails-agent/actions/workflows/ci.yml)

x402 pay-per-call data agent on **Celo mainnet** for the
[Agents on Open Rails Hackathon](https://www.loops.house/agents-on-open-rails).

- **Agent wallet (payTo + sender):** `0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952`
- **Attribution tag (ERC-8021, Schema 0):** `celo_d77d36f60ddb` — appended to the calldata of
  every transaction the agent sends, before it is sent (see `agent/register.mjs`).
- **ERC-8004 identity (Celo mainnet):** registered from the agent wallet with the tag
  embedded — **agentId `9883`**,
  [tx](https://celoscan.io/tx/0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc)
  (block 79513970, gas paid in USDC via fee-abstraction / CIP-64, tx type `0x7b`),
  tag verified on-chain with `verifyTx` → `codes: ["celo_d77d36f60ddb"]` (schemaId 0).
  Registered against Identity registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
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
- **Build with buy:** the tagged agent wallet `0x5a8D…` buys third-party x402 services
  it does not control, settled on-chain — verified from the USDC/USDC.e `Transfer` logs
  themselves, not from our own code paths:
  - **Pocket Network** `/v1/celo` (Celo JSON-RPC, 31 payers / 18k calls in 30 days) —
    HTTP 200, real data returned (block `0x4c6253a`), settled
    [tx 0x257071ae](https://basescan.org/tx/0x257071ae055b374109096f07d0481a7c328042a4bd105611e7554492ccc89304)
    0.005 USDC.e on Base; payer `0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952` (14.10)
  - **agent402.tools** `/api/x402-market-pulse` →
    [tx 0xc3e60fa8](https://celoscan.io/tx/0xc3e60fa8108799f825137550238374db63b78f358ea0c95f6aeb56596b50fc65)
    0.001 USDC → `0xabf4fabd…` (agent402.tools settlement account)
  - **gateway.usebuy.ai** `x.posts.search` (tikhub) →
    [tx 0x86ff3ef7](https://celoscan.io/tx/0x86ff3ef7bd2bf8d15969898e642ad68f8ccca4529cf40432fc8ddc65edcce76f)
    0.006 USDC
  - **Blockscout Pro API** `/42220/api/v2/celo/epochs` (Celo L2 epochs, 193 paid routes) —
    HTTP 200 with live epoch data (epoch 2338), settled **on Celo itself**
    [tx 0x216da15d](https://celoscan.io/tx/0x216da15d1b2d61addeb2b08219c83e8b5d2f8318df38e53b9222d639c9f2c5b7)
    0.002 USDC → Blockscout settlement wallet `0x242ba6d6…` (17.10)
  - **NewBotLabor Agent Preflight** `/api/celo/token-check` (Celo ERC-20 risk check) —
    HTTP 200 with live verdict, settled
    [tx 0x8470c7cf](https://basescan.org/tx/0x8470c7cf100217ed2936ad554c9b2d908534a48c8f5cc60b64c139982c924d42)
    0.003 USDC.e on Base → `0x174897b2…` (17.10)
  - **BlockRun** `/api/v1/rpc/celo` (Celo JSON-RPC, 260 payers / 90k calls in 30 days,
    Bazaar-curated) — HTTP 200, live Celo block `0x4ca325a`, settled
    [tx 0xd62a3011](https://basescan.org/tx/0xd62a3011ae21416f6a1e530601a801b5f23fd68df807c8dd466c0d5667976b52)
    0.003 USDC on Base → BlockRun settlement wallet `0xe9030014…` (17.10)
  - **agent402.tools** `/api/tx-status?network=celo` and `/api/gas-estimate?network=celo` —
    Celo-aware aggregation, settled
    [tx 0x0fc69b63](https://basescan.org/tx/0x0fc69b637944af6b35454d9b371843f34226a3589edf808b11a3a3ecefb81e3e)
    and [tx 0x444068a3](https://basescan.org/tx/0x444068a3893dc9089b2670b87859aaad49f60b739d4f45e865c6e5b13aae64f3)
    0.001 USDC each (17.10)
  12 purchased calls in total, 6 distinct third-party payees (Pocket Network,
  agent402.tools, tikhub via gateway.usebuy.ai, Blockscout, NewBotLabor, BlockRun), all
  originating from the agent's own tagged wallet. The agent composes services it does
  not control: it pays Blockscout for epoch data, BlockRun for RPC and NewBotLabor for
  token risk checks on Celo, the same chain it sells data on.
  ABApay was tried and declined: it requires real bill identifiers
  (`serviceID/billersCode/amount`), so it cannot be exercised as a data purchase.
  A separate 330+ endpoint toolbox (`x402-toolbox`, Base+Solana, live since Sept 2026)
  covers the demand side.

## Examples

## Security

Every route is an x402 pay-per-call. The flow is identical for all seven:

1. **`GET` without payment → `402 Payment Required`** with a signed challenge
   (`PAYMENT-REQUIRED` header + JSON body listing `accepts[]` — asset, amount in
   base units, `payTo`, network `eip155:42220`).
2. Buyer signs an **EIP-3009** authorization (no gas for the buyer) and retries
   with **`X-PAYMENT: <base64 payment payload>`** (v2) or `PAYMENT-SIGNATURE` (v1).
3. Worker asks the facilitator to `/verify`, returns the data with **`paid: true`**,
   and settles buyer → agent wallet in the background.

Below: the live 402 challenge, then each route's real result. `X-PAYMENT` value is
elided to `<sig>` — the buyer client (`agent/buyer-e2e.mjs`, `@x402/fetch`) builds it.

### 402 challenge (identical shape for all routes, amount varies)

```http
GET /celo/block HTTP/1.1
Host: open-rails-data-agent.shablony-pro.workers.dev
```
```json
HTTP/1.1 402 Payment Required
X-PAYMENT-VERSION: 2
{
  "x402Version": 2,
  "error": "PAYMENT-SIGNATURE header is required",
  "resource": { "url": ".../celo/block", "serviceName": "open-rails-data-agent" },
  "accepts": [
    { "scheme": "exact", "network": "eip155:42220", "amount": "500",
      "asset": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
      "payTo": "0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952",
      "extra": { "name": "USDC", "version": "2" } }
    /* + USDT 0x4806…3D5e, USA₮ 0xD2ab…F771 at the same amount */
  ],
  "extensions": { "builder-code": { "info": { "a": "celo_d77d36f60ddb" } } }
}
```

### 1. `GET /celo/block` — 500 ($0.0005)

```http
GET /celo/block HTTP/1.1
X-PAYMENT: ***
```
```json
{ "paid": true, "route": "/celo/block", "network": "mainnet",
  "tag": "celo_d77d36f60ddb", "blockNumber": 79635954, "hex": "0x4bf25f2" }
```

### 2. `GET /celo/gas-price` — 500 ($0.0005)

```json
{ "paid": true, "route": "/celo/gas-price", "network": "mainnet",
  "tag": "celo_d77d36f60ddb", "wei": "202500000000", "gwei": 202.5 }
```

### 3. `GET /celo/balance?address=0x471EcE3750Da237f93B8E339c536989b8978a438` — 1000 ($0.001)

```json
{ "paid": true, "route": "/celo/balance", "network": "mainnet",
  "tag": "celo_d77d36f60ddb",
  "wei": "457156951045076940000", "celo": 457.15695104507694 }
```

### 4. `GET /celo/token-balance?token=0xcebA9300f2b948710d2653dD7B07f33A8B32118C&address=0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952` — 1000 ($0.001)

```json
{ "paid": true, "route": "/celo/token-balance", "network": "mainnet",
  "tag": "celo_d77d36f60ddb",
  "token": "0xceba9300f2b948710d2653dd7b07f33a8b32118c",
  "address": "0x5a8dbd4788584f9c4b59eb64087a1a18fc2f7952",
  "decimals": 6, "raw": "976208", "amount": 0.976208 }
```

### 5. `GET /celo/tx?hash=0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc` — 2000 ($0.002)

The ERC-8004 registration tx of this very agent (fee paid in USDC, type `0x7b`):

```json
{ "paid": true, "route": "/celo/tx", "network": "mainnet",
  "tag": "celo_d77d36f60ddb",
  "hash": "0xa409f20c…a367cfc", "type": "0x7b",
  "from": "0x5a8dbd4788584f9c4b59eb64087a1a18fc2f7952",
  "to": "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
  "feeCurrency": "0x2f25deb3848c207fc8e0c34035b3ba7fc157602b",
  "blockNumber": "0x4bd4972", "gasUsed": "0x506c2", "value": "0x0",
  "input": "0xf2c298be…8021  /* register(agentURI) + celo_d77d36f60ddb suffix */" }
```

### 6. `GET /celo/tx-receipt?hash=0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc` — 2000 ($0.002)

```json
{ "paid": true, "route": "/celo/tx-receipt", "network": "mainnet",
  "tag": "celo_d77d36f60ddb",
  "status": "0x1", "gasUsed": "0x506c2", "effectiveGasPrice": "0x4728b51ca",
  "logs": [ /* 8 events: USDC gas burn, NewAgent(9883), … */ ] }
```

### 7. `GET /celo/erc8004-uri?id=9883` — 2000 ($0.002)

```json
{ "paid": true, "route": "/celo/erc8004-uri", "network": "mainnet",
  "tag": "celo_d77d36f60ddb", "agentId": "9883",
  "registry": "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  "agentURI": "https://raw.githubusercontent.com/Alex20Sas12/x402-open-rails-agent/main/agent.json" }
```

> Programmatic buyer: `agent/buyer-e2e.mjs` wraps `fetch` with `@x402/fetch` —
> it handles the 402 → sign → retry → settle loop above in one call.

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

## Verified flow (Celo MAINNET, 2026-10-08)

1. Gas: Relay.link permit-bridge Base USDC → Celo USDC (relayer pays gas, `bridge-relay.mjs`).
2. `register.mjs mainnet` → identity **agentId 9883**, tag `celo_d77d36f60ddb` verified via
   `verifyTx` on mainnet; gas paid in USDC through CIP-64 fee-abstraction.
   [tx](https://celoscan.io/tx/0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc)
3. Sale (Open Corridors / x402): buyer `0xab05…` (a wallet we operate, not an external
   party) bought `GET /celo/block` —
   settled [tx](https://celoscan.io/tx/0xb8cf386b) 0.0005 USDC → payTo wallet.
   The full chain (402 → EIP-3009 → facilitator settle) is exercised, but the paying
   party is ours; we have **no external buyer yet** and do not claim one.
4. Build-with-buy: see the **Tracks** section above — 12 paid calls to third-party
   services, all settled from the tagged wallet and verified against USDC Transfer logs.

`buy-post.mjs` registers both x402 v1 (`registerV1`, legacy `celo` network alias +
`eip155:42220`) and v2 schemes so a single script pays any Celo x402 service; only
`eip155:42220` routes keep settlement on Celo.

## Market position (index scan, 2026-10-09)

Scanned the open x402 economy index (agent402.tools/api/index): **4,703 sellers,
150k+ paid tools**. Of those, Celo (`eip155:42220`) support appears on effectively
zero service manifests — the index itself lists the chain but exposes no Celo resources.
A pay-per-call Celo on-chain data feed (this agent) sits in an unoccupied niche:
no competing seller of Celo chain data via x402 was found.

## FAQ

### What is x402?
x402 is an open payment protocol that revives HTTP 402 Payment Required for machine-to-machine interactions. When a client requests a paid resource, the server replies with HTTP 402 and a JSON challenge body (plus the base64 `PAYMENT-REQUIRED` header and `X-PAYMENT-VERSION: 2`) containing accepted currencies, pricing, and recipient addresses. The client signs an authorization or payload with its Web3 wallet, attaches it in the `X-PAYMENT` header, and the server verifies and settles the payment via a facilitator before returning HTTP 200 with the data.

### How do I pay for requests to this agent?
Clients can pay automatically using the official `@x402/fetch` client or any compatible library. When making a standard `fetch` call with an attached Celo private key or signer, the library automatically traps HTTP 402, creates an EIP-712 payment signature in USDC, USD₮, or USA₮ on Celo (`eip155:42220`), adds the `X-PAYMENT` header, and replays the request seamlessly. See `agent/buyer-e2e.mjs` for a working client example.

### What is the attribution tag (`celo_d77d36f60ddb`)?
The attribution tag `celo_d77d36f60ddb` follows the ERC-8021 standard for tracking builder contributions on Celo during the hackathon. It is derived deterministically from the repository identifier (`"celo_" + sha256(slug)[:12]`). The agent embeds this tag in ERC-8004 identity registrations, on-chain feedback reviews, and 402 response payment descriptors so that indexers and the hackathon leaderboard can credit verified transactions to this project.

## Run

```bash
cd worker && npx wrangler deploy && \
  npx wrangler secret put X402_API_KEY   # from agent/mintkey.mjs
cd .. && node agent/register.mjs mainnet # once the wallet has Celo mainnet gas
```

Sepolia CELO: https://faucet.celo.org · Mainnet USA₮ (Self KYC):
https://cloud.google.com/application/web3/faucet/celo/mainnet

Written during the hackathon window (opened 2026-10-06). Apache-2.0 intent; toolbox lineage MIT.
