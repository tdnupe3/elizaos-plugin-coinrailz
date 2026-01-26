import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle,
  ArrowRight,
  Loader2,
  CreditCard,
  Zap,
  Copy,
  ExternalLink,
  Clock
} from "lucide-react";

interface PurchaseResult {
  success: boolean;
  credits: number;
  amount: number;
  tierId: string;
  userId?: string;
  balance?: number;
  transactionId?: string;
  apiKey?: string;
  keyPrefix?: string;
}

interface CryptoStatus {
  status: 'pending' | 'confirming' | 'completed' | 'failed' | 'expired';
  chain?: string;
  token?: string;
  credits?: number;
  expectedAmount?: string;
}

export default function PilotCreditsSuccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<CryptoStatus | null>(null);
  const [isCryptoPayment, setIsCryptoPayment] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentType = urlParams.get("payment");
    const cryptoPaymentId = urlParams.get("id");
    const sessionId = urlParams.get("session_id");

    if (paymentType === "crypto" && cryptoPaymentId) {
      setIsCryptoPayment(true);
      pollCryptoStatus(cryptoPaymentId);
    } else if (sessionId) {
      confirmStripePurchase(sessionId);
    } else {
      setError("No payment information found. Please try your purchase again.");
      setIsLoading(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const pollCryptoStatus = async (paymentId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/stripe/pilot-credits/crypto-status/${paymentId}`);
        if (!response.ok) throw new Error("Failed to check payment status");
        
        const data = await response.json();
        setCryptoStatus(data);
        setIsLoading(false);

        if (data.status === 'completed') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setResult({
            success: true,
            credits: data.credits,
            amount: parseFloat(data.expectedAmount || '0'),
            tierId: 'crypto',
            transactionId: paymentId
          });
          toast({
            title: "Payment Confirmed!",
            description: `${data.credits} credits have been added to your account.`
          });
        } else if (data.status === 'failed' || data.status === 'expired') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          // Use server-provided failure reason which includes recovery instructions
          setError(data.failureReason || (data.status === 'expired' 
            ? "Payment window expired. If you already sent funds, please contact support@coinrailz.com with your payment ID." 
            : "Payment verification failed. Please contact support@coinrailz.com."));
        }
      } catch (err: any) {
        console.error("Status check error:", err);
      }
    };

    await checkStatus();
    pollIntervalRef.current = setInterval(checkStatus, 10000); // Poll every 10 seconds
  };

  const confirmStripePurchase = async (sessionId: string) => {
    try {
      const response = await fetch("/api/stripe/pilot-credits/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to confirm purchase");
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error("Confirmation error:", err);
      setError(err.message || "Failed to confirm your purchase. Please contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  // Crypto payment pending state - show waiting UI
  if (isCryptoPayment && cryptoStatus && (cryptoStatus.status === 'pending' || cryptoStatus.status === 'confirming')) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
              {cryptoStatus.status === 'confirming' ? 'Confirming Transaction' : 'Waiting for Payment'}
            </Badge>
            <h2 className="text-xl font-semibold text-white mb-2">
              {cryptoStatus.status === 'confirming' ? 'Transaction Detected!' : 'Watching for Your Payment'}
            </h2>
            <p className="text-slate-400 mb-6">
              {cryptoStatus.status === 'confirming' 
                ? 'We found your transaction and are confirming it on-chain...' 
                : `We're automatically scanning for your ${cryptoStatus.token || 'USDC'} transfer...`}
            </p>
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <div className="text-sm text-slate-400 mb-1">Expected Amount</div>
              <div className="text-2xl font-bold text-white">
                {cryptoStatus.expectedAmount} {cryptoStatus.token || 'USDC'}
              </div>
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking for your payment...
              </div>
              <p className="text-slate-500 text-xs">
                Verification can take up to 5 minutes. You can leave this page - we'll credit your account automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Confirming Your Purchase
            </h2>
            <p className="text-slate-400">
              Please wait while we process your payment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Something Went Wrong
            </h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline" 
                onClick={() => setLocation("/pilots/buy")}
                className="border-slate-600"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = "mailto:support@coinrailz.com"}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4">
            <Zap className="w-3 h-3 mr-1" />
            Purchase Complete
          </Badge>
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to Your Pilot!
          </h1>
          <p className="text-slate-400">
            Your credits have been added to your account
          </p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Purchase Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Package</span>
              <span className="text-white font-medium capitalize">
                {result?.tierId || "Pilot"} Credits
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Amount Paid</span>
              <span className="text-white font-medium">
                ${result?.amount?.toFixed(2) || "0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Credits Added</span>
              <span className="text-emerald-400 font-bold text-xl">
                ${result?.credits?.toFixed(2) || "0.00"}
              </span>
            </div>
            {result?.balance !== undefined && (
              <div className="flex justify-between items-center py-3 bg-slate-700/30 rounded-lg px-4">
                <span className="text-slate-300">New Balance</span>
                <span className="text-emerald-400 font-bold text-2xl">
                  ${result.balance.toFixed(2)}
                </span>
              </div>
            )}
            {result?.transactionId && (
              <div className="flex justify-between items-center py-3">
                <span className="text-slate-400">Transaction ID</span>
                <button
                  onClick={() => handleCopy(result.transactionId!, "Transaction ID")}
                  className="flex items-center gap-2 text-slate-300 hover:text-white"
                >
                  <span className="font-mono text-sm">
                    {result.transactionId.slice(0, 8)}...
                  </span>
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {result?.apiKey && (
          <Card className="bg-emerald-900/30 border-emerald-500/50 mb-6">
            <CardHeader>
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Your API Key (Ready to Use!)
              </CardTitle>
              <CardDescription className="text-slate-300">
                This key is automatically generated and linked to your credits. Save it securely - you'll need it to access satellite and IoT data APIs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-900/80 rounded-lg p-4 font-mono text-sm break-all">
                <div className="flex items-center justify-between gap-4">
                  <code className="text-emerald-300 flex-1">{result.apiKey}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(result.apiKey!, "API Key")}
                    className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 flex-shrink-0"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
              <p className="text-amber-400/80 text-sm mt-3 flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                Save this key now! For security, we cannot show it again.
              </p>
              <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
                <p className="text-slate-300 text-sm font-medium mb-2">Quick Start:</p>
                <code className="text-xs text-slate-400 block">
                  curl -H "X-API-Key: {result.apiKey?.slice(0, 15)}..." \<br/>
                  &nbsp;&nbsp;https://coinrailz.com/api/satellite/fire-alerts
                </code>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Next Steps</CardTitle>
            <CardDescription className="text-slate-400">
              Get started with your IoT data integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 font-bold">1</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">{result?.apiKey ? "Copy Your API Key (Above)" : "Get Your API Key"}</h3>
                  <p className="text-slate-400 text-sm">
                    {result?.apiKey 
                      ? "Your API key is ready to use - copy it from the green box above" 
                      : "Visit the dashboard to generate your API key"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Make Your First API Call</h3>
                  <p className="text-slate-400 text-sm">
                    Add X-API-Key header to access satellite, fleet, or weather data
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Monitor Usage</h3>
                  <p className="text-slate-400 text-sm">
                    Track your credit balance and API usage in the dashboard
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => setLocation("/satellite")}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Explore Satellite APIs
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation("/iot/dashboard")}
            className="flex-1 border-slate-600 text-slate-300 hover:text-white"
          >
            View Dashboard
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          Need help? Contact{" "}
          <a href="mailto:pilots@coinrailz.com" className="text-emerald-400 hover:text-emerald-300">
            pilots@coinrailz.com
          </a>
        </p>
      </div>
    </div>
  );
}
