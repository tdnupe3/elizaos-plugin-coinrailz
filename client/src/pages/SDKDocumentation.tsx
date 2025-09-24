import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Code, Copy, Download, ExternalLink, CheckCircle, TrendingDown, 
  Zap, Shield, Globe, Clock, Users, ArrowRight, Book, Key,
  DollarSign, Activity, AlertTriangle, ChevronRight
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

interface CodeExample {
  language: string;
  title: string;
  description: string;
  code: string;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  response: string;
}

export default function SDKDocumentation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const codeExamples: CodeExample[] = [
    {
      language: 'typescript',
      title: 'Initialize SDK',
      description: 'Basic setup with license key authentication',
      code: `import { CoinRailzSDK } from '@coinrailz/payments';

const sdk = new CoinRailzSDK({
  licenseKey: 'your_license_key_here',
  environment: 'production', // or 'sandbox'
  webhook: {
    secret: 'your_webhook_secret',
    url: 'https://yourapp.com/webhook'
  }
});

// Verify license and get account info
const accountInfo = await sdk.account.info();
console.log('Account status:', accountInfo.status);`
    },
    {
      language: 'typescript',
      title: 'Create Payment',
      description: 'Process USDC payments with automatic fee collection',
      code: `// Create a new payment intent
const payment = await sdk.payments.create({
  amount: 10000, // $100.00 in cents
  currency: 'USDC',
  customer: {
    email: 'customer@example.com',
    metadata: { orderId: 'order_123' }
  },
  successUrl: 'https://yourapp.com/success',
  cancelUrl: 'https://yourapp.com/cancel'
});

console.log('Payment ID:', payment.id);
console.log('Client secret:', payment.clientSecret);

// Our fees: 0.99% vs Stripe's 2.9%
// On $100: $0.99 vs $2.90 (67% savings!)`
    },
    {
      language: 'typescript',
      title: 'Handle Webhooks',
      description: 'Real-time payment status updates with enterprise security',
      code: `import { CoinRailzWebhook } from '@coinrailz/payments';

export async function POST(request: Request) {
  // ⚠️ SERVER-SIDE ONLY - NEVER expose webhook secrets to client
  const webhook = new CoinRailzWebhook('your_webhook_secret_here');
  
  try {
    const event = await webhook.verify(request);
    
    switch (event.type) {
      case 'payment.succeeded':
        // Payment completed successfully
        await updateOrderStatus(event.data.id, 'paid');
        break;
        
      case 'payment.failed':
        // Payment failed - retry or cancel order
        await handleFailedPayment(event.data.id);
        break;
        
      case 'payment.refunded':
        // Refund processed
        await processRefund(event.data.id);
        break;
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new Response('Forbidden', { status: 403 });
  }
}`
    },
    {
      language: 'typescript',
      title: 'Multi-Chain USDC Support',
      description: 'Accept USDC from multiple blockchains automatically',
      code: `// Accept USDC from any supported chain
const payment = await sdk.payments.create({
  amount: 50000, // $500.00
  currency: 'USDC',
  chains: ['ethereum', 'polygon', 'base', 'arbitrum', 'bsc'],
  autoConvert: true, // Convert to single chain for settlement
  settlementChain: 'base', // Settle on Base for low fees
  customer: {
    walletAddress: '0x742d35Cc...',
    email: 'enterprise@company.com'
  }
});

// Customer can pay with USDC from any chain
// Automatic routing to lowest-cost settlement`
    },
    {
      language: 'javascript',
      title: 'React Integration',
      description: 'Frontend payment component with TypeScript support',
      code: `import { CoinRailzProvider, usePayment } from '@coinrailz/react';

function PaymentForm({ amount }) {
  const { createPayment, isLoading } = usePayment();
  
  const handlePayment = async () => {
    const payment = await createPayment({
      amount: amount * 100, // Convert to cents
      currency: 'USDC',
      metadata: { productId: 'prod_123' }
    });
    
    // Redirect to payment page
    window.location.href = payment.checkoutUrl;
  };
  
  return (
    <CoinRailzProvider licenseKey={import.meta.env.VITE_COINRAILZ_PUBLIC_KEY}>
      <button 
        onClick={handlePayment}
        disabled={isLoading}
        className="payment-button"
      >
        {isLoading ? 'Processing...' : \`Pay $\${amount} with USDC\`}
      </button>
    </CoinRailzProvider>
  );
}`
    }
  ];

  const apiEndpoints: ApiEndpoint[] = [
    {
      method: 'POST',
      path: '/v1/payments',
      description: 'Create a new payment intent',
      params: [
        { name: 'amount', type: 'integer', required: true, description: 'Amount in cents (minimum 100)' },
        { name: 'currency', type: 'string', required: true, description: 'Currency code (USDC, USD)' },
        { name: 'customer', type: 'object', required: false, description: 'Customer information' },
        { name: 'metadata', type: 'object', required: false, description: 'Custom metadata' }
      ],
      response: `{
  "id": "pi_1234567890",
  "clientSecret": "pi_1234567890_secret_xyz",
  "amount": 10000,
  "currency": "USDC",
  "status": "requires_payment_method",
  "checkoutUrl": "https://pay.coinrailz.com/checkout/pi_1234567890"
}`
    },
    {
      method: 'GET',
      path: '/v1/payments/{id}',
      description: 'Retrieve payment details',
      params: [
        { name: 'id', type: 'string', required: true, description: 'Payment intent ID' }
      ],
      response: `{
  "id": "pi_1234567890",
  "amount": 10000,
  "currency": "USDC",
  "status": "succeeded",
  "fees": 99, // 0.99% vs Stripe's 2.9%
  "netAmount": 9901,
  "createdAt": "2025-01-01T12:00:00Z"
}`
    },
    {
      method: 'POST',
      path: '/v1/refunds',
      description: 'Create a refund for a payment',
      params: [
        { name: 'paymentId', type: 'string', required: true, description: 'Payment ID to refund' },
        { name: 'amount', type: 'integer', required: false, description: 'Partial refund amount' },
        { name: 'reason', type: 'string', required: false, description: 'Refund reason' }
      ],
      response: `{
  "id": "re_1234567890",
  "amount": 10000,
  "status": "succeeded",
  "paymentId": "pi_1234567890"
}`
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" asChild data-testid="button-back">
              <Link href="/sdk-landing">
                <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
                Back to SDK Overview
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" asChild data-testid="button-get-started">
                <Link href="/sdk-enterprise-signup">
                  Get Started
                </Link>
              </Button>
              <Button data-testid="button-download-sdk">
                <Download className="mr-2 h-4 w-4" />
                Download SDK
              </Button>
            </div>
          </div>
          
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              83% CHEAPER THAN STRIPE
            </Badge>
            <h1 className="text-4xl font-bold mb-4" data-testid="heading-main">
              Enterprise Payment SDK Documentation
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Professional payment infrastructure with real Circle USDC integration. 
              Built for AI companies targeting the $50+ billion payments market.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card data-testid="stat-savings">
              <CardContent className="p-4 text-center">
                <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">0.99%-1.75%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transaction Fees</div>
                <div className="text-xs text-green-600">vs Stripe's 2.9%</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-uptime">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">99.99%</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Uptime SLA</div>
                <div className="text-xs text-blue-600">Enterprise Grade</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-chains">
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">5+</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Blockchains</div>
                <div className="text-xs text-purple-600">Multi-chain USDC</div>
              </CardContent>
            </Card>
            <Card data-testid="stat-support">
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold">1-48hrs</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Support Response</div>
                <div className="text-xs text-orange-600">Based on tier</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Documentation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6" data-testid="tabs-list">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
            <TabsTrigger value="api">API Reference</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card data-testid="card-overview">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Book className="mr-2 h-5 w-5" />
                  Why Choose Coin Railz SDK?
                </CardTitle>
                <CardDescription>
                  Built specifically for AI companies and fintech startups needing competitive payment infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center text-green-700 dark:text-green-400">
                      <TrendingDown className="mr-2 h-4 w-4" />
                      Massive Cost Savings
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm"><strong>0.99%-1.75% fees</strong> vs Stripe's 2.9%</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">Fortune 500 tier: <strong>$100K+ annual savings</strong></span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">No hidden fees or markup on currency conversion</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center text-blue-700 dark:text-blue-400">
                      <Zap className="mr-2 h-4 w-4" />
                      AI-Native Features
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">Real <strong>Circle USDC integration</strong></span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">Multi-chain USDC support (5+ chains)</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">Automated fee collection and analytics</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Separator />

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4 text-blue-700 dark:text-blue-400">Enterprise Use Cases</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <div className="font-medium">AI Companies</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Model usage payments, API billing, subscription management</div>
                    </div>
                    <div>
                      <div className="font-medium">Fintech Startups</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">P2P transfers, crypto onramps, DeFi integrations</div>
                    </div>
                    <div>
                      <div className="font-medium">Enterprise SaaS</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">B2B payments, invoicing, global transactions</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card data-testid="card-quickstart">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5" />
                  Quick Start Guide
                </CardTitle>
                <CardDescription>
                  Get up and running with payments in under 10 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold mr-4">
                      1
                    </div>
                    <div>
                      <div className="font-semibold">Get Your License Key</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Sign up for an Enterprise SDK license and get your API key
                      </div>
                      <Button size="sm" asChild>
                        <Link href="/sdk-enterprise-signup">
                          Get License Key
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold mr-4">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Install the SDK</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Install via npm or yarn
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <code className="text-sm">npm install @coinrailz/payments</code>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => copyToClipboard('npm install @coinrailz/payments', 'Install command')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold mr-4">
                      3
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Initialize and Create Payment</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Basic setup with your first payment
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                        <pre className="text-sm overflow-x-auto">
{`import { CoinRailzSDK } from '@coinrailz/payments';

const sdk = new CoinRailzSDK({
  licenseKey: 'your_license_key_here',
  environment: 'production'
});

const payment = await sdk.payments.create({
  amount: 10000, // $100.00 in cents
  currency: 'USDC'
});`}
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-sm font-semibold mr-4">
                      ✓
                    </div>
                    <div>
                      <div className="font-semibold text-green-700 dark:text-green-400">You're Ready!</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Start accepting payments with enterprise-grade infrastructure
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <div className="grid gap-6">
              {codeExamples.map((example, index) => (
                <Card key={index} data-testid={`card-example-${index}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Code className="mr-2 h-5 w-5" />
                        {example.title}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(example.code, example.title)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </CardTitle>
                    <CardDescription>{example.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm">
                        <code>{example.code}</code>
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* API Reference Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card data-testid="card-api-reference">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="mr-2 h-5 w-5" />
                  API Reference
                </CardTitle>
                <CardDescription>
                  Complete REST API documentation for enterprise integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="font-semibold mb-2">Base URL</div>
                  <code className="text-sm">https://api.coinrailz.com/v1</code>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    All requests require authentication via API key in the Authorization header
                  </div>
                </div>

                {apiEndpoints.map((endpoint, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500" data-testid={`endpoint-${index}`}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Badge className={`mr-3 ${
                          endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                          endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-sm">{endpoint.path}</code>
                      </CardTitle>
                      <CardDescription>{endpoint.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {endpoint.params.length > 0 && (
                        <div>
                          <div className="font-semibold mb-2">Parameters</div>
                          <div className="space-y-2">
                            {endpoint.params.map((param, paramIndex) => (
                              <div key={paramIndex} className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono">{param.name}</code>
                                    <Badge variant="outline" className="text-xs">
                                      {param.type}
                                    </Badge>
                                    {param.required && (
                                      <Badge className="text-xs bg-red-100 text-red-800">
                                        Required
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">
                                    {param.description}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <div className="font-semibold mb-2">Response Example</div>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                          <pre className="text-sm overflow-x-auto">
                            <code>{endpoint.response}</code>
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card data-testid="card-pricing-comparison">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  Pricing Comparison
                </CardTitle>
                <CardDescription>
                  See how much you'll save compared to Stripe and other payment processors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Volume Tier</th>
                        <th className="text-left p-4">Coin Railz Fee</th>
                        <th className="text-left p-4">Stripe Fee</th>
                        <th className="text-left p-4">Monthly Savings*</th>
                        <th className="text-left p-4">Annual Savings*</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="p-4">
                          <div className="font-semibold">Startup</div>
                          <div className="text-sm text-gray-600">$50K/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">1.75%</div>
                          <div className="text-sm">$875/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-red-600">2.9%</div>
                          <div className="text-sm">$1,450/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$575</div>
                          <div className="text-sm">40% savings</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$6,900</div>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-4">
                          <div className="font-semibold">Growth</div>
                          <div className="text-sm text-gray-600">$250K/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">1.45%</div>
                          <div className="text-sm">$3,625/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-red-600">2.9%</div>
                          <div className="text-sm">$7,250/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$3,625</div>
                          <div className="text-sm">50% savings</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$43,500</div>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-4">
                          <div className="font-semibold">Enterprise AI</div>
                          <div className="text-sm text-gray-600">$1M/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">1.25%</div>
                          <div className="text-sm">$12,500/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-red-600">2.9%</div>
                          <div className="text-sm">$29,000/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$16,500</div>
                          <div className="text-sm">57% savings</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$198,000</div>
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="p-4">
                          <div className="font-semibold">Fortune 500</div>
                          <div className="text-sm text-gray-600">$5M/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">0.99%</div>
                          <div className="text-sm">$49,500/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-red-600">2.9%</div>
                          <div className="text-sm">$145,000/month</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$95,500</div>
                          <div className="text-sm">66% savings</div>
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-green-600">$1,146,000</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  * Savings calculations based on transaction volume comparison. Enterprise tiers include additional benefits like dedicated support, SLA guarantees, and custom integrations.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enterprise Tab */}
          <TabsContent value="enterprise" className="space-y-6">
            <Card data-testid="card-enterprise">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  Enterprise Features
                </CardTitle>
                <CardDescription>
                  Advanced capabilities for Fortune 500 companies and high-volume applications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Security & Compliance</h3>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          SOC 2 Type II Certification
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          PCI DSS Level 1 Compliance
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          GDPR & CCPA Compliant
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          AES-256 Encryption
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Infrastructure</h3>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          99.99% Uptime SLA
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Multi-region deployment
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Load balancing & auto-scaling
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Dedicated infrastructure option
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Support & Service</h3>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          24/7 Priority Support
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Dedicated Account Manager
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Custom Integration Support
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Training & Onboarding
                        </li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Customization</h3>
                      <ul className="space-y-1 text-sm">
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          White-label options
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Custom fee structures
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          API customization
                        </li>
                        <li className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          Private cloud deployment
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <div className="text-center">
                    <h3 className="text-xl font-bold mb-2">Ready for Enterprise Deployment?</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Join Fortune 500 companies saving millions on payment processing
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild>
                        <Link href="/sdk-enterprise-signup">
                          Start Enterprise Trial
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline">
                        Contact Sales Team
                        <Users className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}