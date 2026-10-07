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

const AGENT_ID = BigInt(process.argv[3] || (net === 'sepolia' ? 542 : 0))

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

const balance = await publicClient.getBalance({ address: account.address })
console.log(`net=${net} client=${account.address} balance=${balance} agentId=${AGENT_ID}`)
if (balance === 0n) { console.error('ERROR: no gas'); process.exit(2) }
const hash = await wallet.sendTransaction({ to: REPUTATION[net], data })
console.log('tx:', hash)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log('status:', receipt.status, 'logs:', receipt.logs.length)
console.log('explorer:', net === 'sepolia' ? `https://celo-sepolia.blockscout.com/tx/${hash}` : `https://celoscan.io/tx/${hash}`)
