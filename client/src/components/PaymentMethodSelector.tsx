import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Send, DollarSign, CheckCircle, Zap } from '@/lib/icons';
import { PayPalPayment } from './PayPalPayment';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface PayPalP2PTransferProps {
  recipientEmail: string;
  amount: number;
  note?: string;
  onSuccess: (result: any) => void;
  onError: (error: string) => void;
}

function PayPalP2PTransfer({ recipientEmail, amount, note, onSuccess, onError }: PayPalP2PTransferProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleP2PTransfer = async () => {
    setIsProcessing(true);
    try {
      const result = await apiRequest('/api/paypal/create-payout', {
        method: 'POST',
        body: {
          recipientEmail,
          amount,
          note
        }
      });

      if (result.success) {
        toast({
          title: "Transfer Initiated",
          description: `$${amount} sent to ${recipientEmail} via PayPal`,
        });
        onSuccess(result);
      } else {
        throw new Error(result.message || 'Transfer failed');
      }
    } catch (error: any) {
      console.error('PayPal P2P transfer error:', error);
      onError(error.message || 'Transfer failed');
      toast({
        title: "Transfer Failed",
        description: error.message || 'Transfer failed',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          PayPal Direct Transfer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          Send money directly to {recipientEmail} via PayPal
        </div>
        <Button 
          onClick={handleP2PTransfer}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? 'Processing...' : `Send $${amount} via PayPal`}
        </Button>
        <div className="text-xs text-center text-gray-500">
          Recipient will receive funds in their PayPal account within 1-3 minutes
        </div>
      </CardContent>
    </Card>
  );
}

interface PaymentMethodSelectorProps {
  amount: number;
  currency?: string;
  description?: string;
  type?: 'p2p_transfer' | 'ai_agent_service' | 'general';
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

function StripePaymentForm({ 
  amount, 
  currency = 'USD', 
  description, 
  type = 'general',
  onSuccess,
  onError 
}: PaymentMethodSelectorProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleStripePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    try {
      setLoading(true);

      // Create payment intent
      const intentData = await apiRequest('POST', '/api/create-payment-intent', {
        amount,
        currency,
        description,
        type
      });

      const { error } = await stripe.confirmCardPayment(intentData.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      });

      if (error) {
        throw new Error(error.message);
      } else {
        toast({
          title: "Payment Successful",
          description: "Your payment has been processed successfully.",
        });
        onSuccess?.({ method: 'stripe', amount, currency });
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Payment failed';
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleStripePayment} className="space-y-4">
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
        disabled={!stripe || loading} 
        className="w-full"
      >
        {loading ? 'Processing...' : `Pay $${amount.toFixed(2)} with Stripe`}
      </Button>
    </form>
  );
}

function USDCPaymentForm({ amount, onSuccess, onError }: PaymentMethodSelectorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch user's USDC balance
  const { data: usdcBalance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/user/circle/balance'],
    enabled: true
  });

  const handleUSDCPayment = async () => {
    setIsProcessing(true);
    try {
      const result = await apiRequest('/api/user/circle/transfer', {
        method: 'POST',
        body: {
          amount: amount,
          currency: 'USD',
          paymentMethod: 'usdc'
        }
      });

      if (result.success) {
        toast({
          title: "USDC Payment Successful",
          description: `$${amount} paid with USDC - Settlement complete!`,
        });
        onSuccess?.(result);
      } else {
        throw new Error(result.error || 'USDC payment failed');
      }
    } catch (error: any) {
      console.error('USDC payment error:', error);
      onError?.(error.message || 'USDC payment failed');
      toast({
        title: "USDC Payment Failed",
        description: error.message || 'Payment failed',
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const usdcFee = amount * 0.0125; // 1.25% total fee
  const totalAmount = amount + usdcFee;
  const traditionalFee = amount * 0.045; // 4.5% traditional fee
  const savings = traditionalFee - usdcFee;
  const savingsPercent = ((savings / traditionalFee) * 100).toFixed(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <DollarSign className="h-5 w-5" />
          Pay with USDC
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Available Balance</h4>
              <p className="text-2xl font-bold text-blue-700">
                {balanceLoading ? "Loading..." : `$${usdcBalance?.balance || '0.00'} USDC`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-green-600 font-medium">
                Save {savingsPercent}%
              </div>
              <div className="text-sm text-gray-600">
                vs traditional methods
              </div>
            </div>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Payment Amount:</span>
            <span>${amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>USDC Fee (1.25%):</span>
            <span>${usdcFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2 font-medium">
            <span>Total:</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-2">
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>Instant settlement (3-5 seconds)</span>
          </div>
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>72% cheaper than traditional methods</span>
          </div>
          <div className="flex items-center text-sm text-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>Global compatibility</span>
          </div>
        </div>

        {/* Payment Button */}
        <Button 
          onClick={handleUSDCPayment}
          disabled={isProcessing || balanceLoading || (usdcBalance?.balance || 0) < totalAmount}
          className="w-full bg-blue-600 hover:bg-blue-700"
          size="lg"
        >
          {isProcessing ? (
            "Processing USDC Payment..."
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Pay ${totalAmount.toFixed(2)} with USDC
            </>
          )}
        </Button>

        {(usdcBalance?.balance || 0) < totalAmount && !balanceLoading && (
          <div className="text-sm text-red-600 text-center">
            Insufficient USDC balance. 
            <a href="/usdc-buy" className="text-blue-600 hover:underline ml-1">
              Buy more USDC
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentMethodSelector(props: PaymentMethodSelectorProps) {
  const { amount, currency = 'USD', description } = props;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Choose Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">{description || 'Payment'}</span>
            <span className="font-bold text-lg">${amount.toFixed(2)} {currency}</span>
          </div>
        </div>

        <Tabs defaultValue="usdc" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="usdc" className="flex items-center gap-2 bg-blue-50 text-blue-700 border-blue-200">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor">USDC</text>
              </svg>
              USDC (72% Savings)
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Credit/Debit Card
            </TabsTrigger>
            <TabsTrigger value="paypal" className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.1-.025c-.687-.162-1.413-.24-2.16-.24h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106h4.61c2.57 0 4.578-.543 5.69-1.81 1.01-1.15 1.304-2.42 1.012-4.287-.292-1.866-1.048-3.228-2.42-4.15-1.33-.895-3.117-1.344-5.272-1.344z"/>
              </svg>
              PayPal
            </TabsTrigger>
            <TabsTrigger value="bank_transfer" className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-8H4V6h16v4z"/>
              </svg>
              Bank Transfer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usdc" className="mt-6">
            <USDCPaymentForm {...props} />
          </TabsContent>

          <TabsContent value="stripe" className="mt-6">
            <Elements stripe={stripePromise}>
              <StripePaymentForm {...props} />
            </Elements>
          </TabsContent>

          <TabsContent value="paypal" className="mt-6">
            <PayPalPayment {...props} />
          </TabsContent>
          <TabsContent value="bank_transfer" className="mt-6">
              <div>
                  <p>
                      To complete the payment, please send the funds to the bank account details
                      provided. Once the transfer is confirmed, your service will be activated.
                  </p>
                  <p>
                      Bank Name: [Your Bank Name]
                      Account Number: [Your Account Number]
                      Routing Number: [Your Routing Number]
                  </p>
              </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}