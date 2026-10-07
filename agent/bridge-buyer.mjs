// One-shot: bridge $0.20 Base USDC -> Celo USDC for the toolbox buyer wallet via Relay permit.
// ponytail: shares logic with bridge-relay.mjs; kept separate because recipient differs.
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { readFileSync } from 'node:fs'

const SRC = JSON.parse(readFileSync('C:/Users/Admin/hustle10/keys/evm_x402.json', 'utf8'))
const DST = JSON.parse(readFileSync('C:/Users/Admin/hustle10/keys/evm_x402_toolbox.json', 'utf8'))
const pk = k => { let s = (k.private_key || k.privateKey || k.pk).replace(/^0x/, '').replace(/^0x/, ''); return '0x' + s }
const src = privateKeyToAccount(pk(SRC))
const dst = privateKeyToAccount(pk(DST))
console.log('src', src.address, '-> dst', dst.address)

const AMT = '200000' // $0.20 out
const q = await fetch('https://api.relay.link/quote/v2', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: src.address, recipient: dst.address, originChainId: 8453, destinationChainId: 42220,
    originCurrency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', destinationCurrency: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    amount: AMT, usePermit: true, tradeType: 'EXACT_OUTPUT' }) }).then(r => r.json())
const step = q.steps.find(s => s.kind === 'signature')
const sign = step.items[0].data.sign
const wallet = createWalletClient({ account: src, chain: base, transport: http() })
const signature = await wallet.signTypedData({ domain: sign.domain, types: sign.types, primaryType: sign.primaryType, message: sign.value })
const ex = await fetch(`https://api.relay.link/execute/permits?signature=${encodeURIComponent(signature)}`, { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'eip3009', requestId: step.requestId || q.requestId, api: step.api || 'swap' }) })
console.log('execute:', ex.status, (await ex.text()).slice(0, 200))

for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 4000))
  const bal = await fetch('https://forno.celo.org', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', data: '0x70a08231000000000000000000000000' + dst.address.slice(2) }, 'latest'] }) }).then(r => r.json())
  const v = Number(BigInt(bal.result)) / 1e6
  console.log(`t=${i * 4}s dstCeloUSDC=${v}`)
  if (v >= 0.19) { console.log('DONE'); process.exit(0) }
}
process.exit(2)
