# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial hackathon release of Open Rails Data Agent
- 7 x402 pay-per-call endpoints on Celo Mainnet
- ERC-8004 agent registration with attribution tag `celo_d77d36f60ddb`
- Integration guide for `@x402/fetch` clients
- Examples for all 7 routes with 402 flow
- FAQ section covering x402, payment, and attribution tag
- Runnable self-check `npm test` (agent/test.mjs): verifies the ERC-8021 attribution tag `celo_d77d36f60ddb` on-chain against the Celo mainnet registration tx; exits non-zero if it disappears
- GitHub Actions CI (.github/workflows/ci.yml): runs `npm ci` + `npm test` on every push to main and pull request, so the attribution-tag and repo↔deploy drift checks are enforced publicly, not just locally. CI badge added to README.
- Repo↔deploy drift check in `npm test` (agent/test.mjs): compares routes/prices declared in worker/src/worker.js against the live deployed worker manifest and one real 402 challenge; exits non-zero on any divergence. Guards the failure class of commit 4ab8bd3 in both directions (corrupt repo vs. bad deploy).

- worker/src/worker.js was syntactically broken in commit 4ab8bd3 (a stray
  `"/celo/token-balance"{...}` block replaced the tail of `openapi()`), making the repo
  copy unparseable by `node --check` and any fresh `wrangler deploy` fail. Reverted the file
  to the last known-good version (identical to b40fff7). The deployed worker was never
  affected; no prices or route logic changed.

### Fixed
- Documentation named the wrong 402 challenge header (`X-PAYMENT-CHALLENGE`). The deployed
  worker emits the JSON challenge body plus the base64 `PAYMENT-REQUIRED` header and
  `X-PAYMENT-VERSION: 2` — README FAQ and INTEGRATION.md now say so, so hand-rolled buyers
  parse the header that actually arrives.
- package.json metadata corrected: name `repo` -> `x402-open-rails-agent` (matches GitHub repo),
  license `ISC` -> `MIT` (the shipped LICENSE file is MIT), description/author/keywords added,
  bogus `"main": "index.js"` removed (this repo is a worker + agent scripts, not a library).
- .gitignore: STATE.md (internal ops log), *.bak and _outbound_full.json (local artifacts)
  no longer show up as untracked noise; none were ever committed, so git history is unchanged.
- agent.json `image` pointed at `agent/logo.png`, which was never committed — the URL 404'd since
  the initial commit (ec54277). Added the logo (512x512 PNG, "x402" on Celo green) and an
  `npm test` check that the declared image URL resolves (HEAD 200), so metadata can't ship broken links again.

## [0.1.0] - 2026-10-14

### Added
- Project scaffolding: worker, agent.json, README, INTEGRATION.md
- Cloudflare Worker with x402 facilitator integration
- 7 endpoints: block, gas-price, balance, token-balance, tx, tx-receipt, erc8004-uri
- EIP-3009 payment scheme support (USDC, USDT, USA₮ on Celo)
- Builder-code extension with hackathon attribution tag
- Agent registration script (`agent/register.mjs`)
- Buyer E2E test client (`agent/buyer-e2e.mjs`)

### Changed
- N/A

### Fixed
- N/A
