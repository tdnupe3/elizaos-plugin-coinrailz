import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Copy,
  CheckCircle,
  Terminal,
  Code,
  Zap,
  ArrowRight,
  ExternalLink,
  Rocket,
  DollarSign,
  Wallet,
  Bot
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function QuickstartPage() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Quickstart - Coin Railz SDK Integration";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Get started with Coin Railz SDK in under 5 minutes. Install via npm or pip, authenticate with API key or x402, and start calling crypto microservices.');
    }
    
    const schema = {
      "@context": "https://schema.org/",
      "@type": "HowTo",
      "name": "Coin Railz SDK Quickstart",
      "description": "Install and integrate Coin Railz SDK for AI agents and crypto microservices",
      "step": [
        {
          "@type": "HowToStep",
          "name": "Install SDK",
          "text": "Run npm install @coinrailz/agent-payments or pip install coinrailz"
        },
        {
          "@type": "HowToStep",
          "name": "Configure Authentication",
          "text": "Get an API key from /api-keys page or use x402 USDC payments"
        },
        {
          "@type": "HowToStep",
          "name": "Make Your First Call",
          "text": "Send a payment with client.send() or create a wallet with client.createWallet()"
        }
      ]
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

  const npmInstall = 'npm install @coinrailz/agent-payments';
  const pipInstall = 'pip install coinrailz';
  
  const jsExample = `import { CoinRailz } from '@coinrailz/agent-payments';

// Initialize with your API key (get one at /api-keys)
const client = new CoinRailz({
  apiKey: process.env.COINRAILZ_API_KEY
});

// Send a payment (1.5% + $0.01 fee)
const result = await client.send({
  to: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  amount: 100,
  memo: 'Service payment'
});

console.log('Payment sent:', result.transactionId);
console.log('Fee:', result.fee);`;

  const walletExample = `import { CoinRailz } from '@coinrailz/agent-payments';

const client = new CoinRailz({
  apiKey: process.env.COINRAILZ_API_KEY
});

// Create a new USDC wallet on Base for your AI agent ($1.00)
const wallet = await client.createWallet();

if (wallet.success) {
  console.log('Wallet Address:', wallet.data.address);
  console.log('Chain:', wallet.data.chain); // 'base'
  // Store wallet.data.walletId securely for future operations
}`;

  const tradingBotExample = `import { CoinRailz } from '@coinrailz/agent-payments';

const client = new CoinRailz({
  apiKey: process.env.COINRAILZ_API_KEY
});

async function runTradingBot() {
  // 1. Check gas before trading
  const gas = await client.gasPriceOracle({ chain: 'base' });
  if (gas.data.gasPrice > 50) {
    console.log('Gas too high, waiting...');
    return;
  }

  // 2. Get AI trading signal
  const signal = await client.tradeSignals({ token: 'ETH' });
  console.log('Signal:', signal.data?.signal); // 'buy', 'sell', or 'hold'
  console.log('Confidence:', signal.data?.confidence);

  // 3. Check whale activity
  const whales = await client.whaleAlerts({ chain: 'ethereum' });
  console.log('Recent whale moves:', whales.data?.alerts?.length);

  // 4. Execute based on signals...
}

runTradingBot();`;

  const pythonExample = `# Claude Desktop configuration (claude_desktop_config.json)
{
  "mcpServers": {
    "coinrailz": {
      "command": "coinrailz-mcp",
      "env": {
        "COINRAILZ_API_KEY": "your-api-key"
      }
    }
  }
}

# Now ask Claude: "Get gas prices on Base chain"
# Claude will use Coin Railz MCP to fetch real data`;

  const curlExample = `# x402 Payment Flow (autonomous agents)
# Step 1: Request any paid endpoint - receive 402 challenge
curl -X GET https://coinrailz.com/x402/ping

# Response: HTTP 402 Payment Required
# {
#   "error": "X-PAYMENT header is required",
#   "accepts": [{
#     "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
#     "payTo": "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
#     "network": "base",
#     "maxAmountRequired": "250000"
#   }],
#   "x402Version": 2,
#   "facilitatorUrl": "https://x402.org/facilitator"
# }

# Step 2: Sign EIP-3009 authorization + retry with X-PAYMENT header
curl -X GET https://coinrailz.com/x402/ping \\
  -H "X-PAYMENT: <base64-encoded-payment-proof>"`;

  const solanaActionsExample = `# Solana Actions (Dialect Blinks)
# Step 1: Get available actions
curl -X GET https://coinrailz.com/.well-known/solana-actions.json

# Step 2: Get action metadata
curl -X GET https://coinrailz.com/solana-pay/intents

# Step 3: Create payment intent
curl -X POST https://coinrailz.com/solana-pay/intents \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "1.00",
    "tokenSymbol": "USDC",
    "serviceName": "instant-solana-wallet"
  }'

# Response includes transaction to sign with your Solana wallet`;

  const x402FullFlowExample = `// Full x402 integration (Node.js)
const response = await fetch('https://coinrailz.com/x402/ping');

if (response.status === 402) {
  const challenge = await response.json();
  
  // Use x402 SDK or manual EIP-3009 signing
  const payment = await signX402Payment({
    payTo: challenge.accepts[0].payTo,
    amount: challenge.accepts[0].maxAmountRequired,
    network: 'base'
  });
  
  // Retry with payment proof
  const result = await fetch('https://coinrailz.com/x402/ping', {
    headers: { 'X-PAYMENT': btoa(JSON.stringify(payment)) }
  });
  
  console.log(await result.json()); // Service data!
}`;

  const freeServices = [
    { name: 'gas-price-oracle', description: 'Real-time gas prices across chains', price: 'FREE' },
    { name: 'token-metadata', description: 'Token info and contract details', price: 'FREE' },
    { name: 'ping', description: 'Health check and connectivity test', price: 'FREE' },
  ];

  const paidServices = [
    { name: 'multi-chain-balance', description: 'Wallet balances across 5 chains', price: '$0.10' },
    { name: 'trade-signals', description: 'AI-powered trading signals', price: '$1.00' },
    { name: 'whale-alerts', description: 'Large wallet movement tracking', price: '$1.00' },
    { name: 'prediction-market-odds', description: 'Live prediction market data', price: '$0.50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20" data-testid="badge-quickstart">
            <Rocket className="w-3 h-3 mr-1" />
            5 Minute Setup
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Quickstart Guide
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Get AI agent crypto microservices running in under 5 minutes. 
            Install, authenticate, and start making API calls.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card className="bg-slate-800/50 border-slate-700" data-testid="card-step-install">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
                <Terminal className="w-5 h-5 text-blue-400" />
              </div>
              <CardTitle className="text-white text-lg">1. Install</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm">NPM or pip install in one command</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700" data-testid="card-step-configure">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">
                <Code className="w-5 h-5 text-purple-400" />
              </div>
              <CardTitle className="text-white text-lg">2. Configure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm">API key or x402 USDC payments</p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700" data-testid="card-step-call">
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                <Zap className="w-5 h-5 text-emerald-400" />
              </div>
              <CardTitle className="text-white text-lg">3. Call APIs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm">78 services ready</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Step 1: Install the SDK
            </CardTitle>
            <CardDescription>Choose your preferred package manager</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="npm" className="w-full">
              <TabsList className="bg-slate-700/50 mb-4">
                <TabsTrigger value="npm" data-testid="tab-npm">JavaScript/TypeScript</TabsTrigger>
                <TabsTrigger value="pip" data-testid="tab-pip">Python (MCP)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="npm">
                <div className="relative">
                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                    <code className="text-emerald-400" data-testid="code-npm-install">{npmInstall}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(npmInstall, 'npm install')}
                    data-testid="button-copy-npm"
                  >
                    {copiedCode === 'npm install' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-slate-500 text-sm mt-2">
                  Requires Node.js 18+. Includes TypeScript types.
                </p>
              </TabsContent>
              
              <TabsContent value="pip">
                <div className="relative">
                  <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                    <code className="text-emerald-400" data-testid="code-pip-install">{pipInstall}</code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(pipInstall, 'pip install')}
                    data-testid="button-copy-pip"
                  >
                    {copiedCode === 'pip install' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-slate-500 text-sm mt-2">
                  For Claude Desktop integration. Requires Python 3.10+.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="w-5 h-5" />
              Step 2: Choose Authentication Method
            </CardTitle>
            <CardDescription>Prepaid credits (API key) or pay-per-call (x402 USDC)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold text-white">Prepaid Credits</span>
                  <Badge variant="secondary" className="text-xs">Recommended</Badge>
                </div>
                <p className="text-slate-400 text-sm mb-3">
                  Buy credits with card/crypto, get an API key, use instantly.
                </p>
                <Link href="/credits" data-testid="link-credits">
                  <Button size="sm" variant="outline" className="w-full" data-testid="button-get-api-key">
                    Get API Key <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
              
              <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-white">x402 USDC</span>
                  <Badge variant="secondary" className="text-xs">For AI Agents</Badge>
                </div>
                <p className="text-slate-400 text-sm mb-3">
                  Pay per call with USDC on Ethereum or Base. No account needed.
                </p>
                <Link href="/x402" data-testid="link-x402">
                  <Button size="sm" variant="outline" className="w-full" data-testid="button-learn-x402">
                    Learn x402 <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Step 3: Make Your First Call
            </CardTitle>
            <CardDescription>Start with free services to test your setup</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="javascript" className="w-full">
              <TabsList className="bg-slate-700/50 mb-4 flex-wrap">
                <TabsTrigger value="javascript" data-testid="tab-js">JavaScript</TabsTrigger>
                <TabsTrigger value="python" data-testid="tab-python">Python (MCP)</TabsTrigger>
                <TabsTrigger value="curl" data-testid="tab-curl">x402 (EVM)</TabsTrigger>
                <TabsTrigger value="solana" data-testid="tab-solana">Solana Actions</TabsTrigger>
              </TabsList>
              
              <TabsContent value="javascript">
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-js-example">{jsExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(jsExample, 'JavaScript example')}
                    data-testid="button-copy-js"
                  >
                    {copiedCode === 'JavaScript example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="python">
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-python-example">{pythonExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(pythonExample, 'Python example')}
                    data-testid="button-copy-python"
                  >
                    {copiedCode === 'Python example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="curl">
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-curl-example">{curlExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(curlExample, 'cURL example')}
                    data-testid="button-copy-curl"
                  >
                    {copiedCode === 'cURL example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-slate-500 text-sm mt-2">
                  x402 uses USDC on Ethereum or Base. Payment verification via CDP facilitator.
                </p>
              </TabsContent>
              
              <TabsContent value="solana">
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-solana-example">{solanaActionsExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(solanaActionsExample, 'Solana Actions example')}
                    data-testid="button-copy-solana"
                  >
                    {copiedCode === 'Solana Actions example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-slate-500 text-sm mt-2">
                  Solana Actions support SOL, USDC, and USDT. Compatible with Dialect Blinks.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Runnable Examples
            </CardTitle>
            <CardDescription>Copy-paste code for common use cases</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="wallet" className="w-full">
              <TabsList className="bg-slate-700/50 mb-4">
                <TabsTrigger value="wallet" data-testid="tab-wallet">
                  <Wallet className="w-3 h-3 mr-1" />
                  Create Wallet
                </TabsTrigger>
                <TabsTrigger value="trading-bot" data-testid="tab-trading-bot">
                  <Bot className="w-3 h-3 mr-1" />
                  Trading Bot
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="wallet">
                <div className="mb-3">
                  <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                    Most Valuable Service
                  </Badge>
                  <p className="text-slate-400 text-sm mt-2">
                    Create a USDC wallet on Base for your AI agent. Costs $0.50 per wallet.
                  </p>
                </div>
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-wallet-example">{walletExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(walletExample, 'Wallet example')}
                    data-testid="button-copy-wallet"
                  >
                    {copiedCode === 'Wallet example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="trading-bot">
                <div className="mb-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    Complete Bot Example
                  </Badge>
                  <p className="text-slate-400 text-sm mt-2">
                    A trading bot that checks gas, gets signals, and monitors whale activity.
                  </p>
                </div>
                <div className="relative">
                  <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <code className="text-slate-300" data-testid="code-trading-bot-example">{tradingBotExample}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(tradingBotExample, 'Trading bot example')}
                    data-testid="button-copy-trading-bot"
                  >
                    {copiedCode === 'Trading bot example' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-emerald-900/20 border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Free Services (Test First)
              </CardTitle>
              <CardDescription className="text-emerald-300/70">
                No payment required - perfect for testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {freeServices.map((service) => (
                  <div key={service.name} className="flex items-center justify-between" data-testid={`service-free-${service.name}`}>
                    <div>
                      <span className="text-white font-mono text-sm">{service.name}</span>
                      <p className="text-slate-400 text-xs">{service.description}</p>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {service.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-900/20 border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-400 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Popular Paid Services
              </CardTitle>
              <CardDescription className="text-blue-300/70">
                Premium data and trading intelligence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paidServices.map((service) => (
                  <div key={service.name} className="flex items-center justify-between" data-testid={`service-paid-${service.name}`}>
                    <div>
                      <span className="text-white font-mono text-sm">{service.name}</span>
                      <p className="text-slate-400 text-xs">{service.description}</p>
                    </div>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {service.price}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-slate-700 my-8" />

        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Ready to Explore More?
          </h3>
          <p className="text-slate-400 mb-6">
            Browse all 78 services or check out the full API documentation
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/developers" data-testid="link-developers">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-view-all-services">
                View All Services <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/credits" data-testid="link-buy-credits">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800" data-testid="button-buy-credits">
                Buy Credits <DollarSign className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="https://www.npmjs.com/package/coinrailz" target="_blank" rel="noopener noreferrer" data-testid="link-npm-external">
              <Button size="lg" variant="ghost" className="text-slate-400 hover:text-white" data-testid="button-npm-link">
                NPM Package <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>
            Need help? Check our{' '}
            <Link href="/docs" className="text-blue-400 hover:underline" data-testid="link-docs">documentation</Link>
            {' '}or{' '}
            <Link href="/contact-us" className="text-blue-400 hover:underline" data-testid="link-contact">contact support</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
