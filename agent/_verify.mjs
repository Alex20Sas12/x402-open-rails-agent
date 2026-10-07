import { verifyTx } from '@celo/attribution-tags'
import { createPublicClient, http } from 'viem'
import { celoSepolia } from 'viem/chains'
const client = createPublicClient({ chain: celoSepolia, transport: http('https://celo-sepolia.drpc.org') })
for (const h of ['0xf812be3f986ee6c3ea63bcbf90d702f4e86a22b7dc99edca7737d6c272709792','0x9a5cf4226ca79c91b3736a0ecb925ff16f249af9fea1ca0113b89c13a28d9fa0']) {
  const r = await verifyTx({ client, hash: h })
  console.log(h.slice(0,12), '→', JSON.stringify(r))
}
