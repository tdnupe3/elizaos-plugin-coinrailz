import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Download, CreditCard, Bitcoin, ArrowRight, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ReportLandingPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStripeCheckout = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address to receive your report.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/buy-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'STRIPE',
          email: email
        })
      });

      const data = await response.json();
      
      if (data.success && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Failed",
        description: "Unable to create payment session. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoPayment = () => {
    toast({
      title: "Crypto Payment",
      description: "Send $10 USDC to: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91",
      duration: 10000
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-red-100 text-red-800 border-red-200" variant="outline">
            🔥 LIMITED TIME: Early Access
          </Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            AI Agent Revenue Revolution
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Complete Guide to Google AP2 & Coinbase x402 Integration for Maximum AI Agent Profits
          </p>
          
          <div className="flex justify-center items-center gap-4 mb-8">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-sm text-gray-600">47 pages • 10 chapters • Instant access</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Left Column - Value Proposition */}
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">🚨 Why This Matters NOW</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                  Google and Coinbase launched the Agent Payments Protocol (AP2) + x402 on September 16, 2025. 
                  This unlocks <strong>autonomous payments between AI agents</strong> - a $289 billion market opportunity.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                  <p className="font-semibold text-blue-800 dark:text-blue-200">
                    Early movers are reporting $500-$15,000 in revenue within the first month
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What You'll Learn</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    'One-line x402 payment integration (copy-paste ready)',
                    'Access to 60+ enterprise partnerships',
                    'Multi-chain USDC optimization strategies',
                    'Automated revenue stream setup',
                    'Enterprise-grade security implementation',
                    'Real case studies and profit examples'
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50 dark:bg-green-900 dark:border-green-700">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-green-800 dark:text-green-200 mb-2">
                    💰 Investment: $10 • ROI: 1000%+
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    Most buyers see return on investment within the first hour of implementation
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Purchase Form */}
          <div className="space-y-6">
            <Card className="border-2 border-blue-200 shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Get Instant Access</CardTitle>
                <p className="text-gray-600 dark:text-gray-400">
                  Download immediately after payment
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Email Address</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full"
                      data-testid="input-email"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Report will be delivered to this email instantly
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={handleStripeCheckout}
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
                      data-testid="button-stripe-checkout"
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      {loading ? 'Creating Checkout...' : 'Pay $10 with Credit Card'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    <div className="text-center text-sm text-gray-500">or</div>

                    <Button
                      onClick={handleCryptoPayment}
                      variant="outline"
                      className="w-full py-3"
                      data-testid="button-crypto-payment"
                    >
                      <Bitcoin className="w-5 h-5 mr-2" />
                      Pay $10 USDC (Crypto)
                    </Button>
                  </div>

                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Download className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Instant download after payment
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Secure payment processing by Stripe
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sample Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📖 Report Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg font-mono text-sm">
                  <div className="text-blue-600 dark:text-blue-400 mb-2">
                    // Chapter 3: x402 Implementation
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    {`import { x402Protocol } from '@coinbase/agentkit';

const agent = new Agent({
  wallet: 'your_wallet_address',
  endpoints: {
    '/analysis': '$0.50',
    '/trading': '$2.00',
    '/predictions': '$5.00'
  }
});

// Your agent now earns autonomous revenue`}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  This is just one of 47 pages of implementation guides, strategies, and case studies.
                </p>
              </CardContent>
            </Card>

            {/* Guarantee */}
            <Card className="border-green-200">
              <CardContent className="pt-4">
                <div className="text-center">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    ✅ 30-Day Money-Back Guarantee
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    If you don't earn back your $10 investment within 30 days, we'll refund you immediately.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500">
            Questions? Contact{' '}
            <a href="mailto:support@coinrailz.com" className="text-blue-600 hover:underline">
              support@coinrailz.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}