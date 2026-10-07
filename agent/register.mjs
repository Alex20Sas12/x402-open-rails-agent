// ERC-8004 identity registration with Celo attribution tag (ERC-8021 suffix).
// Usage: node register.mjs [sepolia|mainnet]
// Reads private key from env AGENT_PK or ../../hustle10/keys/evm_x402.json (outside repo, never committed).
import { createWalletClient, createPublicClient, http, encodeFunctionData, concat } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { toDataSuffix, codeFromRepo } from '@celo/attribution-tags'
import { readFileSync, existsSync } from 'node:fs'

// Code ISSUED by Loops House at registration — the only one credited on the leaderboard.
const CODE = 'celo_d77d36f60ddb'
const REPO = 'Alex20Sas12/x402-open-rails-agent'

const REGISTRY = {
  mainnet: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  sepolia: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
}
const IDENTITY_ABI = [
  { type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }], outputs: [{ name: 'agentId', type: 'uint256' }] },
  { type: 'function', name: 'setAgentURI', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newURI', type: 'string' }], outputs: [] },
  { type: 'event', name: 'Registered',
    inputs: [{ name: 'agentId', type: 'uint256', indexed: true }, { name: 'agentURI', type: 'string', indexed: false }, { name: 'owner', type: 'address', indexed: true }] },
]

const net = process.argv[2] === 'mainnet' ? 'mainnet' : 'sepolia'
const chain = net === 'mainnet' ? celo : celoSepolia

function loadPk() {
  if (process.env.AGENT_PK) return process.env.AGENT_PK
  const p = 'C:/Users/Admin/hustle10/keys/evm_x402.json'
  if (!existsSync(p)) throw new Error('no key source')
  const d = JSON.parse(readFileSync(p, 'utf8'))
  const k = d.private_key || d.privateKey || d.pk
  if (!k) throw new Error('no private key field')
  return k.startsWith('0x') ? k : '0x' + k
}

const account = privateKeyToAccount(loadPk())
const publicClient = createPublicClient({ chain, transport: http() })
const wallet = createWalletClient({ account, chain, transport: http() })

// agent registration file — served from the repo's raw URL (public, resolvable)
const agentURI = `https://raw.githubusercontent.com/${REPO}/main/agent.json`

const tag = toDataSuffix(CODE)
const data = concat([encodeFunctionData({ abi: IDENTITY_ABI, functionName: 'register', args: [agentURI] }), tag])

// Celo fee abstraction (CIP-64): pay gas in a stablecoin via its allowlisted ADAPTER address.
// mainnet USDC adapter is in FeeCurrencyDirectory (verified: returns gasPrice); the token itself is not.
const FEE_CURRENCY = { mainnet: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B', sepolia: undefined }
const STABLE = { mainnet: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' } // USDC token (6dec) on Celo

const feeCurrency = FEE_CURRENCY[net]
let balance
if (feeCurrency) {
  balance = await publicClient.readContract({ address: STABLE[net], abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  console.log(`net=${net} agent=${account.address} celoUSDC=${Number(balance) / 1e6} (fee abstraction)`)
} else {
  balance = await publicClient.getBalance({ address: account.address })
  console.log(`net=${net} agent=${account.address} balance=${balance}`)
}
if (balance === 0n) { console.error('ERROR: no gas/fee-currency. Refusing to send.'); process.exit(2) }

const hash = await wallet.sendTransaction({ to: REGISTRY[net], data, ...(feeCurrency ? { feeCurrency } : {}) })
console.log('tx:', hash)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log('status:', receipt.status, 'block:', receipt.blockNumber)
const reg = receipt.logs.find(l => l.topics[0] === '0x8ad64a0ac7700dd8616a0e0d3e0b3ff8f95a45b6d0b58adcb2f9912e27538b6b')
// decode agentId from any Registered event instead of hardcoding topic:
for (const l of receipt.logs) {
  try {
    const parsed = publicClient.decodeEventLog?.({ abi: IDENTITY_ABI, data: l.data, topics: l.topics })
  } catch {}
}
const regLog = receipt.logs.map(l => {
  try { const e = publicClient.decodeEventLog({ abi: IDENTITY_ABI, data: l.data, topics: l.topics }); return e } catch { return null }
}).find(e => e && e.eventName === 'Registered')
if (regLog) console.log('agentId:', regLog.args.agentId.toString())
console.log('explorer:', net === 'mainnet' ? `https://celoscan.io/tx/${hash}` : `https://celo-sepolia.blockscout.com/tx/${hash}`)
