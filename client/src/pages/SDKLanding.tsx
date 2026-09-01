import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Code, DollarSign, Zap, Shield, Globe } from 'lucide-react';

export default function SDKLanding() {
  const pricingTiers = [
    {
      name: 'Early Adopter',
      badge: 'LIMITED TIME',
      rate: '0.99%',
      fixed: '$0.05',
      maxTPV: '$500k',
      description: 'Perfect for getting started',
      features: ['USDC-native payments', 'TypeScript SDK', 'Basic support', 'Webhook notifications'],
      color: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
    },
    {
      name: 'Standard',
      badge: 'MOST POPULAR',
      rate: '1.75%',
      fixed: '$0.10',
      description: 'Best for growing AI agents',
      features: ['Everything in Early Adopter', 'Priority support', 'Advanced webhooks', 'Escrow handling'],
      color: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
    },
    {
      name: 'Volume',
      badge: '$1M+ TPV',
      rate: '1.25%',
      fixed: '$0.10',
      description: 'Scale-friendly rates',
      features: ['Everything in Standard', 'Volume discounts', 'Dedicated support', 'Custom integrations'],
      color: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800'
    },
    {
      name: 'Enterprise',
      badge: 'CONTACT SALES',
      rate: '0.6%',
      fixed: '$0.10',
      monthly: '$2,000/mo',
      description: 'For high-volume operations',
      features: ['Everything in Volume', 'SLA guarantees', 'White-label options', 'Dedicated infrastructure'],
      color: 'bg-gray-50 border-gray-200 dark:bg-gray-950 dark:border-gray-800'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            🚀 NEW: @coinrailz/agent-payments SDK
          </Badge>
          <h1 className="text-5xl font-bold mb-6">
            Add Payments to Your AI Agent
            <span className="block text-blue-600 dark:text-blue-400">In 5 Minutes</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            USDC-first payment tooling with current Coinbase CDP support.
            Build machine-payable workflows for autonomous agents.
          </p>
          
          <div className="flex gap-4 justify-center mb-8">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" data-testid="button-get-started">
              Get Started - 0.99% Limited Time
            </Button>
            <Button variant="outline" size="lg" data-testid="button-view-docs">
              <Code className="mr-2 h-4 w-4" />
              View Documentation
            </Button>
          </div>

          <div className="flex justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Check className="mr-1 h-4 w-4 text-green-500" />
              5-minute integration
            </div>
            <div className="flex items-center">
              <Shield className="mr-1 h-4 w-4 text-green-500" />
              Enterprise security
            </div>
            <div className="flex items-center">
              <Globe className="mr-1 h-4 w-4 text-green-500" />
              Multi-chain support
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="mb-16 bg-gray-900 rounded-lg p-6 text-left max-w-4xl mx-auto">
          <div className="text-gray-400 mb-2 text-sm">Quick Integration Example:</div>
          <pre className="text-green-400 text-sm overflow-x-auto">
{`import { createAgentPayments } from '@coinrailz/agent-payments';

// ⚠️ SERVER-SIDE ONLY - DO NOT USE IN CLIENT/BROWSER CODE
const payments = createAgentPayments({
  cdpApiKey: 'your_cdp_api_key_here',           // Replace with your CDP API key
  cdpPrivateKey: 'your_cdp_private_key_here'    // Replace with your CDP private key - CRITICAL!
});

// Create a payment for your AI service
const payment = await payments.createPayment({
  amount: 25.00,
  agentId: 'my-ai-agent-v1',
  serviceDescription: 'AI data analysis and report generation'
});

console.log(\`Payment created! Send USDC to: \${payment.walletAddress}\`);`}
          </pre>
        </div>

        {/* Pricing Cards */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Competitive Pricing</h2>
          <p className="text-center text-muted-foreground mb-8">
            Up to 83% cheaper than traditional payment processors like Stripe (2.9% + $0.30)
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingTiers.map((tier, index) => (
              <Card key={index} className={`relative ${tier.color} ${index === 1 ? 'ring-2 ring-blue-500' : ''}`} data-testid={`card-pricing-${tier.name.toLowerCase().replace(' ', '-')}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    <Badge variant={index === 0 ? 'destructive' : index === 1 ? 'default' : 'secondary'} className="text-xs">
                      {tier.badge}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">
                    {tier.rate} + {tier.fixed}
                    {tier.monthly && <div className="text-sm font-normal text-muted-foreground">+ {tier.monthly}</div>}
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center">
                        <Check className="mr-2 h-3 w-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full mt-4" 
                    variant={index === 1 ? 'default' : 'outline'}
                    data-testid={`button-choose-${tier.name.toLowerCase().replace(' ', '-')}`}
                  >
                    {index === 3 ? 'Contact Sales' : 'Choose Plan'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card data-testid="card-feature-usdc-native-payments">
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5 text-green-500" />
                USDC-Native Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                USDC-first payment flows for x402. Network availability, fees, and confirmation
                timing depend on the selected network and provider.
              </p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-feature-developer-friendly">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="mr-2 h-5 w-5 text-blue-500" />
                Developer-Friendly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                TypeScript SDK with comprehensive documentation. Webhook support, 
                error handling, and production-ready examples.
              </p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-feature-automated-settlements">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="mr-2 h-5 w-5 text-yellow-500" />
                Automated Settlements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Automatic escrow, dispute handling, and agent payouts. 
                Focus on your AI agent, we handle the payments.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Ready to Add Payments?</h2>
          <p className="text-muted-foreground mb-6">
            Join AI agents already using our payment infrastructure to monetize their services.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-green-600 hover:bg-green-700" data-testid="button-start-early-adopter">
              Start with Early Adopter (0.99%)
            </Button>
            <Button variant="outline" size="lg" data-testid="button-book-demo">
              Book a Demo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}