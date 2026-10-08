// Build-with-buy: paid GET/POST into a third-party Celo x402 service, prints settle tx from x-payment-response.
// Usage: node buy-post.mjs <url> [json-body]
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { ExactEvmSchemeV1 } from '@x402/evm/v1'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

const d = JSON.parse(readFileSync('C:/Users/Admin/hustle10/keys/evm_x402.json', 'utf8'))
const account = privateKeyToAccount(d.private_key.startsWith('0x') ? d.private_key : '0x' + d.private_key)
const client = new x402Client()
client.registerV1('celo', new ExactEvmSchemeV1(account, { rpcUrl: 'https://forno.celo.org' }))
client.registerV1('eip155:42220', new ExactEvmSchemeV1(account, { rpcUrl: 'https://forno.celo.org' }))
client.register('eip155:42220', new ExactEvmScheme(account, { rpcUrl: 'https://forno.celo.org' }))
const payFetch = wrapFetchWithPayment(fetch, client)

const url = process.argv[2]
const body = process.argv[3]
const res = await payFetch(url, {
  method: body ? 'POST' : 'GET',
  headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': 'bwb-' + Date.now() },
  body,
})
console.log('HTTP', res.status)
const pr = res.headers.get('x-payment-response')
if (pr) {
  try {
    const j = JSON.parse(Buffer.from(pr, 'base64').toString('utf8'))
    console.log('SETTLE:', JSON.stringify(j.settlements || j, null, 1).slice(0, 800))
  } catch { console.log('x-payment-response(raw):', pr.slice(0, 300)) }
}
console.log('body:', (await res.text()).slice(0, 300))
