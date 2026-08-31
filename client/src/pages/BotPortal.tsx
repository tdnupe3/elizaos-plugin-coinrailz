import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";

const PYTHON_EXAMPLE = `import requests

# Check available pairs
pairs = requests.get("https://coinrailz.com/api/bot/pairs?chain=base").json()
print(f"Available pairs: \${pairs['pairs']}")

# Get current ETH price
price = requests.get("https://coinrailz.com/api/bot/price?token=ETH").json()
print(f"ETH price: $\${price['price']}")

# Get quote
quote = requests.get("https://coinrailz.com/api/bot/dex/quote", params={
    "from": "ETH",
    "to": "USDC",
    "amount": "1.0",
    "chain": "base"
}).json()
print(f"Rate: \${quote['exchangeRate']} USDC per ETH")
print(f"Platform fee: \${quote['platformFee']}")

# Execute swap (CDP handles gas)
swap = requests.post("https://coinrailz.com/api/bot/dex/swap", json={
    "from": "ETH",
    "to": "USDC",
    "amount": "1.0",
    "walletAddress": "0xYourWallet",
    "chain": "base"
}).json()
print(f"Tx hash: \${swap['transactionHash']}")`;

export default function BotPortal() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2" data-testid="heading-bot-api">
          Bot-Optimized DEX API - Dual Execution Models
        </h1>
        <p className="text-muted-foreground text-lg mb-2" data-testid="text-subtitle">
          Build trading bots with real execution, real quotes, and real trending intel. Choose your execution model.
        </p>
        <p className="text-sm text-muted-foreground" data-testid="text-keywords">
          No simulation. No fake pricing. No paywall. Server-executed (CDP) OR client-executed (MetaMask) swaps across 6 chains.
        </p>
      </div>

      <Alert className="mb-6" data-testid="alert-execution-model">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Dual Execution Models:</strong> We offer BOTH server-executed swaps (Coinbase CDP - no wallet needed) 
          AND client-executed swaps (1inch - returns transaction calldata for MetaMask/wallet signing). 
          Choose the model that fits your use case.
        </AlertDescription>
      </Alert>

      <Alert className="mb-6" data-testid="alert-data-integrity">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Data Integrity Policy:</strong> All data from this API comes from live sources: Coinbase CDP, CoinGecko, and DEXScreener. 
          We do not fabricate, simulate, or mock on-chain data, pairs, or prices. If an endpoint returns it, it came from a real integration.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Quick Start */}
        <Card data-testid="card-quick-start">
          <CardHeader>
            <CardTitle>⚡ 60-Second Setup</CardTitle>
            <CardDescription>
              No signup, no API keys, no wallet connection. Anonymous access with rate limiting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="python" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                <TabsTrigger value="typescript">TypeScript</TabsTrigger>
              </TabsList>
              
              <TabsContent value="python" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Complete Bot Example</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-python-complete">{PYTHON_EXAMPLE}</pre>
                </div>
              </TabsContent>

              <TabsContent value="nodejs" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Complete Bot Example (Node.js)</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-nodejs-complete">
{`const axios = require('axios');

async function tradingBot() {
  // Check available pairs
  const pairsRes = await axios.get('https://coinrailz.com/api/bot/pairs?chain=base');
  console.log('Available pairs:', pairsRes.data.pairs);

  // Get current ETH price
  const priceRes = await axios.get('https://coinrailz.com/api/bot/price?token=ETH');
  console.log('ETH price: $', priceRes.data.price);

  // Get quote
  const quoteRes = await axios.get('https://coinrailz.com/api/bot/dex/quote', {
    params: { from: 'ETH', to: 'USDC', amount: '1.0', chain: 'base' }
  });
  console.log('Rate:', quoteRes.data.exchangeRate, 'USDC per ETH');
  console.log('Platform fee:', quoteRes.data.platformFee);

  // Execute swap (CDP handles gas)
  const swapRes = await axios.post('https://coinrailz.com/api/bot/dex/swap', {
    from: 'ETH',
    to: 'USDC',
    amount: '1.0',
    walletAddress: '0xYourWallet',
    chain: 'base'
  });
  console.log('Tx hash:', swapRes.data.transactionHash);
}

tradingBot().catch(console.error);`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="typescript" className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Complete Bot Example (TypeScript)</h3>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-typescript-complete">
{`import axios from 'axios';

interface QuoteResponse {
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  estimatedGas: string;
  platformFee: string;
}

interface SwapResponse {
  success: boolean;
  transactionHash: string;
  fromToken: string;
  toToken: string;
  toAmount: string;
}

interface PriceResponse {
  success: boolean;
  token: string;
  price: number;
  change24h: number;
}

async function tradingBot(): Promise<void> {
  // Check available pairs
  const { data: pairsData } = await axios.get('https://coinrailz.com/api/bot/pairs?chain=base');
  console.log('Available pairs:', pairsData.pairs);

  // Get current ETH price
  const { data: priceData } = await axios.get<PriceResponse>('https://coinrailz.com/api/bot/price?token=ETH');
  console.log(\`ETH price: $\${priceData.price}\`);

  // Get quote with type safety
  const { data: quote } = await axios.get<QuoteResponse>(
    'https://coinrailz.com/api/bot/dex/quote',
    { params: { from: 'ETH', to: 'USDC', amount: '1.0', chain: 'base' } }
  );
  console.log(\`Rate: \${quote.exchangeRate} USDC per ETH\`);
  console.log(\`Platform fee: \${quote.platformFee}\`);

  // Execute swap (CDP handles gas)
  const { data: swap } = await axios.post<SwapResponse>(
    'https://coinrailz.com/api/bot/dex/swap',
    { from: 'ETH', to: 'USDC', amount: '1.0', walletAddress: '0xYourWallet', chain: 'base' }
  );
  console.log(\`Tx hash: \${swap.transactionHash}\`);
}

tradingBot().catch(console.error);`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card data-testid="card-api-endpoints">
          <CardHeader>
            <CardTitle>🔌 API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="quote">
              <div className="space-y-2">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="quote" data-testid="tab-quote">Quote</TabsTrigger>
                  <TabsTrigger value="swap" data-testid="tab-swap">Swap (CDP)</TabsTrigger>
                  <TabsTrigger value="prepare" data-testid="tab-prepare">Prepare (MetaMask)</TabsTrigger>
                </TabsList>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="intel" data-testid="tab-intel">Intel</TabsTrigger>
                  <TabsTrigger value="pairs" data-testid="tab-pairs">Pairs</TabsTrigger>
                  <TabsTrigger value="gas" data-testid="tab-gas">Gas</TabsTrigger>
                </TabsList>
                <TabsList className="grid w-full grid-cols-1">
                  <TabsTrigger value="price" data-testid="tab-price">Price</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="quote" className="space-y-4" data-testid="content-quote">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/dex/quote</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get trading quote with platform fees included
                  </p>
                  
                  <h4 className="font-semibold mb-2">Parameters</h4>
                  <table className="w-full text-sm" data-testid="table-quote-params">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-2"><code>from</code></td>
                        <td className="p-2">string</td>
                        <td className="p-2">Token symbol (ETH, USDC, SOL)</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>to</code></td>
                        <td className="p-2">string</td>
                        <td className="p-2">Token symbol</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>amount</code></td>
                        <td className="p-2">string</td>
                        <td className="p-2">Amount in human-readable format (e.g., "1.5")</td>
                      </tr>
                      <tr>
                        <td className="p-2"><code>chain</code></td>
                        <td className="p-2">string</td>
                        <td className="p-2">ethereum, base, polygon, arbitrum, optimism, bsc</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-quote-response">
{`{
  "fromToken": "ETH",
  "toToken": "USDC",
  "fromAmount": "1.0",
  "toAmount": "3245.67",
  "exchangeRate": "3245.67",
  "estimatedGas": "0.002 ETH",
  "platformFee": "0.75%",
  "chain": "base",
  "protocol": "Coinbase CDP",
  "executionType": "server-executed",
  "timestamp": 1732398456789
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="swap" className="space-y-4" data-testid="content-swap">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">POST</Badge>
                    <code className="text-sm">/api/bot/dex/swap</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Execute swap transaction via Coinbase CDP
                  </p>
                  
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-swap-request">
{`{
  "from": "ETH",
  "to": "USDC",
  "amount": "1.0",
  "walletAddress": "0xYourWallet",
  "chain": "base",
  "slippage": 2.0
}`}
                  </pre>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-swap-response">
{`{
  "success": true,
  "transactionHash": "0xabc123...",
  "fromToken": "ETH",
  "toToken": "USDC",
  "toAmount": "3245.67",
  "platformFee": "24.34",
  "networkFee": "0.002",
  "status": "confirmed",
  "executionType": "server-executed"
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="prepare" className="space-y-4" data-testid="content-prepare">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">POST</Badge>
                    <code className="text-sm">/api/bot/dex/prepare</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Prepare client-executed swap transaction for MetaMask/wallet signing (non-custodial)
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg mb-4" data-testid="alert-prepare-differentiator">
                    <p className="text-sm">
                      <strong>Client-Executed Model:</strong> Returns unsigned transaction calldata from 1inch API. 
                      You sign with your own wallet (MetaMask, WalletConnect, etc). Full gas control, non-custodial trading.
                    </p>
                  </div>
                  
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-prepare-request">
{`{
  "from": "ETH",
  "to": "USDC",
  "amount": "1.0",
  "userAddress": "0xYourWallet",
  "chain": "ethereum",
  "slippage": 2.0
}`}
                  </pre>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-prepare-response">
{`{
  "success": true,
  "executionType": "client-executed",
  "transaction": {
    "to": "0x1111111254fb6c44bAC0beD2854e76F90643097d",
    "data": "0xabc123...",
    "value": "0x0de0b6b3a7640000",
    "gas": "0x30d40",
    "gasPrice": "0x5d21dba00",
    "chainId": 1
  },
  "fromToken": "ETH",
  "toToken": "USDC",
  "fromAmount": "1.0",
  "feeInfo": {
    "platformWallet": "0xPlatformWallet",
    "platformFee": "2.43",
    "platformFeeUSD": "2.43",
    "feeIncludedInOutput": true
  },
  "instructions": [
    "Send exactly: 1.0 ETH",
    "You receive: 3221.24 USDC",
    "Platform fee: 2.43 USDC ($2.43)",
    "Fee automatically deducted from your output"
  ],
  "source": "1inch API"
}`}
                  </pre>

                  <h4 className="font-semibold mt-4 mb-2">Example: Sign with ethers.js</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-prepare-example">
{`const response = await fetch('/api/bot/dex/prepare', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: 'ETH',
    to: 'USDC',
    amount: '1.0',
    userAddress: await signer.getAddress(),
    chain: 'ethereum'
  })
});

const { transaction } = await response.json();

// Sign and broadcast with your wallet
const tx = await signer.sendTransaction(transaction);
await tx.wait();
console.log('Swap complete:', tx.hash);`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="intel" className="space-y-4" data-testid="content-intel">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/intel</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>🚀 UNIQUE TO COIN RAILZ</strong> - Real-time trending tokens from CoinGecko API
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg mb-4" data-testid="alert-intel-differentiator">
                    <p className="text-sm">
                      <strong>Why this matters:</strong> Other DEX aggregators only provide quotes. 
                      We give you live trending tokens and price data from CoinGecko to spot opportunities early.
                    </p>
                  </div>

                  <h4 className="font-semibold mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-intel-response">
{`{
  "success": true,
  "intelligence": {
    "trending": {
      "tokens": [
        {
          "symbol": "PEPE",
          "name": "Pepe",
          "priceChange24h": "+12.5%",
          "marketCapRank": 45,
          "sentiment": "bullish"
        }
      ],
      "source": "CoinGecko API",
      "lastUpdate": "2025-11-23T00:40:00.000Z"
    },
    "highVolumePairs": [
      {
        "pair": "ETH/USDC",
        "price": 3245.67,
        "chain": "ethereum",
        "lastUpdate": "2025-11-23T00:40:00.000Z"
      }
    ]
  }
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="pairs" className="space-y-4" data-testid="content-pairs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/pairs</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get list of available trading pairs by chain
                  </p>

                  <h4 className="font-semibold mb-2">Parameters</h4>
                  <table className="w-full text-sm" data-testid="table-pairs-params">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2"><code>chain</code></td>
                        <td className="p-2">string (optional)</td>
                        <td className="p-2">Filter by chain (all chains if omitted)</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-pairs-response">
{`{
  "success": true,
  "pairs": ["ETH/USDC", "ETH/USDT", "USDC/USDT"],
  "totalPairs": 3,
  "note": "All pairs executable via Coinbase CDP",
  "timestamp": 1732398456789
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="price" className="space-y-4" data-testid="content-price">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/price</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get current price for a token (CoinGecko data, 60s cache)
                  </p>

                  <h4 className="font-semibold mb-2">Parameters</h4>
                  <table className="w-full text-sm" data-testid="table-price-params">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2"><code>token</code></td>
                        <td className="p-2">string (required)</td>
                        <td className="p-2">Token symbol (ETH, BTC, SOL, BNB, MATIC, USDC)</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-price-response">
{`{
  "success": true,
  "token": "ETH",
  "price": 3245.67,
  "change24h": 2.5,
  "lastUpdate": "2025-11-23T00:40:00.000Z",
  "source": "CoinGecko API",
  "timestamp": 1732398456789
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="gas" className="space-y-4" data-testid="content-gas">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/gas</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Real-time gas prices for client-executed swaps (only relevant for /dex/prepare endpoint)
                  </p>

                  <div className="bg-primary/10 p-4 rounded-lg mb-4" data-testid="alert-gas-context">
                    <p className="text-sm">
                      <strong>Usage Context:</strong> This endpoint is only useful for client-executed swaps (/dex/prepare) 
                      where you control gas. Server-executed swaps (/dex/swap) have gas included in the platform fee.
                    </p>
                  </div>

                  <h4 className="font-semibold mb-2">Parameters</h4>
                  <table className="w-full text-sm" data-testid="table-gas-params">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2"><code>chain</code></td>
                        <td className="p-2">string (optional)</td>
                        <td className="p-2">ethereum, base, polygon, arbitrum, optimism, bsc (default: ethereum)</td>
                      </tr>
                    </tbody>
                  </table>

                  <h4 className="font-semibold mt-4 mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-gas-response">
{`{
  "success": true,
  "chain": "ethereum",
  "chainId": 1,
  "gasPrices": {
    "slow": {
      "gwei": 15,
      "estimatedTime": "5-10 minutes",
      "savingsVsStandard": "40%"
    },
    "standard": {
      "gwei": 25,
      "estimatedTime": "2-5 minutes",
      "recommended": true
    },
    "fast": {
      "gwei": 35,
      "estimatedTime": "30-60 seconds",
      "premiumVsStandard": "40%"
    },
    "instant": {
      "gwei": 50,
      "estimatedTime": "15-30 seconds",
      "premiumVsStandard": "100%"
    }
  },
  "networkCongestion": "moderate",
  "usageContext": "Only applies to client-executed swaps (/dex/prepare). Server-executed swaps (/dex/swap) have gas included in platform fee.",
  "timestamp": 1732398456789
}`}
                  </pre>

                  <h4 className="font-semibold mt-4 mb-2">Example: Set Custom Gas Price</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-gas-example">
{`// Get current gas prices
const { gasPrices } = await fetch('/api/bot/gas?chain=ethereum').then(r => r.json());

// Prepare transaction with custom gas
const { transaction } = await fetch('/api/bot/dex/prepare', {
  method: 'POST',
  body: JSON.stringify({ from: 'ETH', to: 'USDC', amount: '1.0', userAddress: '0x...' })
}).then(r => r.json());

// Override gas price with "fast" tier
transaction.gasPrice = ethers.utils.parseUnits(gasPrices.fast.gwei.toString(), 'gwei');

// Sign and send with custom gas
const tx = await signer.sendTransaction(transaction);`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* x402 Micropayment Services */}
        <Card data-testid="card-x402-services">
          <CardHeader>
            <CardTitle>💰 x402 Micropayment Services (AI Agents)</CardTitle>
            <CardDescription>
              Pay-per-call blockchain microservices for AI agents. First call is free for discovery services.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert data-testid="alert-x402-info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>x402 Protocol:</strong> HTTP 402 Payment Required responses with USDC payment details.
                First call to discovery services (gas-price-oracle, token-metadata) is free for new agents.
              </AlertDescription>
            </Alert>

            <div>
              <h3 className="font-semibold mb-2">Python: First-Call-Free Example</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-x402-python">
{`import httpx

# First call is FREE (no payment required)
response = httpx.post(
    "https://coinrailz.com/x402/gas-price-oracle",
    json={"chains": ["ethereum", "base"]}
)

if response.status_code == 200:
    data = response.json()
    print("Gas prices:", data)
elif response.status_code == 402:
    # Payment required for subsequent calls
    payment_info = response.json()
    print("Payment required:", payment_info["x402"]["price"])`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Python: Token Metadata Service</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-x402-token-metadata">
{`import httpx

# Get token metadata (first call free)
response = httpx.post(
    "https://coinrailz.com/x402/token-metadata",
    json={
        "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "chain": "ethereum"
    }
)

if response.status_code == 200:
    token = response.json()
    print(f"Token: {token['name']} ({token['symbol']})")
    print(f"Decimals: {token['decimals']}")`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Service Catalog</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-x402-catalog">
{`import httpx

# Get full catalog of 78 paid services
catalog = httpx.get("https://coinrailz.com/x402/catalog").json()

for service in catalog["services"]:
    print(f"{service['id']}: \${service['price']} USDC")`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Python: Agent Wallet Creation ($1.00 USDC)</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Create a Coinbase CDP wallet for your AI agent. Paid service - requires x402 payment.
              </p>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-x402-wallet">
{`import httpx

# Step 1: Request wallet (will return 402 with payment details)
response = httpx.post(
    "https://coinrailz.com/x402/instant-agent-wallet",
    json={"agentId": "my-trading-bot", "description": "Production trading wallet"}
)

if response.status_code == 402:
    # Get payment details from 402 response
    payment = response.json()
    pay_to = payment["accepts"][0]["payTo"]
    amount = payment["accepts"][0]["maxAmountRequired"]  # 1000000 = $1.00 USDC
    print(f"Send {int(amount)/1e6} USDC to {pay_to} on Base")
    
    # Step 2: After sending USDC, retry with payment proof
    # response = httpx.post(
    #     "https://coinrailz.com/x402/instant-agent-wallet",
    #     json={"agentId": "my-trading-bot"},
    #     headers={"X-PAYMENT": "0xYourTransactionHash"}
    # )

elif response.status_code == 200:
    wallet = response.json()
    print(f"Wallet created: {wallet['walletAddress']}")
    print(f"Network: {wallet['network']}")  # base-mainnet
    print(f"Capabilities: {wallet['capabilities']}")`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card data-testid="card-features">
          <CardHeader>
            <CardTitle>✨ Why Use Coin Railz Bot API?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div data-testid="feature-execution">
                <h3 className="font-semibold mb-2">🔐 Server-Executed</h3>
                <p className="text-sm text-muted-foreground">
                  We execute swaps via Coinbase CDP. No wallet setup, no gas management, just results.
                </p>
              </div>
              <div data-testid="feature-intelligence">
                <h3 className="font-semibold mb-2">📊 Intelligence Feed</h3>
                <p className="text-sm text-muted-foreground">
                  Real-time trending tokens from CoinGecko API - spot opportunities before they moon.
                </p>
              </div>
              <div data-testid="feature-multichain">
                <h3 className="font-semibold mb-2">⚡ Multi-Chain</h3>
                <p className="text-sm text-muted-foreground">
                  Ethereum, Base, Polygon, Arbitrum, Optimism, BSC - all in one API.
                </p>
              </div>
              <div data-testid="feature-nosignup">
                <h3 className="font-semibold mb-2">🔓 No Signup</h3>
                <p className="text-sm text-muted-foreground">
                  Anonymous access with rate limiting. Start trading immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Sources */}
        <Card data-testid="card-data-sources">
          <CardHeader>
            <CardTitle>📡 Real Data Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li data-testid="source-coingecko">✅ <strong>CoinGecko API</strong> - Trending tokens, prices, market data</li>
              <li data-testid="source-coinbase">✅ <strong>Coinbase CDP</strong> - Multi-chain swap execution</li>
              <li data-testid="source-alchemy">✅ <strong>Alchemy RPC</strong> - Blockchain data and gas estimates</li>
            </ul>
          </CardContent>
        </Card>

        {/* Supported Chains */}
        <Card data-testid="card-supported-chains">
          <CardHeader>
            <CardTitle>🌐 Supported Chains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" data-testid="chain-ethereum">Ethereum</Badge>
              <Badge variant="secondary" data-testid="chain-base">Base</Badge>
              <Badge variant="secondary" data-testid="chain-polygon">Polygon</Badge>
              <Badge variant="secondary" data-testid="chain-arbitrum">Arbitrum</Badge>
              <Badge variant="secondary" data-testid="chain-optimism">Optimism</Badge>
              <Badge variant="secondary" data-testid="chain-bsc">BSC</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Health Check */}
        <Card data-testid="card-health-check">
          <CardHeader>
            <CardTitle>🏥 Health Check</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm" data-testid="code-health-check">
              <code>GET https://coinrailz.com/api/bot/health</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
