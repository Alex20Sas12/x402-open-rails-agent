// Programmatic x402 facilitator API-key mint (no dashboard): sign the challenge nonce.
// Reads the agent private key, signs, POSTs to /api/keys. Prints ONLY the x402_ key.
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo } from 'viem/chains'
import { readFileSync } from 'node:fs'

const HOST = process.env.X402_HOST || 'https://api.x402.celo.org'
function loadPk(f) {
  const d = JSON.parse(readFileSync(`C:/Users/Admin/hustle10/keys/${f}`, 'utf8'))
  let k = d.private_key || d.privateKey
  k = k.replace(/^0x/i, '').replace(/^0x/i, '')
  return '0x' + k
}
const account = privateKeyToAccount(loadPk('evm_x402.json'))
const wallet = createWalletClient({ account, chain: celo, transport: http() })

const { nonce } = await (await fetch(`${HOST}/api/keys/nonce`)).json()
console.log('address:', account.address, 'nonce:', nonce)

// Try the common message shapes; the API will tell us which it accepts.
const msg = `x402.celo.org wants you to create an x402 API key.\n\nAddress: ${account.address}\nNonce: ${nonce}\n\nSigning this message proves you control this wallet. It costs no gas and sends no transaction.`
const signature = await wallet.signMessage({ message: msg })
const r = await fetch(`${HOST}/api/keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address: account.address, nonce, signature }) })
const body = await r.text()
if (r.ok) {
  const { writeFileSync } = await import('node:fs')
  const parsed = JSON.parse(body)
  const out = { host: HOST, account: account.address, apiKey: parsed.apiKey, balances: parsed.balances, balanceMicro: parsed.balanceMicro }
  writeFileSync('C:/Users/Admin/fabrika/celo/x402_facilitator_key.json', JSON.stringify(out, null, 1))
  console.log('OK apiKey prefix:', String(parsed.apiKey).slice(0, 12) + '…', 'balances:', JSON.stringify(parsed.balances), 'saved to', 'C:/Users/Admin/fabrika/celo/x402_facilitator_key.json')
} else {
  console.log(`FAIL ${r.status} ${body.slice(0, 200)}`)
}

