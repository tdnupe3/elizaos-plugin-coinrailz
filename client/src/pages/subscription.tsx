import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { SubscriptionPricingCard } from '@/components/SubscriptionPricingCard';
import { SubscriptionPaymentFlow } from '@/components/SubscriptionPaymentFlow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CreditCard, Shield, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  features: string[];
}

interface CurrentSubscription {
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriodEnd: string;
}

export default function SubscriptionPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const { toast } = useToast();

  // Fetch subscription plans
  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-tiers'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current user subscription if authenticated
  const { data: currentSubscription, isLoading: subscriptionLoading } = useQuery<CurrentSubscription>({
    queryKey: ['/api/user/subscription'],
    retry: false,
  });

  const handleSelectPlan = (planId: string, period: 'monthly' | 'yearly') => {
    if (planId === 'free') {
      toast({
        title: "Free Plan Active",
        description: "You're already on the free plan with full trading access!",
      });
      return;
    }
    
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setSelectedPlan(plan);
      setBillingPeriod(period);
      setShowPaymentDialog(true);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    setSelectedPlan(null);
    
    // Refresh subscription data
    queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
    
    toast({
      title: "Subscription Activated!",
      description: `Welcome to ${selectedPlan?.name}! Your new benefits are now active.`,
    });
  };

  const handlePaymentCancel = () => {
    setShowPaymentDialog(false);
    setSelectedPlan(null);
  };

  const calculateAnnualSavings = (plan: SubscriptionPlan) => {
    const annualMonthlyCost = plan.monthlyPrice * 12;
    const annualSavings = annualMonthlyCost - plan.yearlyPrice;
    return annualSavings;
  };

  if (plansLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Trading Plan</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Unlock lower fees, advanced features, and AI marketplace credits
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <Label htmlFor="billing-toggle" className="text-sm font-medium">
            Monthly
          </Label>
          <Switch
            id="billing-toggle"
            checked={billingPeriod === 'yearly'}
            onCheckedChange={(checked) => setBillingPeriod(checked ? 'yearly' : 'monthly')}
          />
          <Label htmlFor="billing-toggle" className="text-sm font-medium">
            Yearly
          </Label>
          {billingPeriod === 'yearly' && (
            <Badge variant="secondary" className="ml-2">
              Save 20%
            </Badge>
          )}
        </div>
      </div>

      {/* Subscription Status Alert */}
      {currentSubscription && (
        <Alert className="mb-8 border-green-200 bg-green-50 dark:bg-green-950">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            You're currently on the <strong>{currentSubscription.planName}</strong> plan. 
            {currentSubscription.status === 'active' ? ' Your subscription is active.' : 
             currentSubscription.status === 'cancelled' ? ' Your subscription will end on ' + new Date(currentSubscription.currentPeriodEnd).toLocaleDateString() + '.' :
             ' Your subscription status: ' + currentSubscription.status}
          </AlertDescription>
        </Alert>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {plans.map((plan, index: number) => (
          <SubscriptionPricingCard
            key={plan.id}
            plan={plan}
            isPopular={plan.id === 'pro'}
            isCurrentPlan={currentSubscription?.planId === plan.id}
            billingPeriod={billingPeriod}
            onSelectPlan={handleSelectPlan}
            loading={showPaymentDialog && selectedPlan?.id === plan.id}
          />
        ))}
      </div>

      {/* Features Comparison */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Why Upgrade?
          </CardTitle>
          <CardDescription>
            Compare what you get with each subscription tier
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <CreditCard className="w-8 h-8 mx-auto mb-3 text-blue-500" />
              <h3 className="font-semibold mb-2">Lower Trading Fees</h3>
              <p className="text-sm text-muted-foreground">
                Save up to 30% on every trade with our premium plans. 
                More savings as you trade more.
              </p>
            </div>
            
            <div className="text-center">
              <Zap className="w-8 h-8 mx-auto mb-3 text-purple-500" />
              <h3 className="font-semibold mb-2">AI Marketplace Credits</h3>
              <p className="text-sm text-muted-foreground">
                Get monthly credits to use AI services, trading bots, 
                and advanced analytics tools.
              </p>
            </div>
            
            <div className="text-center">
              <Shield className="w-8 h-8 mx-auto mb-3 text-green-500" />
              <h3 className="font-semibold mb-2">Priority Support</h3>
              <p className="text-sm text-muted-foreground">
                Get faster support, advanced tools, and exclusive 
                features for professional trading.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Annual Savings Calculator */}
      {billingPeriod === 'yearly' && (
        <Card>
          <CardHeader>
            <CardTitle>Annual Savings Breakdown</CardTitle>
            <CardDescription>
              See how much you save by choosing yearly billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.filter((plan) => plan.id !== 'free').map((plan) => {
                const savings = calculateAnnualSavings(plan);
                return (
                  <div key={plan.id} className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">{plan.name}</h4>
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      ${savings.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      saved annually
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Alert className="mt-8">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          All payments are processed securely through our trusted payment partners. 
          You can cancel or change your subscription at any time.
        </AlertDescription>
      </Alert>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Your Subscription</DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <SubscriptionPaymentFlow
              plan={selectedPlan}
              billingPeriod={billingPeriod}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}