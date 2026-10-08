// Second tagged tx type: client wallet gives on-chain feedback to the agent (ERC-8004 Reputation).
// Usage: node feedback.mjs [sepolia|mainnet] — signs with the CLIENT key (toolbox wallet), rates agent 542 (sepolia).
import { createWalletClient, createPublicClient, http, encodeFunctionData, concat } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { toDataSuffix } from '@celo/attribution-tags'
import { readFileSync, existsSync } from 'node:fs'

const CODE = 'celo_d77d36f60ddb'
const net = process.argv[2] === 'mainnet' ? 'mainnet' : 'sepolia'
const chain = net === 'mainnet' ? celo : celoSepolia
const REPUTATION = {
  mainnet: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  sepolia: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
}
const ABI = [{ type: 'function', name: 'giveFeedback', stateMutability: 'nonpayable',
  inputs: [
    { name: 'agentId', type: 'uint256' }, { name: 'value', type: 'int128' },
    { name: 'valueDecimals', type: 'uint8' }, { name: 'tag1', type: 'string' },
    { name: 'tag2', type: 'string' }, { name: 'endpoint', type: 'string' },
    { name: 'feedbackURI', type: 'string' }, { name: 'feedbackHash', type: 'bytes32' },
  ], outputs: [] }]

const AGENT_ID = BigInt(process.argv[3] || (net === 'sepolia' ? 542 : 9883))

// Celo fee abstraction (CIP-64): pay gas in USDC via its allowlisted ADAPTER address (same as register.mjs).
// Toolbox wallet holds 0 CELO on mainnet, so fee abstraction is the only way to send.
const FEE_CURRENCY = { mainnet: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B', sepolia: undefined }
const STABLE = { mainnet: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' } // USDC (6dec) on Celo

function loadPk(file) {
  const p = `C:/Users/Admin/hustle10/keys/${file}`
  const d = JSON.parse(readFileSync(p, 'utf8'))
  let k = d.private_key || d.privateKey
  k = k.replace(/^0x/i, '').replace(/^0x/i, '') // file may carry a doubled 0x prefix
  if (!/^[0-9a-fA-F]{64}$/.test(k)) throw new Error('malformed private key')
  return '0x' + k
}
// client = second wallet (not the agent owner) — reputation contract rejects self-feedback
const account = privateKeyToAccount(loadPk('evm_x402_toolbox.json'))
const publicClient = createPublicClient({ chain, transport: http() })
const wallet = createWalletClient({ account, chain, transport: http() })

const tag = toDataSuffix(CODE)
const data = concat([encodeFunctionData({ abi: ABI, functionName: 'giveFeedback', args: [
  AGENT_ID, 85n, 0, 'starred', '',
  'https://x402-toolbox.shablony-pro.workers.dev',
  '', '0x' + '11'.repeat(32),
] }), tag])

const feeCurrency = FEE_CURRENCY[net]
let balance
if (feeCurrency) {
  balance = await publicClient.readContract({ address: STABLE[net], abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }], functionName: 'balanceOf', args: [account.address] })
  console.log(`net=${net} client=${account.address} celoUSDC=${Number(balance) / 1e6} (fee abstraction) agentId=${AGENT_ID}`)
} else {
  balance = await publicClient.getBalance({ address: account.address })
  console.log(`net=${net} client=${account.address} balance=${balance} agentId=${AGENT_ID}`)
}
if (balance === 0n) { console.error('ERROR: no gas/fee-currency'); process.exit(2) }
const hash = await wallet.sendTransaction({ to: REPUTATION[net], data, ...(feeCurrency ? { feeCurrency } : {}) })
console.log('tx:', hash)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log('status:', receipt.status, 'logs:', receipt.logs.length)
console.log('explorer:', net === 'sepolia' ? `https://celo-sepolia.blockscout.com/tx/${hash}` : `https://celoscan.io/tx/${hash}`)
