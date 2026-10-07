// E2E test of the deployed worker against the live Celo Sepolia facilitator,
// using the OFFICIAL @x402 client packages (same stack as celo-org/x402-celo-example).
// Buyer wallet holds no Sepolia USDC, so the expected outcome is a 402 with a
// facilitator verdict (e.g. insufficient balance) — proving challenge→sign→verify
// wiring works. Run with a funded buyer on the same command to settle for real.
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'
import { privateKeyToAccount } from 'viem/accounts'
import { readFileSync } from 'node:fs'

function loadPk(f) {
  const d = JSON.parse(readFileSync(`C:/Users/Admin/hustle10/keys/${f}`, 'utf8'))
  let k = (d.private_key || d.privateKey).replace(/^0x/i, '').replace(/^0x/i, '')
  return '0x' + k
}
const account = privateKeyToAccount(loadPk('evm_x402_toolbox.json'))
const client = new x402Client()
client.register('eip155:*', new ExactEvmScheme(account, { rpcUrl: 'https://celo-sepolia.drpc.org' }))
const payFetch = wrapFetchWithPayment(fetch, client)

const URL = process.env.TARGET || 'https://open-rails-data-agent.shablony-pro.workers.dev/celo/block?network=sepolia'
console.log('buyer:', account.address, '→', URL)
const res = await payFetch(URL, { headers: { 'X-Idempotency-Key': 'e2e-' + Date.now() } })
console.log('HTTP', res.status)
console.log('body:', (await res.text()).slice(0, 500))
const pr = res.headers.get('payment-response')
if (pr) {
  const settled = JSON.parse(Buffer.from(pr, 'base64').toString('utf8'))
  console.log('settlement:', JSON.stringify(settled).slice(0, 300))
}
