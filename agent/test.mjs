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
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

// agent.json services drift check: services[] must mirror worker.js routes/prices exactly.
// Prices live in 3 places (worker.js, live manifest, agent.json) — the checks above covered
// only the first two; this closes the gap so a hand-edited agent.json can't diverge silently.
const svcRoutes = Object.fromEntries(
  (meta.services || []).filter(s => s.endpoint?.startsWith(BASE))
    .map(s => [new URL(s.endpoint).pathname, String(s.price?.amount)]))
if (JSON.stringify(svcRoutes) !== JSON.stringify(repoRoutes)) {
  console.error('FAIL: agent.json services drift from worker.js\n agent.json:', svcRoutes, '\n worker.js:', repoRoutes); process.exit(1)
}
for (const s of meta.services || []) {
  if (s.price?.network !== 'eip155:42220') { console.error('FAIL: agent.json service not on Celo mainnet:', s.endpoint, s.price?.network); process.exit(1) }
}
if (meta.attributionTag !== TAG) { console.error('FAIL: agent.json attributionTag', meta.attributionTag, '!=', TAG); process.exit(1) }
console.log('ok: agent.json services match worker.js —', Object.keys(svcRoutes).length, 'routes, network eip155:42220, tag', TAG)

// agent.json identity check: the declared x402 endpoint must be THIS agent's live
// openapi.json. Shipped bug: since ec54277 it pointed at a different service
// (x402-toolbox, Base/Solana) and `name` said "Open Rails Toolbox Agent" —
// catalogs indexing agent.json advertised the wrong agent.
const x402ep = (meta.endpoints || []).find(e => e.type === 'x402')
if (x402ep?.url !== BASE + '/openapi.json') { console.error('FAIL: agent.json x402 endpoint', x402ep?.url, '!=', BASE + '/openapi.json'); process.exit(1) }
const oa = await (await fetch(x402ep.url)).json()
if (oa.info?.title !== meta.name) { console.error('FAIL: live openapi title', oa.info?.title, '!= agent.json name', meta.name); process.exit(1) }
console.log('ok: agent.json identity matches live service —', meta.name, x402ep.url)

// Docs drift check: route tables in README.md and INTEGRATION.md must match worker.js
// prices. Prices now live in 5 copies; earlier checks cover worker/manifest/agent.json —
// these close the two doc tables so a hand-edit can't diverge silently.
for (const file of ['README.md', 'INTEGRATION.md']) {
  const txt = await readFile(new URL('../' + file, import.meta.url), 'utf8')
  const docRoutes = Object.fromEntries(
    [...txt.matchAll(/^\| `GET (\/celo\/[a-z0-9-]+)[^`]*` \| (\d+)/gm)].map(m => [m[1], m[2]]))
  if (JSON.stringify(docRoutes) !== JSON.stringify(repoRoutes)) {
    console.error('FAIL: ' + file + ' route table drift\n doc:', docRoutes, '\n worker.js:', repoRoutes); process.exit(1)
  }
}
console.log('ok: README/INTEGRATION route tables match worker.js prices')

// OpenAPI drift check: worker.js builds openapi.json dynamically from ROUTES, but the
// live document (paths, methods, schemas, servers) must stay byte-identical to the repo.
// Guards the 7th metadata copy — a hand-edited openapi() or regressed deploy diverges silently.
const { pathToFileURL } = await import('node:url')
const srcMjs = await readFile(new URL('../worker/src/worker.js', import.meta.url), 'utf8')
const tmpDir = await mkdtemp(join(tmpdir(), 'open-rails-worker-test-'))
try {
  const tmpMjs = join(tmpDir, 'worker.mjs')
  await writeFile(tmpMjs, srcMjs)
  const mod = await import(pathToFileURL(tmpMjs))
  const resOA = await mod.default.fetch(
    new Request(BASE + '/openapi.json'),
    { PAY_TO: '0x5a8DbD4788584f9C4B59eB64087a1A18fc2f7952' }, null)
  const repoOA = await resOA.json()
  const liveOA = JSON.parse(JSON.stringify(oa))
  if (JSON.stringify(repoOA) !== JSON.stringify(liveOA)) {
    throw new Error('FAIL: openapi.json drift — live document != openapi() built from repo worker.js')
  }
  console.log('ok: live openapi.json byte-identical to repo openapi() —', Object.keys(repoOA.paths).length, 'paths')
} finally {
  await rm(tmpDir, { recursive: true, force: true })
}

// README structure check: no empty section, and all 7 route examples must sit inside
// `## Examples`. Guards fe14c90 — it inserted a bare `## Security` heading right after
// `## Examples`, leaving Examples empty and burying every example under a section that
// had no content of its own (the security text was promised in the message, never written).
{
  const txt = await readFile(new URL('../README.md', import.meta.url), 'utf8').then(t => t.replace(/\r\n/g, '\n'))
  const lines = txt.split('\n')
  const heads = lines.map((l, i) => [l, i]).filter(([l]) => /^## /.test(l))
  for (let k = 0; k < heads.length; k++) {
    const body = lines.slice(heads[k][1] + 1, heads[k + 1] ? heads[k + 1][1] : lines.length).join('\n').trim()
    if (!body) { console.error('FAIL: README section is empty —', heads[k][0]); process.exit(1) }
  }
  const exIdx = lines.findIndex(l => /^## Examples\b/.test(l))
  if (exIdx < 0) { console.error('FAIL: README has no ## Examples section'); process.exit(1) }
  const exEnd = heads.find(([, i]) => i > exIdx)?.[1] ?? lines.length
  const inExamples = lines.slice(exIdx, exEnd).filter(l => /^### \d+\. `GET \/celo\//.test(l))
  if (inExamples.length !== Object.keys(repoRoutes).length) {
    console.error('FAIL: README Examples has', inExamples.length, 'route walkthroughs, worker.js has', Object.keys(repoRoutes).length); process.exit(1)
  }
  console.log('ok: README sections non-empty,', inExamples.length, 'route examples inside ## Examples')
  // A literal backslash-n inside a bash fence renders as a stray `n` argument, so a copied
  // curl resolves host "n" (curl: (6)) instead of the API. Shipped twice in the POST
  // examples; fixed 2026-11-11. (backslash spelled BS so this check can't match itself)
  const BS = String.fromCharCode(92)
  const NL = String.fromCharCode(10)
  const fences = []
  let cur = null
  for (const l of lines) {
    if (/^```/.test(l)) {
      if (cur) { fences.push(cur); cur = null } else { cur = { info: l.slice(3).trim(), body: [] } }
      continue
    }
    if (cur) cur.body.push(l)
  }
  const bash = fences.filter(f => f.info.startsWith('bash'))
  for (const f of bash) {
    if (f.body.join(NL).includes(BS + 'n')) { console.error('FAIL: literal backslash-n inside a README bash block'); process.exit(1) }
  }
  console.log('ok: no literal backslash-n in', bash.length, 'README bash blocks')
}
