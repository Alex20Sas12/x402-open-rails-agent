// Open Rails Data Agent — x402 pay-per-call Celo data endpoints.
// Settles USDC/USDT/USA₮ on Celo via the hosted facilitator (api.x402.celo.org):
// buyer signs EIP-3009 (no gas for buyer), facilitator pays settlement gas.
// payTo = the agent wallet that also carries the hackathon attribution tag on its own txs.
//
// Attribution: 402 bodies declare the builder-code extension with the issued code.
// (Hosted facilitator does not emit Schema-2 suffixes yet — x402-rs#99 — so this
// declares intent per spec and keeps the code discoverable in the 402 contract.)

const TAG = "celo_d77d36f60ddb"; // issued by Loops House at registration
const CAIP = { mainnet: "eip155:42220", sepolia: "eip155:11142220" };
const ASSETS = {
  mainnet: [
    { asset: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", symbol: "USDC", name: "USDC", version: "2" },
    { asset: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", symbol: "USDT", name: "Tether USD", version: "1" },
    { asset: "0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771", symbol: "USAT", name: "Tether America USD", version: "1" },
  ],
  sepolia: [
    { asset: "0x01C5C0122039549AD1493B8220cABEdD739BC44E", symbol: "USDC", name: "USDC", version: "2" },
  ],
};
const RPC = { mainnet: "https://forno.celo.org", sepolia: "https://celo-sepolia.drpc.org" };
const IDENTITY = { mainnet: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", sepolia: "0x8004A818BFB912233c491871b3d84c89A494BD9e" };
const FAC = { mainnet: "https://api.x402.celo.org", sepolia: "https://api.x402.sepolia.celo.org" };

const J = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", ...headers } });
async function rpc(net, method, params = []) {
  const r = await fetch(RPC[net], { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}
const hexAddr = s => { if (!/^0x[0-9a-fA-F]{40}$/.test(s || "")) throw new Error("address must be 0x + 40 hex chars"); return s.toLowerCase(); };
const hex32 = s => { if (!/^0x[0-9a-fA-F]{64}$/.test(s || "")) throw new Error("hash must be 0x + 64 hex chars"); return s.toLowerCase(); };
const p64 = a => a.slice(2).toLowerCase().padStart(64, "0");

// ---------- paid routes: deterministic on-chain reads (no external API cost) ----------
const ROUTES = {
  "/celo/block":        { price: "500",  desc: "Latest Celo block number via eth_blockNumber.", fn: u => rpc(u.net, "eth_blockNumber").then(h => ({ blockNumber: parseInt(h, 16), hex: h })) },
  "/celo/gas-price":    { price: "500",  desc: "Current Celo gas price in wei and gwei.", fn: u => rpc(u.net, "eth_gasPrice").then(h => ({ wei: BigInt(h).toString(), gwei: Number(BigInt(h)) / 1e9 })) },
  "/celo/balance":      { price: "1000", desc: "Native CELO balance of any wallet. Params: address.", fn: u => rpc(u.net, "eth_getBalance", [hexAddr(u.p.get("address")), "latest"]).then(h => ({ wei: BigInt(h).toString(), celo: Number(BigInt(h)) / 1e18 })) },
  "/celo/token-balance":{ price: "1000", desc: "ERC-20 balance (USDC/USDT/any) with decimals. Params: token, address.", fn: async u => {
    const t = hexAddr(u.p.get("token")), a = hexAddr(u.p.get("address"));
    let dec = 6;
    try { dec = Number(BigInt(await rpc(u.net, "eth_call", [{ to: t, data: "0x313ce567" }, "latest"]))); } catch {}
    const h = await rpc(u.net, "eth_call", [{ to: t, data: "0x70a08231" + p64(a) }, "latest"]);
    return { token: t, address: a, decimals: dec, raw: BigInt(h).toString(), amount: Number(BigInt(h)) / 10 ** dec };
  } },
  "/celo/tx":           { price: "2000", desc: "Full transaction by hash. Params: hash.", fn: u => rpc(u.net, "eth_getTransactionByHash", [hex32(u.p.get("hash"))]).then(r => { if (!r) throw new Error("transaction not found"); return r; }) },
  "/celo/tx-receipt":   { price: "2000", desc: "Transaction receipt (status, gasUsed, logs). Params: hash.", fn: u => rpc(u.net, "eth_getTransactionReceipt", [hex32(u.p.get("hash"))]).then(r => { if (!r) throw new Error("receipt not found"); return r; }) },
  "/celo/erc8004-uri":  { price: "2000", desc: "ERC-8004 agent URI by agentId (tokenURI on the Identity registry). Params: id.", fn: async u => {
    const id = "0x" + BigInt(u.p.get("id") || "0").toString(16).padStart(64, "0");
    const h = await rpc(u.net, "eth_call", [{ to: IDENTITY[u.net], data: "0xc87b56dd" + id }, "latest"]);
    const len = parseInt(h.slice(66, 130), 16);
    const uri = decodeURIComponent(h.slice(130, 130 + len * 2).replace(/(..)/g, "%$1"));
    return { agentId: u.p.get("id"), registry: IDENTITY[u.net], agentURI: uri };
  } },
};

// ---------- x402 v2 challenge ----------
function accepts(net, path, env) {
  const amount = ROUTES[path].price;
  return ASSETS[net].map(a => ({
    scheme: "exact", network: CAIP[net], amount, asset: a.asset, payTo: env.PAY_TO, maxTimeoutSeconds: 300,
    extra: { name: a.name, version: a.version },
  }));
}
function challenge(net, path, url, env) {
  const body = { x402Version: 2, error: "PAYMENT-SIGNATURE header is required",
    resource: { url, description: ROUTES[path].desc, mimeType: "application/json", serviceName: "open-rails-data-agent", tags: ["celo", "data", "x402"] },
    accepts: accepts(net, path, env),
    extensions: { "builder-code": { info: { a: TAG },
      schema: { "$schema": "https://json-schema.org/draft/2020-12/schema", type: "object", properties: {
        a: { type: "string", pattern: "^[a-z0-9_]{1,32}$" }, w: { type: "string", pattern: "^[a-z0-9_]{1,32}$" },
        s: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] } } } } } };
  return new Response(JSON.stringify(body), { status: 402,
    headers: { "Content-Type": "application/json", "X-PAYMENT-VERSION": "2", "PAYMENT-REQUIRED": btoa(JSON.stringify(body)) } });
}

// ---------- facilitator verify/settle ----------
async function facCall(net, path, xp, reqs, env) {
  let payload; try { payload = JSON.parse(atob(xp)); } catch { return { status: 400, data: { isValid: false, invalidReason: "invalid_payment_header" } }; }
  const r = await fetch(FAC[net] + path, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": env.X402_API_KEY },
    body: JSON.stringify({ x402Version: payload.x402Version || 2, paymentPayload: payload, paymentRequirements: reqs }) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
function pickReq(payload, net, path, env) {
  const asset = String(payload?.accepted?.asset || payload?.paymentRequirements?.asset || "").toLowerCase();
  const list = accepts(net, path, env);
  return list.find(a => a.asset.toLowerCase() === asset) || list[0];
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const net = url.searchParams.get("network") === "sepolia" ? "sepolia" : "mainnet";
    try {
      if (url.pathname === "/health") return J({ ok: true, routes: Object.keys(ROUTES).length });
      if (url.pathname === "/") return J({ agent: "open-rails-data-agent", tag: TAG, network: net, wallet: env.PAY_TO,
        identityRegistry: IDENTITY[net], facilitator: FAC[net],
        routes: Object.fromEntries(Object.entries(ROUTES).map(([p, r]) => [p, { price: r.price, desc: r.desc }])),
        discovery: { openapi: "/openapi.json", x402: "/.well-known/x402" } });
      if (url.pathname === "/openapi.json") return J(openapi(url.origin));
      // agent402-service-manifest/1 — discovery manifest for the open crawl (agent402.tools/sell).
      // ponytail: static list mirrors ROUTES keys by construction; regenerate here if routes change.
      if (url.pathname === "/.well-known/x402") return J({ spec: "agent402-service-manifest/1", version: 1,
        resources: Object.keys(ROUTES).map(p => url.origin + p),
        networks: Object.values(CAIP),
        payTo: env.PAY_TO,
        attribution: { "builder-code": TAG } });
      const route = ROUTES[url.pathname];
      if (!route) return J({ error: "unknown route", routes: Object.keys(ROUTES) }, 404);

      const xp = request.headers.get("X-PAYMENT") || request.headers.get("PAYMENT-SIGNATURE");
      if (!xp) return challenge(net, url.pathname, url.origin + url.pathname, env);

      const payload = JSON.parse(atob(xp));
      const reqs = pickReq(payload, net, url.pathname, env);
      const v = await facCall(net, "/verify", xp, reqs, env);
      if (v.status !== 200 || !v.data || v.data.isValid !== true)
        return J({ x402Version: 2, error: "Invalid payment payload", details: v.data || `facilitator ${v.status}` }, 402);

      let result;
      try { result = await route.fn({ net, p: url.searchParams }); }
      catch (e) { return J({ error: String(e.message || e), route: url.pathname }, 400); }

      ctx.waitUntil(facCall(net, "/settle", xp, reqs, env)
        .then(s => console.log("settle", url.pathname, s.status, s.data?.transaction || s.data?.error || "")).catch(e => console.log("settle error", String(e))));
      return J({ paid: true, route: url.pathname, network: net, tag: TAG, ...result });
    } catch (e) {
      return J({ error: String(e.message || e) }, 500);
    }
  },
};

function openapi(origin) {
  const paths = {};
  for (const [p, r] of Object.entries(ROUTES))
    paths[p] = { get: { summary: r.desc, parameters: [{ name: "network", in: "query", schema: { type: "string", enum: ["mainnet", "sepolia"] }, required: false }],
      responses: { "200": { description: "paid result (x402 settled on Celo)" }, "402": { description: "payment required" } } } };
  return { openapi: "3.1.0", info: { title: "Open Rails Data Agent", version: "1.0.0",
    description: `x402 pay-per-call Celo data endpoints. Attribution tag ${TAG}. Repo: https://github.com/Alex20Sas12/x402-open-rails-agent` },
    servers: [{ url: origin }], paths };
}
