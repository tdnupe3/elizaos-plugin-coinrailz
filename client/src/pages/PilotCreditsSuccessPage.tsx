import { useEffect, useState } from "react";
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
  ExternalLink
} from "lucide-react";

interface PurchaseResult {
  success: boolean;
  credits: number;
  amount: number;
  tierId: string;
  userId?: string;
  balance?: number;
  transactionId?: string;
}

export default function PilotCreditsSuccessPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<PurchaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const confirmPurchase = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        setError("No session ID found. Please try your purchase again.");
        setIsLoading(false);
        return;
      }

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

    confirmPurchase();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

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
                  <h3 className="text-white font-medium mb-1">Complete Onboarding</h3>
                  <p className="text-slate-400 text-sm">
                    Set up your company profile and get your API keys
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Integrate the API</h3>
                  <p className="text-slate-400 text-sm">
                    Use our SDK or REST API to query IoT device data
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-slate-700/30 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Start Querying</h3>
                  <p className="text-slate-400 text-sm">
                    Your AI agents can now access fleet and weather data
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={() => setLocation("/pilot/onboard")}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            Complete Onboarding
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
