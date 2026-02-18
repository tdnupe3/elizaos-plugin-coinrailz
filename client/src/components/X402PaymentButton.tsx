/**
 * x402 Protocol Payment Button
 * Autonomous AI Agent Payment Option
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface X402PaymentButtonProps {
  amount: number;
  agentId: string;
  serviceDescription: string;
  onSuccess?: (paymentResult: any) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

export function X402PaymentButton({
  amount,
  agentId,
  serviceDescription,
  onSuccess,
  onError,
  disabled = false,
}: X402PaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'completed' | 'failed'>('idle');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const { toast } = useToast();

  const handleX402Payment = async () => {
    setIsProcessing(true);
    setPaymentStatus('pending');

    try {
      // Create x402 payment
      const response = await fetch('/api/x402/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          agentId,
          serviceDescription,
          network: 'base',
          currency: 'USDC',
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error('x402 payment creation failed');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Payment failed');
      }

      // Payment created successfully
      setWalletAddress(result.walletAddress);
      setPaymentStatus('completed');

      toast({
        title: 'x402 Payment Created',
        description: `Send ${amount} USDC to complete payment autonomously`,
      });

      onSuccess?.(result);
    } catch (error) {
      console.error('x402 payment error:', error);
      setPaymentStatus('failed');

      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'x402 payment failed',
        variant: 'destructive',
      });

      onError?.(error instanceof Error ? error : new Error('Payment failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonContent = () => {
    if (isProcessing) {
      return (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      );
    }

    if (paymentStatus === 'completed') {
      return (
        <>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Payment Created
        </>
      );
    }

    if (paymentStatus === 'failed') {
      return (
        <>
          <XCircle className="mr-2 h-4 w-4" />
          Failed - Retry
        </>
      );
    }

    return (
      <>
        <Zap className="mr-2 h-4 w-4" />
        Pay ${amount} USDC via x402
      </>
    );
  };

  return (
    <div className="space-y-3" data-testid="x402-payment-container">
      <Button
        onClick={handleX402Payment}
        disabled={disabled || isProcessing || paymentStatus === 'completed'}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        data-testid="button-x402-payment"
      >
        {getButtonContent()}
      </Button>

      {/* x402 Benefits Badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Zap className="h-3 w-3 text-yellow-500" />
        <span>
          Autonomous Payment • 2s Settlement • Ethereum & Base • No KYC
        </span>
      </div>

      {/* Payment Instructions (when payment created) */}
      {paymentStatus === 'completed' && walletAddress && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 space-y-2">
          <h4 className="font-semibold text-sm">Payment Address:</h4>
          <code className="block w-full overflow-x-auto text-xs bg-white dark:bg-black p-2 rounded border">
            {walletAddress}
          </code>
          <p className="text-xs text-muted-foreground">
            Send <strong>{amount} USDC</strong> on <strong>Ethereum or Base</strong> to complete payment
          </p>
        </div>
      )}
    </div>
  );
}
