import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Target, Shield, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function CryptoJoinerPro() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePurchase = async (plan: 'monthly' | 'yearly') => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/payments/create-subscription', {
        method: 'POST',
        body: JSON.stringify({ 
          plan: plan,
          service: 'crypto_joiner_pro'
        })
      });

      if (response.success && response.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = response.checkout_url;
      } else {
        throw new Error(response.error || 'Failed to create checkout session');
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12 text-white">
          <div className="mb-4">
            <Badge className="bg-green-500 text-white px-4 py-1 text-lg font-semibold">
              🔥 LIMITED TIME: Save $86/month vs QQSHILL
            </Badge>
          </div>
          <h1 className="text-5xl font-bold mb-6">
            CryptoJoiner Pro
          </h1>
          <p className="text-xl mb-8 text-gray-200 max-w-3xl mx-auto">
            Join 1000+ crypto Telegram groups automatically. Professional-grade bot used by top crypto marketers. 
            <span className="text-yellow-400 font-semibold"> Save $86/month vs competitors!</span>
          </p>
          
          {/* Social Proof */}
          <div className="flex justify-center items-center space-x-8 mb-8 text-gray-300">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">1,247</div>
              <div className="text-sm">Groups Joined Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">156</div>
              <div className="text-sm">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">$86</div>
              <div className="text-sm">Saved vs QQSHILL</div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Why Choose CryptoJoiner Pro?
          </h2>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
              <div className="text-center p-4">
                <div className="text-lg font-semibold text-red-400 mb-2">❌ QQSHILL</div>
                <div className="text-2xl font-bold mb-2">$135/month</div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>• Expensive monthly fee</div>
                  <div>• Limited support</div>
                  <div>• Basic features only</div>
                </div>
              </div>
              
              <div className="text-center p-4 border-2 border-green-400 rounded-lg bg-green-500/20">
                <div className="text-lg font-semibold text-green-400 mb-2">✅ CryptoJoiner Pro</div>
                <div className="text-2xl font-bold mb-2">$49/month</div>
                <div className="space-y-2 text-sm text-gray-200">
                  <div>• <span className="text-green-400">64% cheaper</span></div>
                  <div>• Advanced session management</div>
                  <div>• Real-time progress tracking</div>
                  <div>• Anti-ban protection</div>
                  <div>• 24/7 support</div>
                </div>
              </div>
              
              <div className="text-center p-4">
                <div className="text-lg font-semibold text-gray-400 mb-2">🔧 Manual Joining</div>
                <div className="text-2xl font-bold mb-2">Free (but...)</div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>• 5-10 minutes per group</div>
                  <div>• High risk of account bans</div>
                  <div>• No rate limiting</div>
                  <div>• Extremely time-consuming</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          <Card className="bg-white/10 backdrop-blur-md border-gray-600 text-white">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Monthly Plan</CardTitle>
              <CardDescription className="text-gray-300">Perfect for testing</CardDescription>
              <div className="text-4xl font-bold text-green-400">$49<span className="text-lg text-gray-400">/month</span></div>
              <div className="text-sm text-gray-400 line-through">QQSHILL: $135/month</div>
              <Badge className="bg-green-500 text-white">Save $86/month</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="text-green-400" size={20} />
                  <span>Join unlimited crypto groups</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="text-blue-400" size={20} />
                  <span>Anti-ban protection & rate limiting</span>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="text-purple-400" size={20} />
                  <span>Real-time progress tracking</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-yellow-400" size={20} />
                  <span>24/7 customer support</span>
                </div>
              </div>
              <Button 
                onClick={() => handlePurchase('monthly')}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                data-testid="button-purchase-monthly"
              >
                {isLoading ? 'Processing...' : 'Start Monthly Plan'}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-yellow-500 border-2 text-white relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-yellow-500 text-black px-4 py-1 text-sm font-bold">
                🏆 BEST VALUE
              </Badge>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Yearly Plan</CardTitle>
              <CardDescription className="text-gray-300">2 months FREE</CardDescription>
              <div className="text-4xl font-bold text-yellow-400">$490<span className="text-lg text-gray-400">/year</span></div>
              <div className="text-sm text-green-400">Only $40.83/month</div>
              <div className="text-sm text-gray-400 line-through">QQSHILL: $1,620/year</div>
              <Badge className="bg-green-500 text-white">Save $1,130/year!</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="text-green-400" size={20} />
                  <span>Everything in Monthly Plan</span>
                </div>
                <div className="flex items-center gap-3">
                  <Zap className="text-yellow-400" size={20} />
                  <span className="text-yellow-400 font-semibold">2 months completely FREE</span>
                </div>
                <div className="flex items-center gap-3">
                  <Target className="text-purple-400" size={20} />
                  <span>Priority support queue</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="text-blue-400" size={20} />
                  <span>Advanced session backup</span>
                </div>
              </div>
              <Button 
                onClick={() => handlePurchase('yearly')}
                disabled={isLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-3"
                data-testid="button-purchase-yearly"
              >
                {isLoading ? 'Processing...' : 'Save $98 - Get Yearly'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="mb-16 text-white">
          <h2 className="text-3xl font-bold text-center mb-8">Professional Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Anti-Ban Protection</h3>
              <p className="text-gray-300">Smart rate limiting prevents Telegram account bans. Join safely at optimal speeds.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Target size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Tracking</h3>
              <p className="text-gray-300">Watch your progress live. See exactly which groups you've joined and which failed.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Zap size={32} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Session Management</h3>
              <p className="text-gray-300">Login once, join forever. Persistent sessions mean no repeated authentication.</p>
            </div>
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16 text-white">
          <h2 className="text-3xl font-bold text-center mb-8">What Crypto Marketers Say</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6 text-white">
                <div className="mb-4">⭐⭐⭐⭐⭐</div>
                <p className="mb-4">"Saved me 10+ hours per week. Used to manually join groups, now I focus on actual marketing."</p>
                <div className="font-semibold">- CryptoMarketer_99</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6 text-white">
                <div className="mb-4">⭐⭐⭐⭐⭐</div>
                <p className="mb-4">"Switched from QQSHILL and saved $86/month. Same features, way better price."</p>
                <div className="font-semibold">- DeFi_Trader_Pro</div>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6 text-white">
                <div className="mb-4">⭐⭐⭐⭐⭐</div>
                <p className="mb-4">"No account bans since switching. The anti-ban protection actually works!"</p>
                <div className="font-semibold">- Web3_Growth_Hacker</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-16 text-white">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-white">How is this different from QQSHILL?</h3>
                <p className="text-gray-300">Same core functionality (auto-joining groups) but 64% cheaper at $49/month vs $135/month. We have better session management and real-time tracking.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-white">Will this get my Telegram account banned?</h3>
                <p className="text-gray-300">No. We use professional rate limiting (5-10 minutes between joins) and respect Telegram's API limits. Much safer than manual joining.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/10 backdrop-blur-md border-gray-600">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-2 text-white">Do I need technical knowledge?</h3>
                <p className="text-gray-300">No. Just get your Telegram API credentials (takes 2 minutes) and paste your group URLs. Our system handles everything else.</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center text-white">
          <div className="bg-red-500/20 border border-red-400 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold mb-4">🚨 Limited Time Offer</h3>
            <p className="text-lg mb-4">QQSHILL just raised their price to $145/month. Lock in $49/month before we increase our price.</p>
            <div className="text-sm text-gray-300">⏰ Offer expires in 48 hours</div>
          </div>
          
          <Button 
            onClick={() => handlePurchase('monthly')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xl px-12 py-4 mr-4"
            data-testid="button-purchase-cta"
          >
            Start Saving $86/Month Now
          </Button>
        </div>
      </div>
    </div>
  );
}