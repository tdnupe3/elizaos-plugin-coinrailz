import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Copy,
  CheckCircle,
  ExternalLink,
  Zap,
  ArrowRight,
  Wallet,
  TrendingUp,
  AlertCircle,
  DollarSign,
  RefreshCw,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSEO, seoConfigs } from '@/hooks/useSEO';

interface ServiceAction {
  id: string;
  name: string;
  description: string;
  price: string;
  priceValue: number;
  token: string;
  endpoint: string;
  method: string;
  features?: string[];
}

export default function SolanaShowcasePage() {
  useSEO(seoConfigs.solana);
  
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const testEndpoint = async (serviceId: string, endpoint: string, method: string = 'GET') => {
    setLoading(prev => ({ ...prev, [serviceId]: true }));
    try {
      const options: RequestInit = {
        method,
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
      };
      
      if (method === 'POST') {
        options.body = JSON.stringify({
          agentId: 'test-agent-' + Date.now(),
          name: 'Showcase Test Wallet'
        });
      }
      
      const response = await fetch(endpoint, options);
      const data = await response.json();
      setTestResults(prev => ({ ...prev, [serviceId]: { status: response.status, data } }));
    } catch (error: any) {
      setTestResults(prev => ({ ...prev, [serviceId]: { error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [serviceId]: false }));
    }
  };

  const services: ServiceAction[] = [
    {
      id: 'solana-ping',
      name: 'Discovery Ping',
      description: 'Service health check and availability verification for registry monitoring',
      price: '$0.25',
      priceValue: 0.25,
      token: 'USDC',
      endpoint: '/solana-pay/ping',
      method: 'GET'
    },
    {
      id: 'token-price-feed',
      name: 'Token Price Feed',
      description: 'Real-time Solana token prices via Jupiter/DexScreener',
      price: '$0.10',
      priceValue: 0.10,
      token: 'USDC',
      endpoint: '/solana-pay/services/price/So11111111111111111111111111111111111111112',
      method: 'GET'
    },
    {
      id: 'trending-tokens',
      name: 'Trending Tokens',
      description: 'Hot tokens on Solana DEXs with volume and price momentum data',
      price: '$0.25',
      priceValue: 0.25,
      token: 'USDC',
      endpoint: '/solana-pay/services/trending',
      method: 'GET'
    },
    {
      id: 'whale-alerts',
      name: 'Whale Wallet Alerts',
      description: 'Track large Solana wallet movements in real-time',
      price: '$0.50',
      priceValue: 0.50,
      token: 'USDC',
      endpoint: '/solana-pay/services/whale-alerts',
      method: 'GET'
    },
    {
      id: 'instant-solana-wallet',
      name: 'Instant Solana Agent Wallet',
      description: 'Create production-ready Solana wallets for AI agents via Coinbase CDP',
      price: '$1.00',
      priceValue: 1.00,
      token: 'USDC',
      endpoint: '/solana-pay/instant-wallet',
      method: 'POST',
      features: [
        'Coinbase CDP Server Wallets',
        'Sub-200ms transaction signing',
        '225+ TPS throughput',
        'AWS Nitro Enclave security',
        'Policy controls'
      ]
    }
  ];

  const discoveryEndpoint = 'https://coinrailz.com/.well-known/solana-actions.json';
  const intentEndpoint = 'https://coinrailz.com/solana-pay/intents';
  const catalogEndpoint = 'https://coinrailz.com/solana-pay/catalog';

  const curlDiscovery = `curl -X GET ${discoveryEndpoint}`;
  const curlIntent = `curl -X GET ${intentEndpoint}`;
  const curlCreateIntent = `curl -X POST ${intentEndpoint} \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "1.00",
    "tokenSymbol": "USDC",
    "serviceName": "instant-solana-wallet"
  }'`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-12">
        
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-purple-500/10 text-purple-400 border-purple-500/20" data-testid="badge-solana-blinks">
            <Zap className="w-3 h-3 mr-1" />
            Dialect Blinks Compatible
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Solana Actions Showcase
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            AI agent payment services powered by Solana Actions. 
            Pay with USDC using on-chain confirmation.
          </p>
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
              Solana Mainnet
            </Badge>
            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
              USDC Payments
            </Badge>
            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
              Dialect Registry Pending
            </Badge>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Discovery Endpoints
            </CardTitle>
            <CardDescription>
              Standard Solana Actions discovery for wallets and registries
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">.well-known/solana-actions.json</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(curlDiscovery, 'Discovery curl')}
                    data-testid="button-copy-discovery"
                  >
                    {copiedCode === 'Discovery curl' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <a href={discoveryEndpoint} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs" data-testid="button-open-discovery">
                      Open <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                </div>
              </div>
              <p className="text-slate-500 text-sm">
                Main discovery endpoint for Dialect Blinks and wallet integrations
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">/solana-pay/intents (GET)</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    onClick={() => copyToClipboard(curlIntent, 'Intent curl')}
                    data-testid="button-copy-intent"
                  >
                    {copiedCode === 'Intent curl' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <a href={intentEndpoint} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs" data-testid="button-open-intent">
                      Open <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </a>
                </div>
              </div>
              <p className="text-slate-500 text-sm">
                ActionGetResponse for Blinks clients - returns available payment actions
              </p>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">/solana-pay/catalog</span>
                <a href={catalogEndpoint} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline" className="text-xs" data-testid="button-open-catalog">
                    Open <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </a>
              </div>
              <p className="text-slate-500 text-sm">
                Full service catalog with pricing and endpoint details
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Create Payment Intent
            </CardTitle>
            <CardDescription>
              POST to /solana-pay/intents to create a payment intent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <pre className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <code className="text-slate-300" data-testid="code-create-intent">{curlCreateIntent}</code>
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 text-slate-400 hover:text-white"
                onClick={() => copyToClipboard(curlCreateIntent, 'Create intent curl')}
                data-testid="button-copy-create-intent"
              >
                {copiedCode === 'Create intent curl' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-slate-500 text-sm mt-2">
              Returns a Solana transaction to sign with your wallet. After payment confirmation, 
              access the service with the intent ID.
            </p>
          </CardContent>
        </Card>

        <h2 className="text-2xl font-bold text-white mb-6" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Available Services
        </h2>

        <div className="grid gap-4 mb-8">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-colors"
              data-testid={`card-service-${service.id}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      {service.id === 'instant-solana-wallet' && <Wallet className="w-5 h-5 text-purple-400" />}
                      {service.id === 'trending-tokens' && <TrendingUp className="w-5 h-5 text-blue-400" />}
                      {service.id === 'whale-alerts' && <AlertCircle className="w-5 h-5 text-orange-400" />}
                      {service.id === 'token-price-feed' && <DollarSign className="w-5 h-5 text-emerald-400" />}
                      {service.id === 'solana-ping' && <Activity className="w-5 h-5 text-emerald-400" />}
                      {service.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{service.description}</CardDescription>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ml-4">
                    {service.price} {service.token}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {service.features && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {service.features.map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <code className="text-slate-400 text-xs bg-slate-900 px-2 py-1 rounded flex-1 overflow-hidden">
                    {service.method} {service.endpoint}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => testEndpoint(service.id, service.endpoint, service.method)}
                    disabled={loading[service.id]}
                    data-testid={`button-test-${service.id}`}
                  >
                    {loading[service.id] ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <>Test <ArrowRight className="w-3 h-3 ml-1" /></>
                    )}
                  </Button>
                </div>

                {testResults[service.id] && (
                  <div className="mt-3 p-3 bg-slate-900 rounded-lg text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      {testResults[service.id].error ? (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Error</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          Status: {testResults[service.id].status}
                        </Badge>
                      )}
                    </div>
                    <pre className="text-slate-400 overflow-x-auto max-h-32">
                      {JSON.stringify(testResults[service.id].data || testResults[service.id].error, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              SDK Quick Start
            </CardTitle>
            <CardDescription>
              Install the NPM package and start sending payments in minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">Install</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => copyToClipboard('npm install @coinrailz/agent-payments-solana', 'npm install')}
                  data-testid="button-copy-npm-install"
                >
                  {copiedCode === 'npm install' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="font-mono text-sm overflow-x-auto">
                <code className="text-slate-300">npm install @coinrailz/agent-payments-solana</code>
              </pre>
            </div>

            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">Send Payment</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => copyToClipboard(`import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

const client = new CoinRailzSolana({
  apiKey: process.env.COINRAILZ_API_KEY
});

const result = await client.send({
  to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  amount: 10.00,
  currency: 'USDC',
  memo: 'Payment for AI service'
});

if (result.success) {
  console.log(result.transactionId);
  console.log(result.explorerUrl);
} else {
  console.error(result.error, result.message);
}`, 'send payment')}
                  data-testid="button-copy-send-payment"
                >
                  {copiedCode === 'send payment' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="font-mono text-xs overflow-x-auto text-slate-300">
{`import { CoinRailzSolana } from '@coinrailz/agent-payments-solana';

const client = new CoinRailzSolana({
  apiKey: process.env.COINRAILZ_API_KEY
});

const result = await client.send({
  to: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  amount: 10.00,
  currency: 'USDC',
  memo: 'Payment for AI service'
});

if (result.success) {
  console.log(result.transactionId);
  console.log(result.explorerUrl);
} else {
  console.error(result.error, result.message);
}`}
              </pre>
            </div>

            <div className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-mono text-sm">Create Wallet</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => copyToClipboard(`const wallet = await client.createWallet();
if (wallet.success) {
  console.log('Address:', wallet.wallet.address);
  // Store wallet.privateKey securely!
}`, 'create wallet')}
                  data-testid="button-copy-create-wallet"
                >
                  {copiedCode === 'create wallet' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <pre className="font-mono text-xs overflow-x-auto text-slate-300">
{`const wallet = await client.createWallet();
if (wallet.success) {
  console.log('Address:', wallet.wallet.address);
  // Store wallet.privateKey securely!
}`}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="https://www.npmjs.com/package/@coinrailz/agent-payments-solana" target="_blank" rel="noopener noreferrer">
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20 cursor-pointer hover:bg-red-500/20" data-testid="badge-npm">
                  NPM Package
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Badge>
              </a>
              <Link href="/docs/sdk/solana">
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 cursor-pointer hover:bg-blue-500/20" data-testid="badge-docs">
                  Full Documentation
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Badge>
              </Link>
              <Link href="/dashboard/api-keys">
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20" data-testid="badge-api-keys">
                  Get API Key
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Badge>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-900/20 border-purple-500/30 mb-8">
          <CardHeader>
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Unique Differentiator: Instant Solana Wallets
            </CardTitle>
            <CardDescription className="text-purple-300/70">
              Create production-ready Solana wallets for AI agents instantly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">
              Unlike other x402/Solana Actions providers, Coin Railz offers <strong>instant Solana wallet creation</strong> via 
              Coinbase CDP Server Wallets. Your AI agent gets a production-ready wallet with:
            </p>
            <ul className="list-disc list-inside text-slate-400 space-y-1 mb-4">
              <li>Sub-200ms transaction signing</li>
              <li>225+ transactions per second throughput</li>
              <li>AWS Nitro Enclave security (hardware isolation)</li>
              <li>Programmable policy controls</li>
              <li>No private key management required</li>
            </ul>
            <div className="flex gap-4">
              <Link href="/quickstart" data-testid="link-quickstart">
                <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-quickstart">
                  Integration Guide <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/credits" data-testid="link-credits">
                <Button variant="outline" className="border-purple-500/30 text-purple-400" data-testid="button-get-credits">
                  Buy Credits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Separator className="bg-slate-700 my-8" />

        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Technical Details
          </h3>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-emerald-400 mb-2">Hgby7V...</div>
                <p className="text-slate-400 text-sm">Receiver Wallet</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">Mainnet</div>
                <p className="text-slate-400 text-sm">Network</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">5</div>
                <p className="text-slate-400 text-sm">Services Available</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-slate-400 mb-6">
            Questions about integration? Check our quickstart guide or contact support.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/quickstart" data-testid="link-quickstart-bottom">
              <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-quickstart-bottom">
                Quickstart Guide <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="https://dial.to" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800" data-testid="button-dialect">
                Dialect Registry <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>
        </div>

        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>
            Pending approval on{' '}
            <a href="https://dial.to/register" className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">
              Dialect Blinks Registry
            </a>
            {' '}|{' '}
            <Link href="/contact-us" className="text-blue-400 hover:underline" data-testid="link-contact">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
