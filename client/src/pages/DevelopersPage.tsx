import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Code, 
  DollarSign, 
  Zap, 
  Shield, 
  CheckCircle,
  ExternalLink,
  Copy,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DevelopersPage() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const services = [
    {
      id: 'multi-chain-balance',
      name: 'Multi-Chain Balance',
      price: '$0.10',
      description: 'Get real-time balances across Ethereum, Base, Polygon, Arbitrum, and BNB Chain',
      endpoint: '/api/x402/multi-chain-balance',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "chains": ["ethereum", "base"], "includeTokens": true }`,
      exampleResponse: `{ "success": true, "balances": { "ethereum": "1.23 ETH", "base": "0.05 ETH" }, "tokens": [{ "symbol": "USDC", "balance": "100.50" }] }`
    },
    {
      id: 'gas-price-oracle',
      name: 'Gas Price Oracle',
      price: '$0.10',
      description: 'Real-time gas prices with fast/average/slow recommendations',
      endpoint: '/api/x402/gas-price-oracle',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "chains": ["ethereum", "base", "polygon"] }`,
      exampleResponse: `{ "success": true, "data": { "ethereum": { "fast": 25, "average": 18, "slow": 12 } } }`
    },
    {
      id: 'token-price',
      name: 'Token Price Feed',
      price: '$0.25',
      description: 'Live token prices with 24h change and volume data',
      endpoint: '/api/x402/token-price',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "tokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "price": 2847.32, "change24h": 2.4, "volume24h": "1234567890" }`
    },
    {
      id: 'contract-scan',
      name: 'Contract Quick Scan',
      price: '$0.50',
      description: 'Security analysis and metadata for any smart contract',
      endpoint: '/api/x402/contract-scan',
      method: 'POST',
      category: 'Security',
      exampleRequest: `{ "contractAddress": "0x...", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "riskLevel": "low", "verified": true, "findings": [] }`
    },
    {
      id: 'wallet-risk',
      name: 'Wallet Risk Score',
      price: '$0.50',
      description: 'AML/fraud risk assessment for any wallet address',
      endpoint: '/api/x402/wallet-risk',
      method: 'POST',
      category: 'Security',
      exampleRequest: `{ "walletAddress": "0x...", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "riskScore": 15, "riskLevel": "low", "flags": [] }`
    },
    {
      id: 'trade-signals',
      name: 'Trade Signals',
      price: '$1.00',
      description: 'AI-powered trading signals with confidence scores',
      endpoint: '/api/x402/trade-signals',
      method: 'POST',
      category: 'Trading',
      exampleRequest: `{ "token": "ETH", "timeframe": "1h", "riskLevel": "medium" }`,
      exampleResponse: `{ "success": true, "signal": "BUY", "confidence": 0.85, "entry": 2850, "target": 2920 }`
    },
    {
      id: 'token-sentiment',
      name: 'Token Social Sentiment',
      price: '$0.75',
      description: 'Real-time social media sentiment analysis for any token',
      endpoint: '/api/x402/token-sentiment',
      method: 'POST',
      category: 'Trading',
      exampleRequest: `{ "tokenSymbol": "ETH", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "sentiment": "bullish", "score": 72, "mentions": 1284 }`
    },
    {
      id: 'trending-tokens',
      name: 'Trending Tokens Feed',
      price: '$0.50',
      description: 'Discover trending tokens before they pump',
      endpoint: '/api/x402/trending-tokens',
      method: 'POST',
      category: 'Trading',
      exampleRequest: `{ "timeframe": "24h", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "tokens": [{ "symbol": "PEPE", "change": 45.2, "volume": "12M" }] }`
    },
    {
      id: 'whale-alerts',
      name: 'Whale Wallet Alerts',
      price: '$1.00',
      description: 'Real-time notifications for large wallet movements',
      endpoint: '/api/x402/whale-alerts',
      method: 'POST',
      category: 'Trading',
      exampleRequest: `{ "chains": ["ethereum"], "minValueUsd": 100000 }`,
      exampleResponse: `{ "success": true, "alerts": [{ "from": "0x...", "amount": "500 ETH", "value": "$1.4M" }] }`
    },
    {
      id: 'dex-liquidity',
      name: 'DEX Liquidity Monitor',
      price: '$0.50',
      description: 'Track liquidity pools across major DEXs',
      endpoint: '/api/x402/dex-liquidity',
      method: 'POST',
      category: 'DeFi',
      exampleRequest: `{ "tokenAddress": "0x...", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "totalLiquidity": "$2.4M", "pools": [{ "dex": "Uniswap", "liquidity": "$1.2M" }] }`
    },
    {
      id: 'transaction-builder',
      name: 'Transaction Builder',
      price: '$2.00',
      description: 'Build and simulate complex multi-step transactions',
      endpoint: '/api/x402/transaction-builder',
      method: 'POST',
      category: 'DeFi',
      exampleRequest: `{ "steps": [{ "action": "swap", "tokenIn": "ETH", "tokenOut": "USDC", "amount": "1.0" }] }`,
      exampleResponse: `{ "success": true, "txData": "0x...", "gasEstimate": 150000, "expectedOutput": "2850 USDC" }`
    },
    {
      id: 'token-metadata',
      name: 'Token Metadata',
      price: '$0.25',
      description: 'Complete token information including logo, decimals, and total supply',
      endpoint: '/api/x402/token-metadata',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "tokenAddress": "0x...", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "name": "Ethereum", "symbol": "ETH", "decimals": 18, "totalSupply": "120M" }`
    },
    {
      id: 'approval-manager',
      name: 'Approval Manager',
      price: '$1.50',
      description: 'Manage token approvals and revoke dangerous permissions',
      endpoint: '/api/x402/approval-manager',
      method: 'POST',
      category: 'Security',
      exampleRequest: `{ "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "action": "revoke", "spender": "0x1111111254fb6c44bAC0beD2854e76F90643097d" }`,
      exampleResponse: `{ "success": true, "txData": "0x095ea7b30000000000000000000000001111111254fb6c44bAC0beD2854e76F90643097d0000000000000000000000000000000000000000000000000000000000000000", "message": "Approval revoked" }`
    },
    {
      id: 'batch-quote',
      name: 'Batch Quote Service',
      price: '$1.00',
      description: 'Get swap quotes for multiple token pairs simultaneously',
      endpoint: '/api/x402/batch-quote',
      method: 'POST',
      category: 'DeFi',
      exampleRequest: `{ "pairs": [{ "tokenIn": "ETH", "tokenOut": "USDC", "amount": "1.0" }] }`,
      exampleResponse: `{ "success": true, "quotes": [{ "pair": "ETH/USDC", "rate": 2850, "output": "2850 USDC" }] }`
    },
    {
      id: 'portfolio-tracker',
      name: 'Portfolio Tracker',
      price: '$0.75',
      description: 'Complete portfolio analysis with PnL tracking',
      endpoint: '/api/x402/portfolio-tracker',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "chains": ["ethereum", "base"] }`,
      exampleResponse: `{ "success": true, "totalValue": "$12,450", "pnl": "+$1,240", "assets": [{ "symbol": "ETH", "balance": "2.5", "value": "$7,100" }] }`
    },
    {
      id: 'instant-agent-wallet',
      name: 'Instant Agent Wallet',
      price: '$5.00',
      description: 'Create a Base mainnet wallet with USDC funding instantly',
      endpoint: '/api/x402/instant-agent-wallet',
      method: 'POST',
      category: 'Agent Services',
      exampleRequest: `{ "agentId": "my-ai-agent", "initialFundingAmount": 10 }`,
      exampleResponse: `{ "success": true, "walletAddress": "0x9876543210987654321098765432109876543210", "balance": "10 USDC", "privateKey": "0xPRIVATE_KEY_REDACTED" }`
    },
    {
      id: 'verified-agent-identity',
      name: 'Verified Agent Identity',
      price: '$3.00',
      description: 'Register your AI agent on-chain with ERC-8004 identity standard',
      endpoint: '/api/x402/verified-agent-identity',
      method: 'POST',
      category: 'Agent Services',
      exampleRequest: `{ "agentId": "my-ai-agent", "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", "metadata": { "name": "Trading Bot", "version": "1.0" } }`,
      exampleResponse: `{ "success": true, "tokenId": 42, "registryAddress": "0x1234567890123456789012345678901234567890", "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" }`
    },
    {
      id: 'seamless-chain-bridge',
      name: 'Seamless Chain Bridge',
      price: '$2.50',
      description: 'Bridge assets across chains with best-rate routing',
      endpoint: '/api/x402/seamless-chain-bridge',
      method: 'POST',
      category: 'DeFi',
      exampleRequest: `{ "fromChain": "ethereum", "toChain": "base", "amount": "100", "currency": "USDC" }`,
      exampleResponse: `{ "success": true, "bridgeTxHash": "0x...", "estimatedArrival": "~60 seconds" }`
    }
  ];

  const quickstartCode = `// Step 1: Send USDC payment on Base mainnet
