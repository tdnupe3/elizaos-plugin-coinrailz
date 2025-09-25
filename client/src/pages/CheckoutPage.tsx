import { useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, CreditCard, Shield, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY!);

interface PaymentIntentData {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  metadata: {
    campaign_id: string;
    campaign_type: string;
    offer_name: string;
    targets: string;
    delivery_time: string;
  };
  description: string;
}

interface CheckoutFormProps {
  paymentIntent: PaymentIntentData;
  onSuccess: () => void;
}

function CheckoutForm({ paymentIntent, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent: completedPayment } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?payment_intent=${paymentIntent.id}`,
      },
      redirect: 'if_required'
    });

    if (error) {
      setMessage(error.message || 'Payment failed');
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    } else if (completedPayment && completedPayment.status === 'succeeded') {
      // Payment succeeded - update backend and navigate to success page
      try {
        await apiRequest('POST', '/api/campaigns/verify-payment', {
          payment_intent_id: completedPayment.id,
          client_secret: completedPayment.client_secret
        });

        // Navigate to success page with payment intent ID
        window.location.href = `/checkout/success?payment_intent=${completedPayment.id}&payment_intent_client_secret=${completedPayment.client_secret}`;
      } catch (backendError: any) {
        console.error('Failed to update conversion record:', backendError);
        // Still show success to user since payment worked
        toast({
          title: "Payment Successful!",
          description: "Your campaign partnership is now active.",
        });
        onSuccess();
      }
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-muted rounded-lg">
        <PaymentElement />
      </div>
      
      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {message}
        </div>
      )}

      <Button 
        type="submit" 
        disabled={!stripe || isLoading} 
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Pay ${(paymentIntent.amount / 100).toLocaleString()}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-3 h-3" />
        <span>Secured by Stripe • SSL Encrypted</span>
      </div>
    </form>
  );
}

export function CheckoutPage() {
  const [match, params] = useRoute('/checkout/:paymentIntentId');
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [paymentComplete, setPaymentComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadPaymentIntent = async () => {
      if (!params?.paymentIntentId) {
        setError('Invalid payment link');
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiRequest('GET', `/api/campaigns/payment-intent/${params.paymentIntentId}`);
        setPaymentIntent(response);
      } catch (err: any) {
        setError(err.message || 'Failed to load payment information');
        toast({
          title: "Payment Error", 
          description: "Could not load payment details",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPaymentIntent();
  }, [params?.paymentIntentId, toast]);

  if (!match) {
    return <div>Page not found</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading payment details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !paymentIntent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-8 text-center">
            <div className="text-red-500 mb-4">⚠️</div>
            <h3 className="font-semibold mb-2">Payment Error</h3>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Payment Successful!</CardTitle>
            <CardDescription>
              Your {paymentIntent.metadata.offer_name} partnership is now active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">What happens next?</h4>
              <ul className="text-green-700 text-sm space-y-1">
                <li>• Partnership activation within {paymentIntent.metadata.delivery_time}</li>
                <li>• Direct access to {paymentIntent.metadata.targets} verified targets</li>
                <li>• Dedicated success manager assignment</li>
                <li>• Technical integration support</li>
              </ul>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Payment ID: {paymentIntent.id}
              </p>
              <Button asChild>
                <a href="/dashboard">Go to Dashboard</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stripeOptions = {
    clientSecret: paymentIntent.client_secret,
    appearance: {
      theme: 'stripe' as const,
    },
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">1</span>
                </div>
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{paymentIntent.metadata.offer_name}</h3>
                <p className="text-muted-foreground">{paymentIntent.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">{paymentIntent.metadata.targets}</div>
                  <div className="text-xs text-muted-foreground">Verified Targets</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-lg font-bold">{paymentIntent.metadata.delivery_time}</div>
                  <div className="text-xs text-muted-foreground">Delivery Time</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold">${(paymentIntent.amount / 100).toLocaleString()}</span>
                </div>
                <Badge variant="secondary" className="mt-2">
                  {paymentIntent.metadata.campaign_type.toUpperCase()} Partnership
                </Badge>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-blue-800 text-sm font-medium mb-1">
                  <Clock className="w-4 h-4" />
                  Partnership Guarantee
                </div>
                <ul className="text-blue-700 text-xs space-y-1">
                  <li>• Verified delivery within specified timeframe</li>
                  <li>• 100% refund if targets not reached</li>
                  <li>• Blockchain-verified transaction proof</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">2</span>
                </div>
                Payment Information
              </CardTitle>
              <CardDescription>
                Enter your payment details to complete the purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={stripeOptions}>
                <CheckoutForm 
                  paymentIntent={paymentIntent} 
                  onSuccess={() => setPaymentComplete(true)} 
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}