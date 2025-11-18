import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, Shield, Clock, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function AIAgentBundlePage() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const purchaseMutation = useMutation({
    mutationFn: (priceId: string) =>
      apiRequest('/api/products/checkout', {
        method: 'POST',
        body: JSON.stringify({ 
          productType: 'ai_agent_bundle',
          priceId 
        }),
      }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Failed",
        description: error.message || "Failed to create checkout session",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  const handlePurchase = (tier: 'launch' | 'regular') => {
    setIsProcessing(true);
    const priceId = tier === 'launch' ? 'price_bundle_49' : 'price_bundle_99';
    purchaseMutation.mutate(priceId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10">
      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
            🔥 Limited Time Launch Offer
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI Agent Pro Bundle
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get instant access to all 18 x402-powered AI microservices. Everything you need to automate your crypto trading and blockchain workflows.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          
          {/* Launch Price */}
          <Card className="border-2 border-orange-500 shadow-lg shadow-orange-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-orange-500 text-white px-4 py-1 text-sm font-bold transform rotate-12 translate-x-8 translate-y-2">
              SAVE $50
            </div>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl">Launch Price</CardTitle>
                <Badge variant="destructive" className="text-xs">
                  Limited Time
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$49</span>
                <span className="text-muted-foreground line-through">$99</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <CardDescription>Lock in this price forever</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
                onClick={() => handlePurchase('launch')}
                disabled={isProcessing}
                data-testid="button-purchase-launch"
              >
                {isProcessing ? 'Processing...' : 'Get Started - $49/mo'}
              </Button>
              <div className="space-y-3">
                <p className="font-semibold">Everything included:</p>
                <FeatureList />
              </div>
            </CardContent>
          </Card>

          {/* Regular Price */}
          <Card className="border shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Regular Price</CardTitle>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$99</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>
              <CardDescription>Full-featured professional plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full"
                onClick={() => handlePurchase('regular')}
                disabled={isProcessing}
                data-testid="button-purchase-regular"
              >
                {isProcessing ? 'Processing...' : 'Get Started - $99/mo'}
              </Button>
              <div className="space-y-3">
                <p className="font-semibold">Everything included:</p>
                <FeatureList />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Zap className="w-10 h-10 mb-2 text-blue-500" />
              <CardTitle className="text-lg">18 AI Services</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contract scanner, whale tracker, trade signals, smart contract audit, and 14 more powerful tools
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="w-10 h-10 mb-2 text-green-500" />
              <CardTitle className="text-lg">Unlimited Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No limits on scans, alerts, or API calls. Use as much as you need for your workflows
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="w-10 h-10 mb-2 text-purple-500" />
              <CardTitle className="text-lg">Priority Support</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get fast responses from our team and priority access to new features
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Service List */}
        <Card className="max-w-5xl mx-auto">
          <CardHeader>
            <CardTitle>All 18 AI Services Included</CardTitle>
            <CardDescription>Access every service with your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <ServiceItem name="Smart Contract Scanner" price="$0.50/scan" />
              <ServiceItem name="Whale Tracker & Alerts" price="$0.30/alert" />
              <ServiceItem name="Trade Signal Generator" price="$0.20/signal" />
              <ServiceItem name="Smart Contract Audit" price="$1.00/audit" />
              <ServiceItem name="Gas Price Oracle" price="$0.10/check" />
              <ServiceItem name="Token Analytics" price="$0.40/analysis" />
              <ServiceItem name="DEX Price Aggregator" price="$0.25/query" />
              <ServiceItem name="Liquidity Pool Scanner" price="$0.35/scan" />
              <ServiceItem name="NFT Floor Price Tracker" price="$0.15/check" />
              <ServiceItem name="Wallet Portfolio Analytics" price="$0.50/report" />
              <ServiceItem name="On-chain Data Query" price="$0.20/query" />
              <ServiceItem name="Risk Assessment Engine" price="$0.75/assessment" />
              <ServiceItem name="Cross-chain Bridge Monitor" price="$0.30/check" />
              <ServiceItem name="Staking Rewards Calculator" price="$0.15/calc" />
              <ServiceItem name="DeFi Protocol Scanner" price="$0.40/scan" />
              <ServiceItem name="Token Holder Analytics" price="$0.35/analysis" />
              <ServiceItem name="Transaction Pattern Detector" price="$0.45/scan" />
              <ServiceItem name="Market Sentiment Analyzer" price="$0.30/analysis" />
            </div>
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pay-as-you-go value: $200+/month at regular rates
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Save over 75% with the bundle subscription
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="max-w-5xl mx-auto">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Is the launch price locked in forever?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! If you subscribe at $49/month, you'll keep that price as long as you remain subscribed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Absolutely. Cancel anytime from your account dashboard. No contracts or commitments.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards (Visa, MasterCard, Amex) via Stripe. Crypto payments coming soon.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">Do I get API access?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! Every subscription includes full API access with unlimited requests across all 18 services.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureList() {
  const features = [
    '18 x402-powered AI services',
    'Telegram Mini-App access',
    'Unlimited contract scans',
    '50 agent-to-agent credits',
    'Whale alerts & signals',
    'Smart contract auditing',
    'Priority support',
    'API access included'
  ];

  return (
    <div className="space-y-2">
      {features.map((feature, i) => (
        <div key={i} className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-sm">{feature}</span>
        </div>
      ))}
    </div>
  );
}

function ServiceItem({ name, price }: { name: string; price: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <span className="text-xs text-muted-foreground">{price}</span>
    </div>
  );
}