import { ethers } from 'ethers';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);

// Amount in USDC (6 decimals) - $0.10 = 100000
const usdcContract = new ethers.Contract(USDC_BASE, ERC20_ABI, wallet);
const tx = await usdcContract.transfer(PLATFORM_WALLET, '100000'); // $0.10
await tx.wait(); // Wait for Base confirmation (~12 seconds)

// Step 2: Call API with payment proof
const response = await fetch('https://coinrailz.com/api/x402/gas-price-oracle', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': btoa(JSON.stringify({
      txHash: tx.hash,
      amount: '100000',
      token: USDC_BASE,
      from: wallet.address
    }))
  },
  body: JSON.stringify({ chains: ['ethereum', 'base'] })
});

const data = await response.json();
console.log('Gas prices:', data);`;

  const pythonExample = `# Python example using web3.py and requests
from web3 import Web3
import requests
import json
import base64
import time

w3 = Web3(Web3.HTTPProvider('https://mainnet.base.org'))
USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91'

# Send USDC payment
usdc = w3.eth.contract(address=USDC_BASE, abi=ERC20_ABI)
tx = usdc.functions.transfer(PLATFORM_WALLET, 100000).build_transaction({
    'from': your_address,
    'nonce': w3.eth.get_transaction_count(your_address),
})
signed = w3.eth.account.sign_transaction(tx, private_key=YOUR_KEY)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

