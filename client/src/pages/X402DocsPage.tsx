import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

export default function X402DocsPage() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Add JSON-LD schema for Google AI indexing
    const schema = {
      "@context": "https://schema.org/",
      "@type": "APIReference",
      "name": "x402 Microservices - Coin Railz",
      "description": "Production-ready x402 micropayment services for AI agents. 78 microservices including crypto analytics, trading signals, satellite/earth data, IoT sensor feeds, AI inference, prediction markets, balance checking, gas prices, token data, smart contract audits, and security analysis. Instant USDC payments on Base and Solana.",
      "url": "https://coinrailz.com/x402-docs",
      "applicationCategory": "WebAPI",
      "provider": {
        "@type": "Organization",
        "name": "Coin Railz",
        "url": "https://coinrailz.com"
      },
      "documentation": "https://coinrailz.com/x402-docs",
      "schemaVersion": "1.0"
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

  const services = [
    {
      name: "Multi-Chain Balance",
      price: "$0.01",
      url: "https://coinrailz.com/x402/service/multi-chain-balance",
      description: "Check wallet balances across multiple chains instantly",
      tier: "micro"
    },
    {
      name: "Gas Price Oracle",
      price: "$0.05",
      url: "https://coinrailz.com/x402/service/gas-price-oracle",
      description: "Real-time gas prices for all major chains",
      tier: "micro"
    },
    {
      name: "Token Price Feed",
      price: "$0.50",
      url: "https://coinrailz.com/x402/service/token-price",
      description: "Live cryptocurrency price data",
      tier: "micro"
    },
    {
      name: "Contract Scanner",
      price: "$2.00",
      url: "https://coinrailz.com/x402/service/contract-scan",
      description: "Quick smart contract analysis and verification",
      tier: "micro"
    },
    {
      name: "Wallet Risk Analysis",
      price: "$2.00",
      url: "https://coinrailz.com/x402/service/wallet-risk",
      description: "Security assessment for wallet addresses",
      tier: "micro"
    },
    {
      name: "Payment Processor",
      price: "$50",
      url: "https://coinrailz.com/x402/service/payment-processing",
      description: "Multi-chain payment processing for AI agents",
      tier: "enterprise"
    },
    {
      name: "Compliance Consultation",
      price: "$500",
      url: "https://coinrailz.com/x402/service/compliance-consultation",
      description: "AML/KYC compliance guidance and risk assessment",
      tier: "enterprise"
    },
    {
      name: "Smart Contract Audit",
      price: "$1000",
      url: "https://coinrailz.com/x402/service/smart-contract-audit",
      description: "Comprehensive security audit with vulnerability detection",
      tier: "enterprise"
    }
  ];

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">
            x402 Protocol
          </Badge>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Coin Railz x402 Services
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Production-ready x402 micropayment services for AI agents. Instant USDC payments on Base chain.
          </p>
        </div>

        {/* Quick Start */}
        <Card className="mb-8 border-2 border-blue-500">
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
            <CardDescription>Get started with x402 in 3 steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <p className="font-semibold">Make a request to any service URL</p>
                  <code className="block mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm overflow-x-auto">
                    curl https://coinrailz.com/x402/service/gas-price-oracle
                  </code>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <p className="font-semibold">Receive 402 response with payment details</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Response includes USDC amount, recipient wallet, and payment schema
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <p className="font-semibold">Send payment via x402 protocol</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Include payment proof in X-Payment header to access the service
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">Available Services</h2>
          
          {/* Micropayment Tier */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              💰 Micropayment Tier
              <Badge variant="outline">$0.01 - $2.00</Badge>
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.filter(s => s.tier === 'micro').map((service) => (
                <Card key={service.url} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <Badge variant="secondary">{service.price}</Badge>
                    </div>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => copyToClipboard(service.url)}
                      >
                        {copiedUrl === service.url ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy URL
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => window.open(service.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Enterprise Tier */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🏢 Enterprise Tier
              <Badge variant="outline">$50 - $1000</Badge>
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.filter(s => s.tier === 'enterprise').map((service) => (
                <Card key={service.url} className="hover:shadow-lg transition-shadow border-2 border-purple-200 dark:border-purple-800">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{service.name}</CardTitle>
                      <Badge className="bg-purple-600">{service.price}</Badge>
                    </div>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => copyToClipboard(service.url)}
                      >
                        {copiedUrl === service.url ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy URL
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => window.open(service.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-semibold">Network</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Base Chain (Mainnet)</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Accepted Currencies</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">USDC, ETH, USDT</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Platform Wallet</p>
                <code className="text-xs bg-gray-100 dark:bg-gray-800 p-1 rounded">
                  0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
                </code>
              </div>
              <div>
                <p className="text-sm font-semibold">Protocol</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">x402 (HTTP 402 Payment Required)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  No signup or account required
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Instant payment verification
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Listed on x402scan registry
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  AI agent optimized
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  Production-ready endpoints
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Example Code */}
        <Card>
          <CardHeader>
            <CardTitle>Example Usage</CardTitle>
            <CardDescription>Complete x402 payment flow example</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto text-sm">
{`# Step 1: Request service (no payment)
curl https://coinrailz.com/x402/service/gas-price-oracle

# Response: 402 Payment Required
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "50000",  // 0.05 USDC
      "asset": "USDC",
      "payTo": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
    },
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "16666666666667",  // ~0.05 USD in ETH
      "asset": "ETH",
      "payTo": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
    },
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "50000",  // 0.05 USDT
      "asset": "USDT",
      "payTo": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
    }
  ]
}

# Step 2: Send payment via x402 facilitator
# (Use Coinbase CDP or your preferred x402 payment method)

# Step 3: Request service with payment proof
curl https://coinrailz.com/x402/service/gas-price-oracle \\
  -H "X-Payment: <payment_proof>"

# Response: Service data
{
  "success": true,
  "result": { /* gas price data */ }
}`}
            </pre>
          </CardContent>
        </Card>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-2">
            <CardContent className="pt-6">
              <h3 className="text-xl font-bold mb-2">Ready to Get Started?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Pick a service above and start making x402 payments today
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Button onClick={() => window.open('https://x402scan.com', '_blank')}>
                  View on x402scan
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => window.open('https://coinbase.com/x402', '_blank')}>
                  Learn About x402
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
