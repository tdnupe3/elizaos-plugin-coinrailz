import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PayPalPaymentProps {
  amount: number;
  currency?: string;
  description?: string;
  type?: 'p2p_transfer' | 'ai_agent_service' | 'general';
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function PayPalPayment({
  amount,
  currency = 'USD',
  description,
  type = 'general',
  onSuccess,
  onError
}: PayPalPaymentProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayPalPayment = async () => {
    try {
      setLoading(true);

      // Create PayPal order
      const orderData = await apiRequest('POST', '/api/paypal/create-order', {
        amount,
        currency,
        description,
        type
      });

      if (orderData.approvalUrl) {
        // Redirect to PayPal for approval
        window.location.href = orderData.approvalUrl;
      } else {
        throw new Error('Failed to create PayPal order');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'PayPal payment failed';
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
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.1-.025c-.687-.162-1.413-.24-2.16-.24h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106h4.61c2.57 0 4.578-.543 5.69-1.81 1.01-1.15 1.304-2.42 1.012-4.287-.292-1.866-1.048-3.228-2.42-4.15-1.33-.895-3.117-1.344-5.272-1.344z"/>
          </svg>
          PayPal Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <Label className="font-medium">Amount</Label>
            <span className="font-bold">${amount.toFixed(2)} {currency}</span>
          </div>
          {description && (
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          )}
        </div>

        <Button 
          onClick={handlePayPalPayment}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? 'Processing...' : 'Pay with PayPal'}
        </Button>

        <div className="text-xs text-center text-gray-500">
          You will be redirected to PayPal to complete your payment securely
        </div>
      </CardContent>
    </Card>
  );
}