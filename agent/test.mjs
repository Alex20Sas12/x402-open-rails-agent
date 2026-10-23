// Minimal self-check: the ERC-8021 attribution tag must verify on-chain.
// Fails if the tagged registration tx is missing the project code.
import { verifyTx } from '@celo/attribution-tags'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'

const TAG = 'celo_d77d36f60ddb'
const TX = '0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc'

const client = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })
const r = await verifyTx({ client, hash: TX })
if (!r.codes.includes(TAG)) {
  console.error('FAIL: attribution tag not found in', TX, JSON.stringify(r))
  process.exit(1)
}
console.log('ok: attribution tag', TAG, 'verified on-chain for', TX)
