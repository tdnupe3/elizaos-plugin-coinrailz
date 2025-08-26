import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Zap, TrendingUp, Shield, Star } from 'lucide-react';
import { EnhancedPaymentSelector } from './EnhancedPaymentSelector';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  features: string[];
  popular?: boolean;
  tier: 'starter' | 'pro' | 'enterprise';
}

interface SubscriptionUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  onUpgradeSuccess: (subscription: any) => void;
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    yearlyPrice: 290, // ~17% discount
    description: 'Perfect for individuals getting started with crypto trading',
    tier: 'starter',
    features: [
      'Reduced trading fees (2.5%)',
      '$100 AI marketplace credits',
      'Basic analytics & insights',
      'Email support',
      'Access to DEX aggregator',
      'Standard transaction limits'
    ]
  },
  {
    id: 'pro',
    name: 'Professional',
    monthlyPrice: 79,
    yearlyPrice: 790, // ~17% discount
    description: 'Advanced features for serious traders and businesses',
    tier: 'pro',
    popular: true,
    features: [
      'Lowest trading fees (1.5%)',
      '$500 AI marketplace credits',
      'Advanced analytics & reporting',
      'Priority support with dedicated channel',
      'Advanced DEX features & MEV protection',
      'Higher transaction limits',
      'Portfolio management tools',
      'API access for automated trading'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 199,
    yearlyPrice: 1990, // ~17% discount
    description: 'Custom solutions for institutions and high-volume traders',
    tier: 'enterprise',
    features: [
      'Custom fee structure (as low as 0.5%)',
      '$2,000 AI marketplace credits',
      'White-label solutions available',
      'Dedicated account manager',
      'Custom integrations & APIs',
      'Unlimited transaction limits',
      'Advanced compliance & reporting',
      'Custom smart contract audits',
      'Institutional-grade security'
    ]
  }
];

export function SubscriptionUpgradeModal({ 
  isOpen, 
  onClose, 
  currentPlan = 'free',
  onUpgradeSuccess 
}: SubscriptionUpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>('pro');
  const [isYearly, setIsYearly] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const { toast } = useToast();

  const getSelectedPlanData = () => {
    return subscriptionPlans.find(plan => plan.id === selectedPlan);
  };

  const calculateSavings = (plan: SubscriptionPlan) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const yearlyCost = plan.yearlyPrice;
    return monthlyCost - yearlyCost;
  };

  const getPlanIcon = (tier: string) => {
    switch (tier) {
      case 'starter': return Zap;
      case 'pro': return TrendingUp;
      case 'enterprise': return Shield;
      default: return Star;
    }
  };

  const handlePaymentSuccess = (subscription: any) => {
    onUpgradeSuccess(subscription);
    toast({
      title: "Subscription Upgraded Successfully!",
      description: `Welcome to ${getSelectedPlanData()?.name} plan. Your new features are now active.`,
    });
    onClose();
  };

  const handlePaymentInitiated = (paymentData: any) => {
    if (paymentData.paymentUrl) {
      toast({
        title: "Payment Processing",
        description: "Complete your payment in the opened window to activate your subscription.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Upgrade Your Subscription
          </DialogTitle>
        </DialogHeader>

        {!showPayment ? (
          <div className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4 p-4 bg-muted/50 rounded-lg">
              <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : ''}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={isYearly}
                onCheckedChange={setIsYearly}
              />
              <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : ''}>
                Yearly
              </Label>
              {isYearly && (
                <Badge variant="secondary" className="ml-2">
                  Save up to 17%
                </Badge>
              )}
            </div>

            {/* Plan Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subscriptionPlans.map((plan) => {
                const PlanIcon = getPlanIcon(plan.tier);
                const isSelected = selectedPlan === plan.id;
                const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                const billingPeriod = isYearly ? 'year' : 'month';
                const savings = isYearly ? calculateSavings(plan) : 0;

                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all relative ${
                      isSelected 
                        ? 'ring-2 ring-primary border-primary shadow-lg scale-105' 
                        : 'hover:shadow-md hover:scale-102'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1">
                          Most Popular
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center pb-2">
                      <div className="flex items-center justify-center mb-2">
                        <PlanIcon className="w-8 h-8 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="text-sm px-2">
                        {plan.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold">
                          ${price}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{billingPeriod}
                          </span>
                        </div>
                        {isYearly && savings > 0 && (
                          <div className="text-sm text-green-600 font-medium">
                            Save ${savings}/year
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mb-4">
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      {isSelected && (
                        <Badge variant="secondary" className="w-full justify-center">
                          Selected Plan
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Current Plan Information */}
            {currentPlan !== 'free' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Current Plan:</strong> {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  {selectedPlan !== currentPlan && (
                    <span className="ml-2 font-medium">
                      → Upgrading to {getSelectedPlanData()?.name}
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => setShowPayment(true)}
                className="flex-1"
                size="lg"
                disabled={!selectedPlan}
              >
                Continue to Payment
                <span className="ml-2">
                  ${isYearly ? getSelectedPlanData()?.yearlyPrice : getSelectedPlanData()?.monthlyPrice}
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{getSelectedPlanData()?.name} Plan</div>
                    <div className="text-sm text-muted-foreground">
                      {isYearly ? 'Annual' : 'Monthly'} billing
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      ${isYearly ? getSelectedPlanData()?.yearlyPrice : getSelectedPlanData()?.monthlyPrice}
                    </div>
                    {isYearly && getSelectedPlanData() && (
                      <div className="text-sm text-green-600">
                        Save ${calculateSavings(getSelectedPlanData()!)}/year
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Selector */}
            <EnhancedPaymentSelector
              planId={selectedPlan}
              amount={isYearly ? getSelectedPlanData()?.yearlyPrice || 0 : getSelectedPlanData()?.monthlyPrice || 0}
              isYearly={isYearly}
              onPaymentInitiated={handlePaymentInitiated}
              onSuccess={handlePaymentSuccess}
            />

            {/* Back Button */}
            <div className="flex justify-start">
              <Button 
                variant="outline" 
                onClick={() => setShowPayment(false)}
                className="min-w-[120px]"
              >
                ← Back to Plans
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}