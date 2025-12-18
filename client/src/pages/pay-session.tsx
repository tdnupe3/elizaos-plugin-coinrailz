import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Copy, CreditCard, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface SessionData {
  clientSecret: string;
  publishableKey: string;
  package: {
    name: string;
    amount: number;
    credits: number;
  };
  status: string;
  apiKey?: string;
  credits?: number;
}

function PaymentForm({ 
  sessionId, 
  onSuccess 
}: { 
  sessionId: string; 
  onSuccess: (apiKey: string, credits: number) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/gpt-purchase-success?session=${sessionId}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    } else if (paymentIntent?.status === 'succeeded') {
      toast({
        title: "Payment Successful!",
        description: "Retrieving your API key...",
      });
      pollForCompletion(sessionId, onSuccess);
    } else {
      setIsProcessing(false);
    }
  };

  const pollForCompletion = async (
    session: string, 
    callback: (apiKey: string, credits: number) => void,
    attempt = 0
  ) => {
    if (attempt > 20) {
      setErrorMessage('Payment confirmed but API key generation is delayed. Please check your status later.');
      setIsProcessing(false);
      return;
    }

    try {
      const response = await fetch(`/api/gpt/credits/status?session=${session}`);
      const data = await response.json();

      if (data.status === 'completed' && data.apiKey) {
        callback(data.apiKey, data.credits);
      } else {
        setTimeout(() => pollForCompletion(session, callback, attempt + 1), 2000);
      }
    } catch {
      setTimeout(() => pollForCompletion(session, callback, attempt + 1), 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border">
        <PaymentElement />
      </div>
      
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <Button 
        type="submit" 
        disabled={!stripe || isProcessing} 
        className="w-full h-12 text-lg"
        data-testid="button-pay-now"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-2" />
            Pay Securely
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Stripe. Your payment info is encrypted.
      </p>
    </form>
  );
}

export default function PaySessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [completed, setCompleted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    fetchSessionData();
  }, [sessionId]);

  const fetchSessionData = async () => {
    try {
      const response = await fetch(`/api/gpt/credits/session/${sessionId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Session not found or expired');
        setLoading(false);
        return;
      }

      if (data.status === 'completed') {
        setCompleted(true);
        setApiKey(data.apiKey);
        setCredits(data.credits);
        setLoading(false);
        return;
      }

      if (data.redirectRequired) {
        window.location.href = `/api/gpt/credits/redirect/${sessionId}`;
        return;
      }

      if (!data.clientSecret || !data.publishableKey) {
        setError('Invalid session configuration');
        setLoading(false);
        return;
      }

      setSessionData(data);
      setStripePromise(loadStripe(data.publishableKey));
      setLoading(false);
    } catch (err) {
      setError('Failed to load payment session');
      setLoading(false);
    }
  };

  const handleSuccess = (key: string, creditCount: number) => {
    setCompleted(true);
    setApiKey(key);
    setCredits(creditCount);
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast({
        title: "API Key Copied",
        description: "Your API key has been copied to clipboard",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-lg font-semibold">Loading payment form...</h2>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Session Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate('/')} variant="outline" data-testid="button-go-home">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  if (completed && apiKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full p-8 text-center">
          <div className="space-y-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Payment Successful!</h2>
            <p className="text-muted-foreground">
              Your purchase is complete. You now have <strong>{credits} credits</strong>.
            </p>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-left">
              <p className="text-sm font-medium mb-2">Your API Key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded text-sm font-mono break-all">
                  {apiKey}
                </code>
                <Button variant="outline" size="icon" onClick={copyApiKey} data-testid="button-copy-api-key">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 text-left text-sm">
              <p className="font-semibold mb-2">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Return to your ChatGPT conversation</li>
                <li>Tell the GPT: "I completed payment"</li>
                <li>It will retrieve your API key automatically</li>
              </ol>
            </div>

            <Button onClick={() => navigate('/credits')} className="w-full" data-testid="button-view-credits">
              <ArrowLeft className="w-4 h-4 mr-2" />
              View Credits Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!sessionData || !stripePromise) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">Complete Your Purchase</h1>
          <p className="text-muted-foreground mt-2">
            {sessionData.package.name.charAt(0).toUpperCase() + sessionData.package.name.slice(1)} Pack - {sessionData.package.credits} credits
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total</span>
            <span className="text-2xl font-bold">${sessionData.package.amount}.00</span>
          </div>
        </div>

        <Elements 
          stripe={stripePromise} 
          options={{ 
            clientSecret: sessionData.clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#3b82f6',
                borderRadius: '8px',
              },
            },
          }}
        >
          <PaymentForm sessionId={sessionId!} onSuccess={handleSuccess} />
        </Elements>
      </Card>
    </div>
  );
}
