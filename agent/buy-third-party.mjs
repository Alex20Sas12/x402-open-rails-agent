// Build-with-buy: one paid call into a third-party x402 service from OUR tagged agent wallet (0x5a8d…).
// Usage: node buy-third-party.mjs <url>
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const d = JSON.parse(readFileSync('C:/Users/Admin/hustle10/keys/evm_x402.json', 'utf8'))
const account = privateKeyToAccount(d.private_key.startsWith('0x') ? d.private_key : '0x' + d.private_key)
const client = new x402Client()
client.register('eip155:42220', new ExactEvmScheme(account, { rpcUrl: 'https://forno.celo.org' }))
// ponytail: 8453 lets us pay Pocket (Celo data sold on Base USDC) from the same tagged wallet.
client.register('eip155:8453', new ExactEvmScheme(account, { rpcUrl: 'https://mainnet.base.org' }))
const payFetch = wrapFetchWithPayment(fetch, client)

const URL = process.argv[2]
const body = process.argv[3]
const opt = { headers: { 'X-Idempotency-Key': 'bwb-' + Date.now() } }
if (body) { opt.method = 'POST'; opt.headers['Content-Type'] = 'application/json'; opt.body = body }
console.log('buyer(tagged agent):', account.address, '→', URL)
const res = await payFetch(URL, opt)
const text = await res.text()
console.log('HTTP', res.status)
console.log('body:', text.slice(0, 500))
const pr = res.headers.get('x-payment-response') || res.headers.get('payment-response')
if (pr) console.log('settlement:', Buffer.from(pr, 'base64').toString('utf8').slice(0, 400))
