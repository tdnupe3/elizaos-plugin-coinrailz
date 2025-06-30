import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface StripePaymentProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}

export function StripePayment({ amount, onSuccess, onCancel }: StripePaymentProps) {
  const [loading, setLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });
  const { toast } = useToast();

  const createPaymentIntent = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          description: 'P2P Transfer',
          metadata: { type: 'p2p_transfer' }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setPaymentIntent(data.paymentIntent);
      toast({
        title: "Payment Ready",
        description: "Enter your card details to complete the transfer"
      });
    } catch (error) {
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : 'Failed to initialize payment',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentIntent) return;
    
    setLoading(true);
    try {
      // In a real implementation, you would use Stripe Elements or Stripe.js
      // For now, we'll simulate the payment confirmation
      const response = await fetch('/api/stripe/confirm-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          paymentMethod: {
            card: cardDetails,
            billing_details: { name: cardDetails.name }
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      if (data.paymentIntent.status === 'succeeded') {
        toast({
          title: "Payment Successful",
          description: "Your P2P transfer has been processed"
        });
        onSuccess(data.paymentIntent.id);
      } else {
        throw new Error('Payment requires additional authentication');
      }
    } catch (error) {
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : 'Payment processing failed',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Credit/Debit Card Payment</CardTitle>
        <p className="text-sm text-muted-foreground">
          Amount: ${amount.toFixed(2)} USD
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!paymentIntent ? (
          <Button 
            onClick={createPaymentIntent} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Initializing...' : 'Initialize Payment'}
          </Button>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cardName">Cardholder Name</Label>
                <Input
                  id="cardName"
                  placeholder="John Doe"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.number}
                  onChange={(e) => setCardDetails({...cardDetails, number: formatCardNumber(e.target.value)})}
                  maxLength={19}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={cardDetails.expiry}
                    onChange={(e) => setCardDetails({...cardDetails, expiry: formatExpiry(e.target.value)})}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    placeholder="123"
                    value={cardDetails.cvc}
                    onChange={(e) => setCardDetails({...cardDetails, cvc: e.target.value.replace(/[^0-9]/g, '')})}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-2">
              <Button 
                onClick={confirmPayment} 
                disabled={loading || !cardDetails.name || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvc}
                className="flex-1"
              >
                {loading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        )}

        <div className="text-xs text-muted-foreground text-center">
          <p>🔒 Secured by Stripe. Your payment information is encrypted.</p>
          <p>This is a demo interface. In production, Stripe Elements would handle card input securely.</p>
        </div>
      </CardContent>
    </Card>
  );
}