import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { CheckCircle, Copy, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function GptPurchaseSuccess() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    setSessionId(session);

    if (session) {
      pollForStatus(session);
    }
  }, []);

  const pollForStatus = async (session: string) => {
    try {
      const response = await fetch(`/api/gpt/credits/status?session=${session}`);
      const data = await response.json();

      if (data.status === 'completed' && data.apiKey) {
        setStatus('success');
        setApiKey(data.apiKey);
        setCredits(data.credits);
      } else if (data.status === 'pending') {
        setStatus('pending');
        setPollCount(prev => prev + 1);
        if (pollCount < 12) {
          setTimeout(() => pollForStatus(session), 3000);
        }
      } else {
        setStatus('pending');
      }
    } catch (error) {
      setStatus('error');
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full p-8 text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-semibold">Processing your payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your purchase.</p>
          </div>
        )}

        {status === 'success' && (
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
        )}

        {status === 'pending' && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-semibold">Waiting for confirmation...</h2>
            <p className="text-muted-foreground">
              Your payment is being processed. This usually takes a few seconds.
            </p>
            <p className="text-sm text-muted-foreground">
              Attempt {pollCount}/12 - checking again in 3 seconds...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-red-600">Something went wrong</h2>
            <p className="text-muted-foreground">
              We couldn't verify your payment. Please return to ChatGPT and check your status there.
            </p>
            <p className="text-sm">Session ID: <code>{sessionId}</code></p>
            <Button onClick={() => navigate('/credits')} variant="outline" data-testid="button-go-to-credits">
              Go to Credits Page
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
