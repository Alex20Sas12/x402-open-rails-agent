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

// Drift check: the deployed worker must match the repo's declared routes/prices.
// Guards the failure class of commit 4ab8bd3 (repo worker.js corrupted, deploy unaffected)
// and the inverse (bad deploy diverging from repo).
import { readFile } from 'node:fs/promises'

const BASE = 'https://open-rails-data-agent.shablony-pro.workers.dev'
const src = await readFile(new URL('../worker/src/worker.js', import.meta.url), 'utf8')
const repoRoutes = Object.fromEntries(
  [...src.matchAll(/"(\/celo\/[a-z0-9-]+)":\s*\{\s*price:\s*"(\d+)"/g)].map(m => [m[1], m[2]]))

const man = await (await fetch(BASE + '/')).json()
const liveRoutes = Object.fromEntries(Object.entries(man.routes).map(([p, r]) => [p, String(r.price)]))
if (man.tag !== TAG) { console.error('FAIL: live tag', man.tag, '!=', TAG); process.exit(1) }
if (JSON.stringify(repoRoutes) !== JSON.stringify(liveRoutes)) {
  console.error('FAIL: repo/deploy route drift\n repo:', repoRoutes, '\n live:', liveRoutes); process.exit(1)
}
// One route must actually challenge with 402 and the repo price.
const res = await fetch(BASE + '/celo/block')
if (res.status !== 402) { console.error('FAIL: /celo/block expected 402, got', res.status); process.exit(1) }
const ch = await res.json()
if (ch.accepts?.[0]?.amount !== repoRoutes['/celo/block']) {
  console.error('FAIL: 402 amount', ch.accepts?.[0]?.amount, '!= repo price', repoRoutes['/celo/block']); process.exit(1)
}
console.log('ok: deployed worker matches repo —', Object.keys(repoRoutes).length, 'routes, tag, 402 challenge verified')

// agent.json metadata check: the declared image URL must map to a file that exists in the repo.
// Guards the shipped bug: agent.json pointed at agent/logo.png that was never committed (404 since ec54277).
// ponytail: local-path mapping, not a remote HEAD — deterministic in CI, no CDN lag/rate-limit flake.
const meta = JSON.parse(await readFile(new URL('../agent.json', import.meta.url), 'utf8'))
if (meta.image) {
  const m = meta.image.match(/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/)
  if (!m) { console.error('FAIL: agent.json image is not a raw.githubusercontent URL:', meta.image); process.exit(1) }
  await readFile(new URL('../' + m[1], import.meta.url)) // throws if missing
}
console.log('ok: agent.json image exists in repo —', meta.image)