# Wait for confirmation
time.sleep(15)  # Base finality ~12 seconds

# Call API with payment header
payment_proof = base64.b64encode(json.dumps({
    'txHash': tx_hash.hex(),
    'amount': '100000',
    'token': USDC_BASE,
    'from': your_address
}).encode()).decode()

response = requests.post(
    'https://coinrailz.com/api/x402/gas-price-oracle',
    headers={
        'Content-Type': 'application/json',
        'X-PAYMENT': payment_proof
    },
    json={'chains': ['ethereum', 'base']}
)

print(response.json())`;

  const curlExample = `# Test with curl (replace with your actual txHash)
curl -X POST https://coinrailz.com/api/x402/gas-price-oracle \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $(echo -n '{"txHash":"0xYOUR_TX_HASH","amount":"100000","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","from":"0xYOUR_WALLET"}' | base64)" \\
  -d '{"chains":["ethereum","base"]}'`;

  const categories = Array.from(new Set(services.map(s => s.category)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-600 dark:from-blue-900 dark:to-purple-900 text-white py-24">
        <div className="absolute inset-0 bg-grid-white/10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              x402 Micropayment Protocol
            </Badge>
            <h1 className="text-5xl font-bold mb-6">
              Stripe for Autonomous AI Agents
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              18 blockchain APIs powered by the x402 protocol. Pay per request with USDC on Base. No API keys, no registration, no subscriptions.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-blue-50"
                onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-quickstart"
              >
                <Zap className="mr-2 h-5 w-5" />
                Quickstart Guide
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white hover:bg-white/10"
                onClick={() => document.getElementById('api-reference')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-api-reference"
              >
                <Code className="mr-2 h-5 w-5" />
                API Reference
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="container mx-auto px-4 -mt-12 relative z-20">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="bg-white dark:bg-gray-800 shadow-xl border-2">
            <CardContent className="pt-6">
              <div className="text-center">
                <DollarSign className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">$0.10 - $5.00</div>
                <div className="text-gray-600 dark:text-gray-400">Per Request Pricing</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 shadow-xl border-2">
            <CardContent className="pt-6">
              <div className="text-center">
                <Zap className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">~12 seconds</div>
                <div className="text-gray-600 dark:text-gray-400">Base Confirmation</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 shadow-xl border-2">
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">18 APIs</div>
                <div className="text-gray-600 dark:text-gray-400">Blockchain Services</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* How It Works */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Send USDC Payment</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Transfer exact service price in USDC to platform wallet on Base mainnet
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-300">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Wait for Confirmation</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Base finality is ~12 seconds. Transaction must be confirmed before API call
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600 dark:text-green-300">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Call API with Proof</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Include transaction hash in X-PAYMENT header. Each txHash is single-use only
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quickstart */}
      <div id="quickstart" className="container mx-auto px-4 py-16 bg-white dark:bg-gray-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
            Quickstart Guide
          </h2>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Platform Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Platform Wallet (Base)</div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded flex-1 overflow-auto">
                        0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard('0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91', 'Wallet address')}
                        data-testid="button-copy-wallet"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">USDC on Base</div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded flex-1 overflow-auto">
                        0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC address')}
                        data-testid="button-copy-usdc"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="javascript" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="javascript" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{quickstartCode}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(quickstartCode, 'JavaScript code')}
                        data-testid="button-copy-js"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="python" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{pythonExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(pythonExample, 'Python code')}
                        data-testid="button-copy-python"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="curl" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{curlExample}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(curlExample, 'cURL code')}
                        data-testid="button-copy-curl"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <CardHeader>
                <CardTitle className="text-yellow-800 dark:text-yellow-200">
                  ⚠️ Critical Payment Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-yellow-900 dark:text-yellow-100">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Exact amounts only:</strong> Payment must match service price exactly (e.g., $0.10 = 100000 USDC wei)
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Single-use transactions:</strong> Each txHash can only be used once. Do not reuse payment proofs
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Wait for confirmation:</strong> Must wait ~12 seconds for Base finality before API call
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Base mainnet only:</strong> All payments must be USDC on Base Chain (ChainID 8453)
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* API Reference */}
      <div id="api-reference" className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
            API Reference
          </h2>

          <Tabs defaultValue={categories[0]} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
              ))}
            </TabsList>

            {categories.map(category => (
              <TabsContent key={category} value={category}>
                <div className="grid md:grid-cols-2 gap-6">
                  {services.filter(s => s.category === category).map(service => (
                    <Card key={service.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-lg">{service.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">
                                {service.method}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1">{service.description}</CardDescription>
                          </div>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex-shrink-0">
                            {service.price}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint</div>
                            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block overflow-x-auto">
                              {service.endpoint}
                            </code>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Required Header</div>
                            <code className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-200 px-2 py-1 rounded block overflow-x-auto">
                              X-PAYMENT: Base64({"{"}"txHash":"0x...","from":"0x...","to":"0xa4b...","amount":"{service.price}"{"}"})
                            </code>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Request Body</div>
                            <pre className="text-xs bg-gray-900 text-gray-100 px-2 py-2 rounded block overflow-x-auto"><code>{service.exampleRequest}</code></pre>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Success Response (200)</div>
                            <pre className="text-xs bg-gray-900 text-green-400 px-2 py-2 rounded block overflow-x-auto"><code>{service.exampleResponse}</code></pre>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Error Response (402)</div>
                            <pre className="text-xs bg-gray-900 text-red-400 px-2 py-2 rounded block overflow-x-auto"><code>{'{ "error": "Payment Required", "message": "Invalid or missing X-PAYMENT header" }'}</code></pre>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            data-testid={`button-view-${service.id}`}
                          >
                            View Full Docs <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Resources */}
      <div className="container mx-auto px-4 py-16 bg-gray-50 dark:bg-gray-800/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">
            Resources & Support
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  x402 Protocol Spec
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Learn about the HTTP 402 Payment Required standard for autonomous AI agents
                </p>
                <Button variant="outline" className="w-full" data-testid="button-x402-spec">
                  View Specification <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  ERC-8004 Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Register your AI agent with on-chain identity and reputation tracking
                </p>
                <Button variant="outline" className="w-full" data-testid="button-erc8004">
                  Learn More <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Eliza Plugin
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Official Coin Railz plugin for ElizaOS framework (PR #6148)
                </p>
                <Button variant="outline" className="w-full" data-testid="button-eliza">
                  View on GitHub <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Base Ecosystem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Featured in Base Ecosystem Group and Coinbase x402 showcase (#641)
                </p>
                <Button variant="outline" className="w-full" data-testid="button-base">
                  Explore Ecosystem <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="bg-gradient-to-br from-blue-600 to-purple-600 text-white border-0">
            <CardContent className="py-12">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Build?
              </h2>
              <p className="text-blue-100 mb-8 text-lg">
                Start integrating Coin Railz APIs into your AI agents today. No registration required.
              </p>
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-blue-50"
                onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-start-building"
              >
                <Zap className="mr-2 h-5 w-5" />
                Start Building Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
