import { useState, useEffect } from 'react';
import { Link } from 'wouter';
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
  ChevronRight,
  Rocket,
  Terminal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DevelopersPage() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  useEffect(() => {
    // Add JSON-LD schema for Google AI indexing
    const schema = {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Developer Platform",
      "description": "APIs and microservices for AI agents and developers. Access x402 micropayment services, blockchain data, trading signals, security analysis, and DeFi tools via HTTP 402 protocol.",
      "url": "https://coinrailz.com/developers",
      "applicationCategory": "DeveloperApplication",
      "provider": {
        "@type": "Organization",
        "name": "Coin Railz",
        "url": "https://coinrailz.com"
      },
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0.10",
        "highPrice": "5.00"
      }
    };
    
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

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
      price: '$0.50',
      description: 'Get real-time balances across Ethereum, Base, Polygon, Arbitrum, and BNB Chain',
      endpoint: '/x402/multi-chain-balance',
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
      endpoint: '/x402/gas-price-oracle',
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
      endpoint: '/x402/token-price',
      method: 'POST',
      category: 'Data',
      exampleRequest: `{ "tokenAddress": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "price": 2847.32, "change24h": 2.4, "volume24h": "1234567890" }`
    },
    {
      id: 'contract-scan',
      name: 'Contract Quick Scan',
      price: '$1.00',
      description: 'Security analysis and metadata for any smart contract',
      endpoint: '/x402/contract-scan',
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
      endpoint: '/x402/wallet-risk',
      method: 'POST',
      category: 'Security',
      exampleRequest: `{ "walletAddress": "0x...", "chain": "ethereum" }`,
      exampleResponse: `{ "success": true, "riskScore": 15, "riskLevel": "low", "flags": [] }`
    },
    {
      id: 'trade-signals',
      name: 'Trade Signals',
      price: '$0.75',
      description: 'AI-powered trading signals with confidence scores',
      endpoint: '/x402/trade-signals',
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
      endpoint: '/x402/token-sentiment',
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
      endpoint: '/x402/trending-tokens',
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
      endpoint: '/x402/whale-alerts',
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
      endpoint: '/x402/dex-liquidity',
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
      endpoint: '/x402/transaction-builder',
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
      endpoint: '/x402/token-metadata',
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
      endpoint: '/x402/approval-manager',
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
      endpoint: '/x402/batch-quote',
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
      endpoint: '/x402/portfolio-tracker',
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
      endpoint: '/x402/instant-agent-wallet',
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
      endpoint: '/x402/verified-agent-identity',
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
      endpoint: '/x402/seamless-chain-bridge',
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

// Minimal ERC20 ABI for transfer function
const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

// Replace with your wallet's private key
const YOUR_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY; // e.g., '0x1234...'

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);

// Amount in USDC (6 decimals) - $0.10 = 100000
const usdcContract = new ethers.Contract(USDC_BASE, ERC20_ABI, wallet);
const tx = await usdcContract.transfer(PLATFORM_WALLET, '100000'); // $0.10
await tx.wait(); // Wait for Base confirmation (~2 seconds)

