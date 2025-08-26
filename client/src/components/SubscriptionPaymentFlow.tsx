import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, DollarSign, Coins, Wallet, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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

interface SubscriptionPaymentFlowProps {
  plan: SubscriptionPlan;
  billingPeriod: 'monthly' | 'yearly';
  onSuccess: () => void;
  onCancel: () => void;
}

function StripePaymentForm({ plan, billingPeriod, onSuccess }: { 
  plan: SubscriptionPlan; 
  billingPeriod: 'monthly' | 'yearly'; 
  onSuccess: () => void; 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const createSubscriptionMutation = useMutation({
    mutationFn: async (paymentMethodId: string) => {
      return apiRequest('POST', '/api/create-subscription', {
        planId: plan.id,
        paymentMethod: 'stripe',
        isYearly: billingPeriod === 'yearly',
        stripePaymentMethodId: paymentMethodId
      });
    },
    onSuccess: () => {
      toast({
        title: "Subscription Created",
        description: "Your subscription has been activated successfully!",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    const card = elements.getElement(CardElement);
    if (!card) {
      setProcessing(false);
      return;
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    });

    if (error) {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    createSubscriptionMutation.mutate(paymentMethod.id);
    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>
      
      <Button 
        type="submit" 
        disabled={!stripe || processing || createSubscriptionMutation.isPending}
        className="w-full"
      >
        {processing || createSubscriptionMutation.isPending ? (
          <>
            <Clock className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Subscribe for ${billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice}
            {billingPeriod === 'yearly' ? '/year' : '/month'}
          </>
        )}
      </Button>
    </form>
  );
}

function USDCPaymentForm({ plan, billingPeriod, onSuccess }: { 
  plan: SubscriptionPlan; 
  billingPeriod: 'monthly' | 'yearly'; 
  onSuccess: () => void; 
}) {
  const { toast } = useToast();
  const [txHash, setTxHash] = useState('');
  const [paymentStep, setPaymentStep] = useState<'instructions' | 'confirmation'>('instructions');

  const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  // Platform wallet address should be fetched from backend API, not exposed in frontend

  const confirmPaymentMutation = useMutation({
    mutationFn: async (txHash: string) => {
      return apiRequest('POST', '/api/create-subscription', {
        planId: plan.id,
        paymentMethod: 'usdc',
        isYearly: billingPeriod === 'yearly',
        usdcTxHash: txHash
      });
    },
    onSuccess: () => {
      toast({
        title: "USDC Payment Confirmed",
        description: "Your subscription has been activated!",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Payment Verification Failed",
        description: error.message || "Could not verify USDC payment",
        variant: "destructive",
      });
    },
  });

  const handleConfirmPayment = () => {
    if (!txHash.trim()) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter your USDC transaction hash",
        variant: "destructive",
      });
      return;
    }

    confirmPaymentMutation.mutate(txHash);
  };

  if (paymentStep === 'instructions') {
    return (
      <div className="space-y-4">
        <Alert>
          <Coins className="h-4 w-4" />
          <AlertDescription>
            Send exactly <strong>${amount} USDC</strong> to the address below, then provide the transaction hash for verification.
          </AlertDescription>
        </Alert>
        
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-sm font-medium mb-2">Payment Address:</div>
          <div className="font-mono text-sm break-all bg-white dark:bg-gray-800 p-3 rounded border">
            Contact support for payment address
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Network: Ethereum (ERC-20) or Polygon
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Amount to Send:</div>
          <div className="text-2xl font-bold text-green-600">${amount} USDC</div>
        </div>

        <Button 
          onClick={() => setPaymentStep('confirmation')} 
          className="w-full"
        >
          I've Sent the Payment
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
        <h3 className="font-semibold">Payment Sent!</h3>
        <p className="text-sm text-muted-foreground">
          Now enter your transaction hash to complete the subscription
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Transaction Hash:</label>
        <input
          type="text"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="0x..."
          className="w-full p-3 border rounded-lg font-mono text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          onClick={() => setPaymentStep('instructions')}
          className="flex-1"
        >
          Back
        </Button>
        <Button 
          onClick={handleConfirmPayment}
          disabled={confirmPaymentMutation.isPending}
          className="flex-1"
        >
          {confirmPaymentMutation.isPending ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            'Confirm Payment'
          )}
        </Button>
      </div>
    </div>
  );
}

export function SubscriptionPaymentFlow({ plan, billingPeriod, onSuccess, onCancel }: SubscriptionPaymentFlowProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'usdc' | 'paypal'>('stripe');
  const amount = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Subscribe to {plan.name}
          </CardTitle>
          <CardDescription>
            {billingPeriod === 'yearly' ? (
              <>
                <span className="line-through text-muted-foreground">
                  ${(plan.monthlyPrice * 12).toFixed(2)}
                </span>
                <span className="ml-2 font-semibold text-green-600">
                  ${amount}/year
                </span>
                <Badge variant="secondary" className="ml-2">
                  Save {plan.yearlyDiscount}%
                </Badge>
              </>
            ) : (
              <span className="font-semibold">${amount}/month</span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={selectedPaymentMethod} onValueChange={(value) => setSelectedPaymentMethod(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="stripe" className="flex items-center gap-1">
                <CreditCard className="w-4 h-4" />
                Card
              </TabsTrigger>
              <TabsTrigger value="usdc" className="flex items-center gap-1">
                <Coins className="w-4 h-4" />
                USDC
              </TabsTrigger>
              <TabsTrigger value="paypal" className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                PayPal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stripe" className="mt-4">
              <Elements stripe={stripePromise}>
                <StripePaymentForm 
                  plan={plan} 
                  billingPeriod={billingPeriod} 
                  onSuccess={onSuccess} 
                />
              </Elements>
            </TabsContent>

            <TabsContent value="usdc" className="mt-4">
              <USDCPaymentForm 
                plan={plan} 
                billingPeriod={billingPeriod} 
                onSuccess={onSuccess} 
              />
            </TabsContent>

            <TabsContent value="paypal" className="mt-4">
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm text-muted-foreground">
                  PayPal integration coming soon
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t">
            <Button variant="outline" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}