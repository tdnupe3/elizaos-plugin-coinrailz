import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/lib/icons';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  fees: string;
  processingTime: string;
  supported: boolean;
}

interface PaymentOptionsProps {
  orderId: string;
  amount: number;
  agentId: string;
  onPaymentComplete: (paymentId: string) => void;
}

export default function PaymentOptions({ orderId, amount, agentId, onPaymentComplete }: PaymentOptionsProps) {
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [clientSecret, setClientSecret] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get available payment methods
  const { data: paymentMethods, isLoading } = useQuery({
    queryKey: ['/api/payments/methods'],
    queryFn: () => apiRequest('GET', '/api/payments/methods')
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: (paymentData: any) => apiRequest('POST', '/api/payments/create-payment', paymentData),
    onSuccess: (data: any) => {
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
      if (data.paypalOrderId) {
        // Handle PayPal redirect
        window.location.href = `https://www.paypal.com/checkoutnow?token=${data.paypalOrderId}`;
      }
      toast({
        title: "Payment Initiated",
        description: `Payment started with ${selectedMethod}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to create payment",
        variant: "destructive",
      });
    }
  });

  const handlePaymentMethodSelect = async (methodId: string) => {
    setSelectedMethod(methodId);
    
    try {
      await createPaymentMutation.mutateAsync({
        orderId,
        amount,
        currency: 'USD',
        paymentMethod: methodId,
        agentId
      });
    } catch (error) {
      console.error('Payment creation error:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Choose Payment Method</h2>
        <p className="text-muted-foreground">
          Order Amount: <span className="font-bold">${amount.toFixed(2)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Platform Fee (15%): ${(amount * 0.15).toFixed(2)} | 
          Agent Receives (85%): ${(amount * 0.85).toFixed(2)}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {paymentMethods?.methods?.map((method: PaymentMethod) => (
          <Card 
            key={method.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedMethod === method.id ? 'ring-2 ring-primary' : ''
            } ${!method.supported ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={() => method.supported && handlePaymentMethodSelect(method.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {method.id === 'stripe' && <Icons.CreditCard className="h-5 w-5" />}
                  {method.id === 'paypal' && <Icons.Wallet className="h-5 w-5" />}
                  {method.id === 'circle_usdc' && <Icons.DollarSign className="h-5 w-5" />}
                  {method.id === 'crypto' && <Icons.Bitcoin className="h-5 w-5" />}
                  {method.name}
                </CardTitle>
                {method.supported ? (
                  <Badge variant="default">Available</Badge>
                ) : (
                  <Badge variant="secondary">Coming Soon</Badge>
                )}
              </div>
              <CardDescription>{method.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fees:</span>
                  <span>{method.fees}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing:</span>
                  <span>{method.processingTime}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stripe Payment Form */}
      {selectedMethod === 'stripe' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <StripePaymentForm 
            onPaymentComplete={onPaymentComplete}
            amount={amount}
          />
        </Elements>
      )}

      {/* Circle USDC Instructions */}
      {selectedMethod === 'circle_usdc' && (
        <Card>
          <CardHeader>
            <CardTitle>USDC Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>Send <strong>${amount} USDC</strong> to the wallet address below:</p>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                0x1234567890abcdef1234567890abcdef12345678
              </div>
              <Button 
                onClick={() => navigator.clipboard.writeText('0x1234567890abcdef1234567890abcdef12345678')}
                variant="outline"
                className="w-full"
              >
                Copy Wallet Address
              </Button>
              <p className="text-sm text-muted-foreground">
                After sending the payment, it will be automatically detected and processed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crypto Payment Instructions */}
      {selectedMethod === 'crypto' && (
        <Card>
          <CardHeader>
            <CardTitle>Cryptocurrency Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>Connect your wallet to pay with cryptocurrency:</p>
              <Button className="w-full" size="lg">
                <Icons.Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
              <p className="text-sm text-muted-foreground">
                Supported: ETH, BTC, and other major cryptocurrencies
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Stripe Payment Form Component
function StripePaymentForm({ onPaymentComplete, amount }: { onPaymentComplete: (paymentId: string) => void; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required'
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      toast({
        title: "Payment Successful",
        description: `Payment of $${amount.toFixed(2)} completed successfully!`,
      });
      onPaymentComplete(paymentIntent.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete Payment</CardTitle>
        <CardDescription>
          Enter your payment details to complete the transaction
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          <Button 
            type="submit" 
            className="w-full" 
            disabled={!stripe || isProcessing}
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              `Pay $${amount.toFixed(2)}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}