// Step 2: Call API with payment proof
const response = await fetch('https://coinrailz.com/x402/gas-price-oracle', {
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
import os

w3 = Web3(Web3.HTTPProvider('https://mainnet.base.org'))
USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
PLATFORM_WALLET = '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91'

# Replace with your wallet details
YOUR_KEY = os.getenv('WALLET_PRIVATE_KEY')  # Your private key
your_address = os.getenv('WALLET_ADDRESS')  # Your wallet address (e.g., '0x1234...')

# Minimal ERC20 ABI for transfer function
ERC20_ABI = [{"constant": False, "inputs": [{"name": "to", "type": "address"}, {"name": "value", "type": "uint256"}], "name": "transfer", "outputs": [{"name": "", "type": "bool"}], "type": "function"}]

# Send USDC payment
usdc = w3.eth.contract(address=USDC_BASE, abi=ERC20_ABI)
tx = usdc.functions.transfer(PLATFORM_WALLET, 100000).build_transaction({
    'from': your_address,
    'nonce': w3.eth.get_transaction_count(your_address),
})
signed = w3.eth.account.sign_transaction(tx, private_key=YOUR_KEY)
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)

# Wait for confirmation
time.sleep(3)  # Base finality ~2 seconds

# Call API with payment header
payment_proof = base64.b64encode(json.dumps({
    'txHash': tx_hash.hex(),
    'amount': '100000',
    'token': USDC_BASE,
    'from': your_address
}).encode()).decode()

response = requests.post(
    'https://coinrailz.com/x402/gas-price-oracle',
    headers={
        'Content-Type': 'application/json',
        'X-PAYMENT': payment_proof
    },
    json={'chains': ['ethereum', 'base']}
)

print(response.json())`;

  const curlExample = `# Test with curl (replace with your actual txHash)
curl -X POST https://coinrailz.com/x402/gas-price-oracle \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: $(echo -n '{"txHash":"0xYOUR_TX_HASH","amount":"100000","token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","from":"0xYOUR_WALLET"}' | base64)" \\
  -d '{"chains":["ethereum","base"]}'`;

  const errorHandlingExample = `// Error handling patterns
async function safeApiCall(endpoint, payload, txHash) {
  try {
    const response = await fetch(\`https://coinrailz.com/x402/\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': Buffer.from(JSON.stringify({ txHash })).toString('base64')
      },
      body: JSON.stringify(payload)
    });

    // Handle payment errors
    if (response.status === 402) {
      const error = await response.json();
      console.error('Payment failed:', error.message);
      throw new Error('Invalid payment - check txHash and amount');
    }

    // Handle rate limiting
    if (response.status === 429) {
      console.warn('Rate limited - retry after 60 seconds');
      throw new Error('Rate limit exceeded');
    }

    // Handle other errors
    if (!response.ok) {
      throw new Error(\`API error: \${response.status}\`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}`;

  const categories = Array.from(new Set(services.map(s => s.category)));

  const faqItems = [
    {
      id: 'payment-proof',
      question: 'What exactly is the X-PAYMENT header?',
      answer: 'The X-PAYMENT header contains a base64-encoded JSON object with your transaction proof. It must include the txHash of your USDC payment on Base mainnet to our platform wallet. Each txHash can only be used once.'
    },
    {
      id: 'why-base',
      question: 'Why do I have to pay on Base? Can I use another chain?',
      answer: 'Base was chosen for its speed (~2 second finality) and low fees. x402 services support Base mainnet USDC and Solana USDC. Additional chains are available via the multi-chain payment router.'
    },
    {
      id: 'rate-limits',
      question: 'What are the rate limits?',
      answer: 'Free tier: 10 requests/minute. Pro tier: 1000 requests/minute. Enterprise: custom limits. Rate limiting is per API key and resets every minute. 429 status code indicates you\'ve hit the limit.'
    },
    {
      id: 'retry-logic',
      question: 'How should I handle retries?',
      answer: 'Use exponential backoff: wait 1s, 2s, 4s, 8s, then fail. Don\'t retry on 402 (payment errors) - fix the issue instead. 429 errors can be retried after 60 seconds.'
    },
    {
      id: 'txhash-reuse',
      question: 'Can I reuse a transaction hash?',
      answer: 'No - each txHash is single-use only. If you reuse it, you\'ll get a 402 error. Generate a new payment for each API call.'
    },
    {
      id: 'refunds',
      question: 'What if the API call fails after I paid?',
      answer: 'If the API fails after successful payment (500 error), we automatically retry and credit your account. If it fails due to invalid input (400 error), the payment is non-refundable as the request was malformed.'
    }
  ];

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
              Curated Machine-Payable Data for AI Agents
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              78 crypto, satellite/IoT, and prediction-market APIs powered by the x402 protocol. Pay per request with USDC on Base or Solana — 9 chains supported. No API keys, no registration, no subscriptions.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/quickstart" data-testid="link-quickstart">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-blue-50"
                  data-testid="button-sdk-install"
                >
                  <Terminal className="mr-2 h-5 w-5" />
                  SDK Install
                </Button>
              </Link>
              <Button 
                size="lg" 
                className="bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-quickstart"
              >
                <Zap className="mr-2 h-5 w-5" />
                x402 Guide
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
                <div className="text-3xl font-bold text-gray-900 dark:text-white">~2 seconds</div>
                <div className="text-gray-600 dark:text-gray-400">Base Confirmation</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-800 shadow-xl border-2">
            <CardContent className="pt-6">
              <div className="text-center">
                <Shield className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <div className="text-3xl font-bold text-gray-900 dark:text-white">78 APIs</div>
                <div className="text-gray-600 dark:text-gray-400">Curated Data Services</div>
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
                Base finality is ~2 seconds. Transaction must be confirmed before API call
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
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Before running:</strong> Set your environment variables:
              <code className="block mt-2 bg-white dark:bg-gray-800 p-2 rounded text-xs font-mono">
                export WALLET_PRIVATE_KEY="0x..." WALLET_ADDRESS="0x..."
              </code>
            </p>
          </div>
          
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
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">USDC on Ethereum & Base</div>
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
                    <strong>Supported chains:</strong> All payments must be USDC on Ethereum (ChainID 1) or Base (ChainID 8453)
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

      {/* Rate Limiting & Error Handling */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">
            Rate Limiting & Error Handling
          </h2>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Rate Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Rate Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <div className="font-semibold text-gray-900 dark:text-white">Free Tier</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">10 requests/minute</div>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <div className="font-semibold text-gray-900 dark:text-white">Pro Tier</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">1,000 requests/minute</div>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <div className="font-semibold text-gray-900 dark:text-white">Enterprise</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Custom limits per agreement</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-900 dark:text-blue-100">
                  <strong>Rate reset:</strong> Every minute. Tracked per API endpoint.
                </div>
              </CardContent>
            </Card>

            {/* HTTP Status Codes */}
            <Card>
              <CardHeader>
                <CardTitle>HTTP Status Codes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">200</span>
                  <span className="text-gray-600 dark:text-gray-400">Success</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">400</span>
                  <span className="text-gray-600 dark:text-gray-400">Bad request (invalid input)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">402</span>
                  <span className="text-gray-600 dark:text-gray-400">Payment required/invalid</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">429</span>
                  <span className="text-gray-600 dark:text-gray-400">Rate limit exceeded</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">500</span>
                  <span className="text-gray-600 dark:text-gray-400">Server error (retry with backoff)</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Handling Example */}
          <Card>
            <CardHeader>
              <CardTitle>Error Handling Pattern</CardTitle>
              <CardDescription>Best practices for robust API integration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{errorHandlingExample}</code>
                </pre>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(errorHandlingExample, 'Error handling code')}
                  data-testid="button-copy-error-handling"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Best Practices */}
      <div className="container mx-auto px-4 py-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">
            Best Practices
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Never expose private keys:</strong> Only send txHash in headers, never keys or seeds
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Validate HTTPS:</strong> Always use HTTPS for API calls, never HTTP
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Audit txHashes:</strong> Log all payments and verify they're Base mainnet
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Batch requests:</strong> Send multiple payments upfront for burst usage
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Cache results:</strong> Store API responses locally to minimize calls
                  </div>
                </div>
                <div className="flex gap-3">
                  <CheckCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Use connection pooling:</strong> Reuse HTTP connections for better throughput
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3">
            {faqItems.map(item => (
              <Card 
                key={item.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setExpandedFaq(expandedFaq === item.id ? null : item.id)}
                data-testid={`faq-item-${item.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{item.question}</CardTitle>
                    <ChevronRight 
                      className={`h-5 w-5 text-gray-500 transition-transform ${expandedFaq === item.id ? 'rotate-90' : ''}`}
                    />
                  </div>
                </CardHeader>
                {expandedFaq === item.id && (
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-400">{item.answer}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>

          <Card className="mt-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-green-900 dark:text-green-200 flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Ready to Build?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-green-900 dark:text-green-100 mb-4">
                You have everything you need. Start with the quickstart guide, choose your framework, and build your first paid AI service in minutes.
              </p>
              <div className="flex gap-3">
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => document.getElementById('quickstart')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-ready-quickstart"
                >
                  Start Quickstart
                </Button>
                <Button 
                  variant="outline"
                  className="border-green-600 text-green-600"
                  onClick={() => document.getElementById('integration-guides')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-ready-integrations"
                >
                  View Integration Guides
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integration Guides */}
      <div id="integration-guides" className="container mx-auto px-4 py-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-center text-gray-900 dark:text-white">
            Integration Guides
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Step-by-step guides to integrate Coin Railz x402 services into your AI agent framework
          </p>

          <Tabs defaultValue="eliza" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="eliza">ElizaOS</TabsTrigger>
              <TabsTrigger value="generic">Generic Framework</TabsTrigger>
              <TabsTrigger value="quickstart">5-Minute Tutorial</TabsTrigger>
            </TabsList>

            {/* ElizaOS Integration */}
            <TabsContent value="eliza">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-6 w-6 text-blue-600" />
                    ElizaOS Integration Guide
                  </CardTitle>
                  <CardDescription>
                    Add Coin Railz x402 services to your ElizaOS agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Step 1: Helper Module */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                      Create Helper Module
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Add this utility file to handle Coin Railz API calls:
                    </p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`// coinrailzClient.ts
import fetch from "node-fetch";
import { Buffer } from "buffer";

// Coin Railz Platform Constants
const COINRAILZ_BASE_URL = "https://coinrailz.com/api/x402";
const PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;

export type Chain = "base";

export interface WalletRiskParams {
  walletAddress: string;
  chain: Chain;
}

export interface CoinRailzPaymentPayload {
  txHash: string;
}

export function encodeXPayment(payload: CoinRailzPaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export async function callWalletRisk(params: WalletRiskParams, txHash: string) {
  const xPayment = encodeXPayment({ txHash });

  const res = await fetch(\`\${COINRAILZ_BASE_URL}/wallet-risk\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": xPayment
    },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(\`Coin Railz wallet-risk error (\${res.status}): \${text}\`);
  }

  return res.json();
}`}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`// coinrailzClient.ts\nimport fetch from "node-fetch";\nimport { Buffer } from "buffer";\n\n// Coin Railz Platform Constants\nconst COINRAILZ_BASE_URL = "https://coinrailz.com/api/x402";\nconst PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";\nconst USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";\nconst BASE_CHAIN_ID = 8453;\n\nexport type Chain = "base";\n\nexport interface WalletRiskParams {\n  walletAddress: string;\n  chain: Chain;\n}\n\nexport interface CoinRailzPaymentPayload {\n  txHash: string;\n}\n\nexport function encodeXPayment(payload: CoinRailzPaymentPayload): string {\n  return Buffer.from(JSON.stringify(payload)).toString("base64");\n}\n\nexport async function callWalletRisk(params: WalletRiskParams, txHash: string) {\n  const xPayment = encodeXPayment({ txHash });\n\n  const res = await fetch(\`\${COINRAILZ_BASE_URL}/wallet-risk\`, {\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n      "X-PAYMENT": xPayment\n    },\n    body: JSON.stringify(params)\n  });\n\n  if (!res.ok) {\n    const text = await res.text();\n    throw new Error(\`Coin Railz wallet-risk error (\${res.status}): \${text}\`);\n  }\n\n  return res.json();\n}`, 'ElizaOS helper')}
                        data-testid="button-copy-eliza-helper"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Step 2: Tool Definition */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                      Define Eliza Tool
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Create a tool that your Eliza agent can call:
                    </p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`// tools/walletRiskTool.ts
import type { Tool } from "@elizaos/core";
import { callWalletRisk } from "../coinrailzClient";

export const walletRiskTool: Tool = {
  name: "wallet_risk",
  description: "Check wallet risk score via Coin Railz x402 service",
  inputSchema: {
    type: "object",
    properties: {
      walletAddress: {
        type: "string",
        description: "Wallet address to check"
      },
      chain: {
        type: "string",
        enum: ["ethereum", "base"],
        default: "ethereum"
      },
      txHash: {
        type: "string",
        description: "USDC payment txHash to Coin Railz platform wallet"
      }
    },
    required: ["walletAddress", "txHash"]
  },
  async execute(input, _context) {
    const { walletAddress, chain = "ethereum", txHash } = input as {
      walletAddress: string;
      chain: "ethereum" | "base";
      txHash: string;
    };

    const result = await callWalletRisk({ walletAddress, chain }, txHash);
    return result;
  }
};`}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`// tools/walletRiskTool.ts\nimport type { Tool } from "@elizaos/core";\nimport { callWalletRisk } from "../coinrailzClient";\n\nexport const walletRiskTool: Tool = {\n  name: "wallet_risk",\n  description: "Check wallet risk score via Coin Railz x402 service",\n  inputSchema: {\n    type: "object",\n    properties: {\n      walletAddress: {\n        type: "string",\n        description: "Wallet address to check"\n      },\n      chain: {\n        type: "string",\n        enum: ["ethereum", "base"],\n        default: "ethereum"\n      },\n      txHash: {\n        type: "string",\n        description: "USDC payment txHash to Coin Railz platform wallet"\n      }\n    },\n    required: ["walletAddress", "txHash"]\n  },\n  async execute(input, _context) {\n    const { walletAddress, chain = "ethereum", txHash } = input as {\n      walletAddress: string;\n      chain: "ethereum" | "base";\n      txHash: string;\n    };\n\n    const result = await callWalletRisk({ walletAddress, chain }, txHash);\n    return result;\n  }\n};`, 'Eliza tool')}
                        data-testid="button-copy-eliza-tool"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Step 3: Agent Config */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                      Add to Agent Config
                    </h3>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`import { walletRiskTool } from "./tools/walletRiskTool";

export const myAgentConfig = {
  name: "coinrailz-defi-guardian",
  description: "An Eliza agent using Coin Railz x402 services",
  tools: [walletRiskTool],
  // ...other Eliza config
};`}</code>
                      </pre>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>💡 Payment Setup:</strong> Developers must fund a Base wallet with USDC, send payment to <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91</code>, and provide the txHash to their agent.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Generic Framework Integration */}
            <TabsContent value="generic">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-6 w-6 text-purple-600" />
                    Generic AI Agent Integration
                  </CardTitle>
                  <CardDescription>
                    Use Coin Railz with any framework (AgentKit, LangChain, custom agents)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Node.js Example */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Node.js / TypeScript</h3>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`import fetch from "node-fetch";
import { Buffer } from "buffer";

// Coin Railz Platform Constants (Base mainnet)
const COINRAILZ_BASE_URL = "https://coinrailz.com/api/x402";
const PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function encodeXPayment(txHash) {
  return Buffer.from(JSON.stringify({ txHash })).toString("base64");
}

export async function getWalletRisk(walletAddress, chain, txHash) {
  const xPayment = encodeXPayment(txHash);

  const res = await fetch(\`\${COINRAILZ_BASE_URL}/wallet-risk\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": xPayment
    },
    body: JSON.stringify({ walletAddress, chain })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(\`Coin Railz error (\${res.status}): \${text}\`);
  }

  return res.json();
}

// Usage in your agent
const result = await getWalletRisk(
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "base",
  "0x123abc..." // txHash of Base USDC payment to PLATFORM_WALLET
);

console.log("Wallet risk:", result);`}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`import fetch from "node-fetch";\nimport { Buffer } from "buffer";\n\n// Coin Railz Platform Constants (Base mainnet)\nconst COINRAILZ_BASE_URL = "https://coinrailz.com/api/x402";\nconst PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";\nconst USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";\n\nfunction encodeXPayment(txHash) {\n  return Buffer.from(JSON.stringify({ txHash })).toString("base64");\n}\n\nexport async function getWalletRisk(walletAddress, chain, txHash) {\n  const xPayment = encodeXPayment(txHash);\n\n  const res = await fetch(\`\${COINRAILZ_BASE_URL}/wallet-risk\`, {\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n      "X-PAYMENT": xPayment\n    },\n    body: JSON.stringify({ walletAddress, chain })\n  });\n\n  if (!res.ok) {\n    const text = await res.text();\n    throw new Error(\`Coin Railz error (\${res.status}): \${text}\`);\n  }\n\n  return res.json();\n}\n\n// Usage in your agent\nconst result = await getWalletRisk(\n  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",\n  "base",\n  "0x123abc..." // txHash of Base USDC payment to PLATFORM_WALLET\n);\n\nconsole.log("Wallet risk:", result);`, 'Node.js code')}
                        data-testid="button-copy-generic-node"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Python Example */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Python</h3>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
                        <code>{`import json
import base64
import requests

# Coin Railz Platform Constants (Base mainnet)
COINRAILZ_BASE_URL = "https://coinrailz.com/api/x402"
PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

def encode_x_payment(tx_hash: str) -> str:
    payload = {"txHash": tx_hash}
    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")

def wallet_risk(wallet_address: str, chain: str, tx_hash: str):
    x_payment = encode_x_payment(tx_hash)

    res = requests.post(
        f"{COINRAILZ_BASE_URL}/wallet-risk",
        headers={
            "Content-Type": "application/json",
            "X-PAYMENT": x_payment
        },
        json={
            "walletAddress": wallet_address,
            "chain": chain
        }
    )

    res.raise_for_status()
    return res.json()

# Usage in your agent
result = wallet_risk(
    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "base",
    "0x123abc..."  # txHash of Base USDC payment to PLATFORM_WALLET
)

print("Wallet risk:", result)`}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(`import json\nimport base64\nimport requests\n\n# Coin Railz Platform Constants (Base mainnet)\nCOINRAILZ_BASE_URL = "https://coinrailz.com/api/x402"\nPLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"\nUSDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"\n\ndef encode_x_payment(tx_hash: str) -> str:\n    payload = {"txHash": tx_hash}\n    return base64.b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")\n\ndef wallet_risk(wallet_address: str, chain: str, tx_hash: str):\n    x_payment = encode_x_payment(tx_hash)\n\n    res = requests.post(\n        f"{COINRAILZ_BASE_URL}/wallet-risk",\n        headers={\n            "Content-Type": "application/json",\n            "X-PAYMENT": x_payment\n        },\n        json={\n            "walletAddress": wallet_address,\n            "chain": chain\n        }\n    )\n\n    res.raise_for_status()\n    return res.json()\n\n# Usage in your agent\nresult = wallet_risk(\n    "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",\n    "base",\n    "0x123abc..."  # txHash of Base USDC payment to PLATFORM_WALLET\n)\n\nprint("Wallet risk:", result)`, 'Python code')}
                        data-testid="button-copy-generic-python"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <p className="text-sm text-purple-900 dark:text-purple-100">
                      <strong>🔧 Framework Agnostic:</strong> These helpers work with AgentKit, LangChain, Haystack, or any custom agent loop. Just call the function from your agent's action/tool definition.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5-Minute Tutorial */}
            <TabsContent value="quickstart">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Rocket className="h-6 w-6 text-green-600" />
                    Build a Paid AI Agent in 5 Minutes
                  </CardTitle>
                  <CardDescription>
                    Complete tutorial: from zero to working paid agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">1</div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Choose Your Framework</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Pick any AI agent framework: ElizaOS, LangChain, AgentKit, or custom Node/Python loop. No lock-in—Coin Railz is just HTTP endpoints.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">2</div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Fund & Pay</h4>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <li>• Fund a wallet with USDC on Ethereum or Base</li>
                          <li>• Send payment to: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91</code></li>
                          <li>• Copy the transaction hash (txHash)</li>
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">3</div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Add the Helper</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Paste this 20-line helper into your project:
                        </p>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs">
                            <code>{`import fetch from "node-fetch";
import { Buffer } from "buffer";

// Coin Railz Platform Constants
const BASE_URL = "https://coinrailz.com/api/x402";
const PLATFORM_WALLET = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function encodePayment(txHash) {
  return Buffer.from(JSON.stringify({ txHash })).toString("base64");
}

export async function walletRisk(address, chain, txHash) {
  const res = await fetch(\`\${BASE_URL}/wallet-risk\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": encodePayment(txHash)
    },
    body: JSON.stringify({ walletAddress: address, chain })
  });
  
  if (!res.ok) throw new Error(\`Error \${res.status}\`);
  return res.json();
}`}</code>
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">4</div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Call from Your Agent</h4>
                        <div className="relative">
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs">
                            <code>{`const userWallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
const paymentTxHash = "0x123abc..."; // Your payment to Coin Railz

const risk = await walletRisk(userWallet, "base", paymentTxHash);

if (risk.riskScore > 80) {
  return "⚠️ High risk wallet. Proceed with caution.";
} else {
  return "✅ Low to medium risk wallet.";
}`}</code>
                          </pre>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">5</div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Scale to More Services</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Swap <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">wallet-risk</code> for any of our 72 services:
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                          <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">dex-liquidity</code> — Check pool liquidity</li>
                          <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">token-price</code> — Real-time prices</li>
                          <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">whale-alerts</code> — Track big moves</li>
                          <li>• <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">transaction-builder</code> — Construct transactions</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-4">
                    <h4 className="font-bold text-green-900 dark:text-green-100 mb-2">🎉 You're Done!</h4>
                    <p className="text-sm text-green-800 dark:text-green-200">
                      Your AI agent now has on-chain intelligence, paid per call via x402. Same pattern works for all 69 services.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
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
