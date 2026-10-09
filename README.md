# Open Rails Data Agent

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
- **Build with buy:** the agent itself consumes paid services through buy/x402
  (verified paid calls into services it doesn't control), and its 330+ endpoint
  toolbox lineage (`x402-toolbox`, Base+Solana, live since Sept 2026) demonstrates the
  demand side.

## Examples

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
3. Sale (Open Corridors / x402): third-party buyer `0xab05…` bought `GET /celo/block` —
   settled [tx](https://celoscan.io/tx/0xb8cf386b) 0.0005 USDC → payTo wallet.
4. Build-with-buy: tagged agent wallet `0x5a8d…` paid for third-party Celo x402 services
   (`buy-third-party.mjs` / `buy-post.mjs`), each settled on-chain in USDC:
   - agent402.tools `/api/block-number` → tx `0xa6ae4c2a…` (0.001, 07.10)
   - agent402.tools `/api/x402-market-pulse` → tx `0xc3e60fa8…` + `0x60546393…` (0.001 each)
   - gateway.usebuy.ai `x.posts.search` (tikhub) → tx `0x86ff3ef7…` (0.006)
   - gateway.usebuy.ai `youtube.videos.search` (tikhub) → tx `0xeb4ffde8…` (0.006)
   - agent402.tools `/api/gov-data` → tx `0x998896df…` (0.001)

`buy-post.mjs` registers both x402 v1 (`registerV1`, legacy `celo` network alias +
`eip155:42220`) and v2 schemes so a single script pays any Celo x402 service; only
`eip155:42220` routes keep settlement on Celo.

## Market position (index scan, 2026-10-09)

Scanned the open x402 economy index (agent402.tools/api/index): **4,703 sellers,
150k+ paid tools**. Of those, Celo (`eip155:42220`) support appears on effectively
zero service manifests — the index itself lists the chain but exposes no Celo resources.
A pay-per-call Celo on-chain data feed (this agent) sits in an unoccupied niche:
no competing seller of Celo chain data via x402 was found.

## Run

```bash
cd worker && npx wrangler deploy && \
  npx wrangler secret put X402_API_KEY   # from agent/mintkey.mjs
cd .. && node agent/register.mjs mainnet # once the wallet has Celo mainnet gas
```

Sepolia CELO: https://faucet.celo.org · Mainnet USA₮ (Self KYC):
https://cloud.google.com/application/web3/faucet/celo/mainnet

Written during the hackathon window (opened 2026-10-06). Apache-2.0 intent; toolbox lineage MIT.
