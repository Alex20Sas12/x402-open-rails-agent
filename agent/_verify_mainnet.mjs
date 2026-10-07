import { verifyTx } from '@celo/attribution-tags'
import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'
const client = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') })
const h = '0xa409f20cb6a394c2498b436dc6bc234818032d73ae202035250f57e39a367cfc'
const r = await verifyTx({ client, hash: h })
console.log('verifyTx(mainnet):', JSON.stringify(r))
