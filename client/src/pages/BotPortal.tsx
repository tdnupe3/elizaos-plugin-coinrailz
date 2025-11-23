import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BotPortal() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Trading Bot API</h1>
        <p className="text-muted-foreground text-lg">
          Drop-in replacement for 1inch, 0x, and Matcha with added intelligence feeds
        </p>
      </div>

      <div className="grid gap-6">
        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle>⚡ 60-Second Setup</CardTitle>
            <CardDescription>
              No signup required. Anonymous access. Industry-standard format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Get a Quote (Python)</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`import requests

url = "https://coinrailz.com/api/bot/dex/quote"
params = {
    "from": "ETH",
    "to": "USDC",
    "amount": "1.0",
    "chain": "base"
}

response = requests.get(url, params=params)
quote = response.json()
print(f"Best price: {quote['bestPrice']}")`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Execute Swap (JavaScript)</h3>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const response = await fetch("https://coinrailz.com/api/bot/dex/swap", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    from: "ETH",
    to: "USDC",
    amount: "1.0",
    walletAddress: "0xYourWallet",
    chain: "base"
  })
});

const swap = await response.json();
console.log(\`Tx: \${swap.transactionHash}\`);`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card>
          <CardHeader>
            <CardTitle>🔌 API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="quote">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="quote">Quote</TabsTrigger>
                <TabsTrigger value="swap">Swap</TabsTrigger>
                <TabsTrigger value="intel">Intel Feed</TabsTrigger>
              </TabsList>

              <TabsContent value="quote" className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/dex/quote</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Get trading quote with platform fees included
                  </p>
                  
                  <h4 className="font-semibold mb-2">Parameters</h4>
                  <table className="w-full text-sm">
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
                        <td className="p-2">Token symbol (ETH, USDC) or contract address</td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-2"><code>to</code></td>
                        <td className="p-2">string</td>
                        <td className="p-2">Token symbol or contract address</td>
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
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "fromToken": "ETH",
  "toToken": "USDC",
  "fromAmount": "1.0",
  "toAmount": "3245.67",
  "bestPrice": "3245.67",
  "estimatedGas": "0.002",
  "platformFee": "0.0075",
  "chain": "base",
  "timestamp": 1732398456789
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="swap" className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">POST</Badge>
                    <code className="text-sm">/api/bot/dex/swap</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Execute swap transaction
                  </p>
                  
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
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
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "success": true,
  "transactionHash": "0xabc123...",
  "fromToken": "ETH",
  "toToken": "USDC",
  "toAmount": "3245.67",
  "platformFee": "24.34",
  "networkFee": "0.002",
  "status": "confirmed"
}`}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="intel" className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">GET</Badge>
                    <code className="text-sm">/api/bot/intel</code>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    <strong>🚀 UNIQUE TO COIN RAILZ</strong> - Real-time market intelligence feed
                  </p>
                  
                  <div className="bg-primary/10 p-4 rounded-lg mb-4">
                    <p className="text-sm">
                      <strong>Why this matters:</strong> Other DEX aggregators only provide quotes. 
                      We give you trending tokens, whale alerts, and sentiment analysis to gain edge on market movements.
                    </p>
                  </div>

                  <h4 className="font-semibold mb-2">Response</h4>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "success": true,
  "intelligence": {
    "trending": {
      "tokens": [
        {
          "symbol": "PEPE",
          "priceChange24h": "+12.5%",
          "volume24h": "$45.2M",
          "sentiment": "bullish"
        }
      ]
    },
    "whaleAlerts": [
      {
        "token": "ETH",
        "amount": "1,250 ETH",
        "valueUSD": "$4.2M",
        "type": "transfer"
      }
    ],
    "highVolumePairs": [
      {
        "pair": "ETH/USDC",
        "volume24h": "$125.3M",
        "priceChange": "+2.1%"
      }
    ]
  }
}`}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>✨ Why Use Coin Railz Bot API?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">🔌 Drop-In Compatible</h3>
                <p className="text-sm text-muted-foreground">
                  Matches 1inch/0x/Matcha response format. Works with your existing bot code.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">📊 Intelligence Feed</h3>
                <p className="text-sm text-muted-foreground">
                  Trending tokens, whale alerts, sentiment analysis - features no other aggregator has.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">⚡ Multi-Chain</h3>
                <p className="text-sm text-muted-foreground">
                  Ethereum, Base, Polygon, Arbitrum, Optimism, BSC - all in one API.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">🔓 No Signup</h3>
                <p className="text-sm text-muted-foreground">
                  Anonymous access. No API keys. Start trading immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supported Chains */}
        <Card>
          <CardHeader>
            <CardTitle>🌐 Supported Chains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Ethereum</Badge>
              <Badge variant="secondary">Base</Badge>
              <Badge variant="secondary">Polygon</Badge>
              <Badge variant="secondary">Arbitrum</Badge>
              <Badge variant="secondary">Optimism</Badge>
              <Badge variant="secondary">BSC</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Health Check */}
        <Card>
          <CardHeader>
            <CardTitle>🏥 Health Check</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>GET https://coinrailz.com/api/bot/health</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
