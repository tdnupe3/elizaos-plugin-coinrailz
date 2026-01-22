import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { 
  Zap, 
  ArrowRight, 
  CheckCircle,
  CreditCard,
  Calculator,
  Cpu,
  Cloud,
  Truck,
  Shield,
  ArrowLeft,
  Loader2,
  Wallet,
  Copy,
  ExternalLink,
  Clock
} from "lucide-react";

interface CreditsTier {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: string;
  description: string;
  features: string[];
  popular?: boolean;
}

const creditsTiers: CreditsTier[] = [
  {
    id: "starter",
    name: "Starter Pilot",
    credits: 500,
    price: 500,
    pricePerCredit: "$1.00",
    description: "Test the platform with real IoT data",
    features: [
      "$500 in prepaid credits",
      "~50,000 weather queries",
      "~10,000 fleet data points",
      "API key + dashboard access",
      "Email support"
    ]
  },
  {
    id: "growth",
    name: "Growth Pilot",
    credits: 1000,
    price: 1000,
    pricePerCredit: "$1.00",
    description: "Scale your AI agent's data consumption",
    features: [
      "$1,000 in prepaid credits",
      "~100,000 weather queries",
      "~20,000 fleet data points",
      "Priority API access",
      "Slack support channel"
    ],
    popular: true
  },
  {
    id: "enterprise",
    name: "Enterprise Pilot",
    credits: 2500,
    price: 2500,
    pricePerCredit: "$1.00",
    description: "Full integration with dedicated support",
    features: [
      "$2,500 in prepaid credits",
      "~250,000 weather queries",
      "~50,000 fleet data points",
      "Dedicated account manager",
      "Custom data feeds",
      "SLA guarantee"
    ]
  }
];

const SUPPORTED_CHAINS = [
  { id: 'base-mainnet', name: 'Base', icon: '🔵', network: 'DIMO operators' },
  { id: 'polygon-mainnet', name: 'Polygon', icon: '💜', network: 'DIMO fleet' },
  { id: 'arbitrum-mainnet', name: 'Arbitrum', icon: '🔷', network: 'WeatherXM' },
];

const SUPPORTED_TOKENS = [
  { id: 'USDC', name: 'USDC', color: 'text-blue-400' },
  { id: 'USDT', name: 'USDT', color: 'text-green-400' },
];

interface CryptoPaymentIntent {
  paymentId: string;
  depositAddress: string;
  chain: string;
  token: string;
  amount: number;
  credits: number;
  expiresAt: string;
}

