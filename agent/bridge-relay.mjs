// Gasless bridge: Base USDC -> Celo USDC via Relay.link permit (EIP-3009, relayer pays gas).
// $0 external cost: only the ~2.5% relayer fee out of our own Base USDC.
// Usage: node bridge-relay.mjs [amountOutMicroUsdc, default 2000000 = $2.00 on Celo]
import { createWalletClient, http, parseAbi } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, celo } from 'viem/chains'
import { readFileSync } from 'node:fs'

const AMOUNT_OUT = BigInt(process.argv[2] || '2000000')
const USER = (() => {
  const d = JSON.parse(readFileSync('C:/Users/Admin/hustle10/keys/evm_x402.json', 'utf8'))
  const k = d.private_key || d.privateKey || d.pk
  return privateKeyToAccount(k.startsWith('0x') ? k : '0x' + k)
})()

const q = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

// fresh quote each run — permit validBefore is only minutes out
const quote = await q('https://api.relay.link/quote/v2', {
  user: USER.address, recipient: USER.address,
  originChainId: 8453, destinationChainId: 42220,
  originCurrency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
  destinationCurrency: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // Celo USDC
  amount: AMOUNT_OUT.toString(), usePermit: true, tradeType: 'EXACT_OUTPUT',
})
if (quote.status !== 200 || !quote.data.steps) { console.error('quote failed', quote.status, JSON.stringify(quote.data).slice(0, 400)); process.exit(1) }
const step = quote.data.steps.find(s => s.kind === 'signature')
const sign = step.items[0].data.sign
console.log('need base USDC:', quote.data.details.currencyIn.amountFormatted, '| fees USDC:', quote.data.fees.relayer.amountFormatted)

const wallet = createWalletClient({ account: USER, chain: base, transport: http() })
const signature = await wallet.signTypedData({
  domain: sign.domain, types: sign.types, primaryType: sign.primaryType, message: sign.value,
})
console.log('signed permit')

const ex = await q(`https://api.relay.link/execute/permits?signature=${encodeURIComponent(signature)}`, {
  kind: 'eip3009', requestId: step.requestId || quote.data.requestId, api: step.api || 'swap',
})
console.log('execute/permits:', ex.status, JSON.stringify(ex.data).slice(0, 300))
if (ex.status !== 200) process.exit(1)

// poll status
const celoClient = createWalletClient({ chain: celo, transport: http() }).extend(() => ({})) // unused, keep imports simple
const checkEndpoint = (ex.data.steps || quote.data.steps).map(s => s.items?.[0]?.check).find(Boolean)
const url = checkEndpoint ? `https://api.relay.link${checkEndpoint.endpoint}` : null
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 5000))
  const bal = await fetch('https://forno.celo.org', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', data: '0x70a08231000000000000000000000000' + USER.address.slice(2) }, 'latest'] }) }).then(r => r.json())
  const celoUsdc = Number(BigInt(bal.result)) / 1e6
  const st = url ? await fetch(url).then(r => r.json()).catch(() => null) : null
  console.log(`t=${i * 5}s celoUSDC=${celoUsdc} status=${st?.status || '?'}`)
  if (celoUsdc >= Number(AMOUNT_OUT) / 1e6 - 0.01) { console.log('DONE — Celo USDC landed:', celoUsdc); process.exit(0) }
  if (st?.status === 'failure') { console.error('relay failure', JSON.stringify(st).slice(0, 500)); process.exit(1) }
}
console.error('timeout — check https://relay.link/explorer manually'); process.exit(2)
