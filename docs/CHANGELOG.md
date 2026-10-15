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