export default function PilotCreditsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [queryCount, setQueryCount] = useState<string>("10000");
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
  const [selectedChain, setSelectedChain] = useState('base-mainnet');
  const [selectedToken, setSelectedToken] = useState('USDC');
  const [email, setEmail] = useState('');
  const [cryptoModalOpen, setCryptoModalOpen] = useState(false);
  const [cryptoPayment, setCryptoPayment] = useState<CryptoPaymentIntent | null>(null);
  const [selectedTier, setSelectedTier] = useState<CreditsTier | null>(null);
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSEO({
    title: "Buy Pilot Credits | IoT Data for AI Agents | Coin Railz",
    description: "Purchase prepaid credits to access real-time IoT data for your AI agents. Fleet telematics, weather sensors, and more. Pay only for what you use.",
    keywords: "AI agent data, IoT data API, fleet telematics API, weather data API, machine-to-machine payments, x402 protocol",
    canonical: "https://coinrailz.com/pilots/buy",
    ogTitle: "Buy Pilot Credits | IoT Data for AI Agents",
    ogDescription: "Prepaid credits for AI agents to access real-time IoT device data. Fleet, weather, and sensor data on-demand."
  });

  const calculateCost = (queries: number): { weatherCost: string; fleetCost: string } => {
    const weatherRate = 0.01;
    const fleetRate = 0.05;
    return {
      weatherCost: (queries * weatherRate).toFixed(2),
      fleetCost: (queries * fleetRate).toFixed(2)
    };
  };

  const costs = calculateCost(parseInt(queryCount) || 0);

  const handlePurchase = async (tier: CreditsTier) => {
    if (paymentMethod === 'crypto') {
      setSelectedTier(tier);
      setCryptoModalOpen(true);
      return;
    }

    setIsLoading(tier.id);
    try {
      const response = await fetch("/api/stripe/pilot-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: tier.id,
          credits: tier.credits,
          amount: tier.price,
          successUrl: `${window.location.origin}/pilots/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pilots/buy`
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create checkout session");
      }

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Unable to start checkout. Please try again.",
        variant: "destructive"
      });
      setIsLoading(null);
    }
  };

  const handleCryptoPayment = async () => {
    if (!selectedTier || !email) {
      toast({
        title: "Email Required",
        description: "Please enter your email to receive your API key.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading('crypto');
    try {
      const response = await fetch("/api/stripe/pilot-credits/crypto-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId: selectedTier.id,
          chain: selectedChain,
          token: selectedToken,
          email
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create crypto payment");
      }

      const data = await response.json();
      setCryptoPayment(data);
    } catch (error: any) {
      console.error("Crypto payment error:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Unable to create crypto payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const handleSubmitTxHash = async () => {
    if (!cryptoPayment || !txHash) {
      toast({
        title: "Transaction Hash Required",
        description: "Please enter the transaction hash from your wallet.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/stripe/pilot-credits/crypto-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: cryptoPayment.paymentId,
          txHash: txHash.trim()
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit transaction");
      }

      toast({
        title: "Transaction Submitted!",
        description: "We're verifying your payment. Credits will be added within 2-5 minutes.",
      });

      setCryptoModalOpen(false);
      setCryptoPayment(null);
      setTxHash('');
      setLocation('/pilots/success?payment=crypto');
    } catch (error: any) {
      console.error("Submit txHash error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/iot")}
          className="text-slate-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to IoT Hub
        </Button>

        <div className="text-center mb-12">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4">
            <Zap className="w-3 h-3 mr-1" />
            Prepaid Credits
          </Badge>
          <h1 className="text-4xl font-bold text-white mb-4">
            IoT Data for AI Agents
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Buy prepaid credits to access real-time fleet telematics, weather sensors, 
            and device data. Your AI agents pay per-query via x402 protocol.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                Fleet Telematics
              </CardTitle>
              <CardDescription className="text-slate-400">
                GPS, driver behavior, diagnostics, ELD compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300">
              <div className="flex items-center justify-between">
                <span>Per data point:</span>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                  $0.05
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-cyan-400" />
                Weather Data
              </CardTitle>
              <CardDescription className="text-slate-400">
                Temperature, humidity, pressure, wind, precipitation
              </CardDescription>
            </CardHeader>
            <CardContent className="text-slate-300">
              <div className="flex items-center justify-between">
                <span>Per reading:</span>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                  $0.01
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-12">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              Usage Calculator
            </CardTitle>
            <CardDescription className="text-slate-400">
              Estimate how many queries your credits will cover
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label className="text-slate-300">Number of queries</Label>
                <Input 
                  type="number" 
                  value={queryCount}
                  onChange={(e) => setQueryCount(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                  min="0"
                />
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Weather data cost</div>
                <div className="text-2xl font-bold text-cyan-400">${costs.weatherCost}</div>
                <div className="text-xs text-slate-500">@ $0.01/query</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-1">Fleet data cost</div>
                <div className="text-2xl font-bold text-blue-400">${costs.fleetCost}</div>
                <div className="text-xs text-slate-500">@ $0.05/query</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-2xl font-bold text-white text-center mb-4">
          Choose Your Pilot Package
        </h2>

        <div className="flex justify-center gap-4 mb-8">
          <Button
            variant={paymentMethod === 'card' ? 'default' : 'outline'}
            onClick={() => setPaymentMethod('card')}
            className={paymentMethod === 'card' 
              ? 'bg-emerald-600 hover:bg-emerald-700' 
              : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pay with Card
          </Button>
          <Button
            variant={paymentMethod === 'crypto' ? 'default' : 'outline'}
            onClick={() => setPaymentMethod('crypto')}
            className={paymentMethod === 'crypto' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Pay with USDC/USDT
          </Button>
        </div>

        {paymentMethod === 'crypto' && (
          <Card className="bg-blue-900/30 border-blue-500/30 mb-8">
            <CardContent className="py-4">
              <p className="text-blue-300 text-center text-sm">
                💡 Pay with the stablecoins you already have. No bridging needed - we accept on the same chain as your DePIN network.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {creditsTiers.map((tier) => (
            <Card 
              key={tier.id}
              className={`bg-slate-800/50 border-slate-700 relative ${
                tier.popular ? 'ring-2 ring-emerald-500' : ''
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-white text-xl">{tier.name}</CardTitle>
                <CardDescription className="text-slate-400">
                  {tier.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${tier.price}</span>
                  <span className="text-slate-400 ml-2">USD</span>
                </div>
                
                <div className="bg-slate-700/50 rounded-lg p-3 mb-6">
                  <div className="text-emerald-400 font-semibold">
                    ${tier.credits} in credits
                  </div>
                </div>

                <ul className="text-left space-y-3 mb-6">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full ${
                    tier.popular 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                  onClick={() => handlePurchase(tier)}
                  disabled={isLoading !== null}
                >
                  {isLoading === tier.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Buy Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div>
                <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Secure Payments</h3>
                <p className="text-slate-400 text-sm">
                  Powered by Stripe. Your payment info never touches our servers.
                </p>
              </div>
              <div>
                <Cpu className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">x402 Protocol</h3>
                <p className="text-slate-400 text-sm">
                  Industry-standard HTTP 402 micropayments for machine-to-machine commerce.
                </p>
              </div>
              <div>
                <Zap className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Instant Access</h3>
                <p className="text-slate-400 text-sm">
                  Credits available immediately after payment. Start querying in minutes.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <p className="text-slate-400 mb-4">
            Already have an account?{" "}
            <button 
              onClick={() => setLocation("/pilot/onboard")}
              className="text-emerald-400 hover:text-emerald-300 underline"
            >
              Complete your pilot onboarding
            </button>
          </p>
          <p className="text-slate-500 text-sm">
            Questions? Contact us at{" "}
            <a href="mailto:pilots@coinrailz.com" className="text-emerald-400 hover:text-emerald-300">
              pilots@coinrailz.com
            </a>
          </p>
        </div>
      </div>

      <Dialog open={cryptoModalOpen} onOpenChange={(open) => {
        setCryptoModalOpen(open);
        if (!open) {
          setCryptoPayment(null);
          setSelectedTier(null);
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              Pay with Stablecoins
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedTier && `${selectedTier.name} - $${selectedTier.price} (${selectedTier.credits} credits)`}
            </DialogDescription>
          </DialogHeader>

          {!cryptoPayment ? (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Your Email</Label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white mt-2"
                />
              </div>

              <div>
                <Label className="text-slate-300">Network</Label>
                <Select value={selectedChain} onValueChange={setSelectedChain}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {SUPPORTED_CHAINS.map((chain) => (
                      <SelectItem key={chain.id} value={chain.id} className="text-white hover:bg-slate-600">
                        {chain.icon} {chain.name} ({chain.network})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Token</Label>
                <Select value={selectedToken} onValueChange={setSelectedToken}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {SUPPORTED_TOKENS.map((token) => (
                      <SelectItem key={token.id} value={token.id} className="text-white hover:bg-slate-600">
                        {token.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCryptoPayment}
                disabled={isLoading === 'crypto' || !email}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading === 'crypto' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Payment...
                  </>
                ) : (
                  <>
                    Generate Deposit Address
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="text-sm text-slate-400 mb-2">Send exactly:</div>
                <div className="text-3xl font-bold text-white">
                  {cryptoPayment.amount} {cryptoPayment.token}
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  on {SUPPORTED_CHAINS.find(c => c.id === cryptoPayment.chain)?.name}
                </div>
              </div>

              <div>
                <Label className="text-slate-300 mb-2 block">Deposit Address:</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-700 p-3 rounded text-sm text-emerald-400 font-mono break-all">
                    {cryptoPayment.depositAddress}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(cryptoPayment.depositAddress)}
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <Clock className="w-4 h-4" />
                Expires in 30 minutes
              </div>

              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-300">
                <p className="font-semibold mb-2">After sending:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy the transaction hash from your wallet</li>
                  <li>Paste it below to confirm your payment</li>
                  <li>Credits will be added within 2-5 minutes</li>
                </ol>
              </div>

              <div>
                <Label className="text-slate-300 mb-2 block">Transaction Hash:</Label>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleSubmitTxHash}
                disabled={isSubmitting || !txHash}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Payment
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setCryptoPayment(null);
                  setCryptoModalOpen(false);
                  setTxHash('');
                }}
                className="w-full text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
