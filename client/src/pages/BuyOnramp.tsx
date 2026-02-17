import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Shield,
  Zap,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Wallet,
  DollarSign,
  Globe,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";

const NETWORKS = [
  { id: "ethereum", name: "Ethereum", icon: "ETH", color: "#627EEA" },
  { id: "base", name: "Base", icon: "BASE", color: "#0052FF" },
  { id: "polygon", name: "Polygon", icon: "POL", color: "#8247E5" },
  { id: "arbitrum", name: "Arbitrum", icon: "ARB", color: "#28A0F0" },
  { id: "optimism", name: "Optimism", icon: "OP", color: "#FF0420" },
  { id: "tron", name: "Tron", icon: "TRX", color: "#FF0013" },
];

const TOKENS = [
  { id: "USDC", name: "USDC", description: "USD Coin" },
  { id: "USDT", name: "USDT", description: "Tether" },
];

function InlineAuth({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", password: "", firstName: "", lastName: "", confirmPassword: "" });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (response: any) => {
      if (response.token) localStorage.setItem("auth_token", response.token);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You're now signed in." });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Sign-in failed", description: error.message || "Please check your credentials.", variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: (response: any) => {
      if (response.token) localStorage.setItem("auth_token", response.token);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Account created!", description: "Welcome to Coin Railz." });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <Card className="bg-white dark:bg-gray-900 shadow-lg border-2 border-blue-100 dark:border-blue-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-center">Sign in to continue</CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Create a free account or sign in to buy crypto</p>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" placeholder="you@example.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" type="password" placeholder="Your password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
            </div>
            <Button className="w-full h-12 text-lg" onClick={() => loginMutation.mutate(loginData)} disabled={loginMutation.isPending || !loginData.email || !loginData.password}>
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </TabsContent>

          <TabsContent value="register" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="reg-first">First Name</Label>
                <Input id="reg-first" placeholder="First name" value={registerData.firstName} onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="reg-last">Last Name</Label>
                <Input id="reg-last" placeholder="Last name" value={registerData.lastName} onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="reg-email">Email</Label>
              <Input id="reg-email" type="email" placeholder="you@example.com" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="reg-password">Password</Label>
              <Input id="reg-password" type="password" placeholder="Min. 8 characters" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="reg-confirm">Confirm Password</Label>
              <Input id="reg-confirm" type="password" placeholder="Confirm password" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} />
            </div>
            <Button
              className="w-full h-12 text-lg"
              onClick={() => registerMutation.mutate(registerData)}
              disabled={registerMutation.isPending || !registerData.email || !registerData.password || registerData.password !== registerData.confirmPassword}
            >
              {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Create Account
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function QuoteDisplay({ amount, token }: { amount: number; token: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/onramp/transak/quote", amount, token],
    queryFn: async () => {
      const res = await fetch(`/api/onramp/transak/quote?amount=${amount}&token=${token}`);
      if (!res.ok) throw new Error("Failed to get quote");
      return res.json();
    },
    enabled: amount >= 10 && amount <= 2500,
    refetchInterval: 30000,
  });

  const quote = (data as any)?.quote;

  if (!amount || amount < 10) return null;
  if (isLoading) return <div className="text-sm text-gray-400 animate-pulse">Getting price...</div>;
  if (!quote) return null;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">You pay</span>
        <span className="font-semibold">${amount.toFixed(2)} USD</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Coin Railz fee (3%)</span>
        <span className="text-gray-600">-${quote.coinrailzFee.toFixed(2)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Processing fee (est.)</span>
        <span className="text-gray-600">-${(quote.estimatedProcessingFee ?? quote.estimatedTransakFee ?? 0).toFixed(2)}</span>
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
        <span className="font-semibold text-green-600">You receive (est.)</span>
        <span className="font-bold text-green-600">~{quote.estimatedCryptoAmount.toFixed(2)} {token}</span>
      </div>
      {quote.disclaimer && <p className="text-xs text-gray-400 mt-1">{quote.disclaimer}</p>}
    </div>
  );
}

function TransakWidget({ config, onClose, onSuccess }: { config: any; onClose: () => void; onSuccess: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    if (!config?.apiKey) return;

    const params = new URLSearchParams({
      apiKey: config.apiKey,
      environment: config.environment || 'STAGING',
      cryptoCurrencyCode: config.cryptoCurrencyCode || 'USDC',
      network: config.network || 'base',
      defaultFiatAmount: String(config.defaultFiatAmount || 100),
      fiatCurrency: config.fiatCurrency || 'USD',
      walletAddress: config.walletAddress || '',
      disableWalletAddressForm: 'true',
      hideMenu: 'true',
      themeColor: config.themeColor || '3B82F6',
      ...(config.partnerOrderId && { partnerOrderId: config.partnerOrderId }),
      ...(config.partnerCustomerId && { partnerCustomerId: config.partnerCustomerId }),
      ...(config.partnerFeePercentage && { partnerFeePercentage: String(config.partnerFeePercentage) }),
    });

    const baseUrl = config.environment === 'PRODUCTION'
      ? 'https://global.transak.com'
      : 'https://global-stg.transak.com';

    if (iframeRef.current) {
      iframeRef.current.src = `${baseUrl}/?${params.toString()}`;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin.includes('transak.com')) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event_id === 'TRANSAK_ORDER_SUCCESSFUL' || data.event_id === 'TRANSAK_ORDER_COMPLETED') {
            onSuccess();
          }
          if (data.event_id === 'TRANSAK_WIDGET_CLOSE') {
            onClose();
          }
        } catch (e) {}
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [config]);

  return (
    <div className="space-y-4">
      <div className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 relative" style={{ minHeight: '600px' }}>
        {!widgetLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading payment widget...</p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          title="Transak Payment Widget"
          allow="camera;microphone;fullscreen;payment"
          className="w-full border-0"
          style={{ height: '600px' }}
          onLoad={() => setWidgetLoaded(true)}
        />
      </div>
      <Button variant="outline" className="w-full" onClick={onClose}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Cancel & Start Over
      </Button>
    </div>
  );
}

export default function BuyOnramp() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState(1);
  const [selectedToken, setSelectedToken] = useState("USDC");
  const [selectedNetwork, setSelectedNetwork] = useState("base");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError] = useState("");
  const [showWidget, setShowWidget] = useState(false);
  const [orderCreated, setOrderCreated] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;
  const isTron = selectedNetwork === "tron";

  useEffect(() => {
    if (isAuthenticated && step === 1) {
      setStep(2);
    }
  }, [isAuthenticated]);

  const isWalletValid = (address: string, network: string): boolean => {
    if (!address) return false;
    if (network === "tron") return /^T[a-zA-Z0-9]{33}$/.test(address);
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const validateWalletWithError = (address: string, network: string) => {
    if (!address) {
      setWalletError("");
      return false;
    }
    if (network === "tron") {
      if (!/^T[a-zA-Z0-9]{33}$/.test(address)) {
        setWalletError("Tron addresses start with T followed by 33 characters");
        return false;
      }
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        setWalletError("Enter a valid EVM address starting with 0x");
        return false;
      }
    }
    setWalletError("");
    return true;
  };

  const handleWalletChange = (value: string) => {
    setWalletAddress(value);
    if (value.length > 5) validateWalletWithError(value, selectedNetwork);
    else setWalletError("");
  };

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/onramp/transak/session", {
        fiatAmount: parsedAmount,
        fiatCurrency: "USD",
        cryptoCurrency: selectedToken,
        network: selectedNetwork,
        walletAddress,
      });
    },
    onSuccess: (data: any) => {
      setOrderCreated(data);
      setShowWidget(true);
      setStep(4);
      toast({ title: "Order created", description: "Complete your purchase below." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start purchase", description: error.message, variant: "destructive" });
    },
  });

  const { data: ordersData } = useQuery({
    queryKey: ["/api/onramp/transak/orders"],
    enabled: isAuthenticated,
  });

  const orders = (ordersData as any)?.orders || [];

  const canProceedToStep3 = selectedToken && selectedNetwork;
  const canProceedToStep4 = parsedAmount >= 10 && parsedAmount <= 2500 && walletAddress && !walletError && isWalletValid(walletAddress, selectedNetwork);

  const quickAmounts = [25, 50, 100, 250, 500, 1000, 2500];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Buy Crypto</h1>
          <p className="text-gray-500 dark:text-gray-400">Purchase USDC or USDT with a card, Apple Pay, or Google Pay</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? "bg-blue-600 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-400"}`}>
                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
              </div>
              {s < 4 && <div className={`w-12 h-1 mx-1 rounded transition-all ${step > s ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 mb-8 text-xs text-gray-400">
          <span className={step >= 1 ? "text-blue-600 font-medium" : ""}>Account</span>
          <span className={step >= 2 ? "text-blue-600 font-medium" : ""}>Select</span>
          <span className={step >= 3 ? "text-blue-600 font-medium" : ""}>Details</span>
          <span className={step >= 4 ? "text-blue-600 font-medium" : ""}>Pay</span>
        </div>

        {step === 1 && !isAuthenticated && (
          <InlineAuth onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }); setStep(2); }} />
        )}

        {step === 2 && (
          <Card className="bg-white dark:bg-gray-900 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                What do you want to buy?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-3 block">Token</Label>
                <div className="grid grid-cols-2 gap-3">
                  {TOKENS.map((token) => (
                    <button
                      key={token.id}
                      onClick={() => setSelectedToken(token.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${selectedToken === token.id ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                    >
                      <div className="font-bold text-lg">{token.name}</div>
                      <div className="text-sm text-gray-500">{token.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Network</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {NETWORKS.map((network) => (
                    <button
                      key={network.id}
                      onClick={() => { setSelectedNetwork(network.id); setWalletAddress(""); setWalletError(""); }}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${selectedNetwork === network.id ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-gray-200 dark:border-gray-700 hover:border-blue-300"}`}
                    >
                      <div className="font-bold" style={{ color: network.color }}>{network.icon}</div>
                      <div className="text-xs text-gray-500 mt-1">{network.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button className="w-full h-12 text-lg" onClick={() => setStep(3)} disabled={!canProceedToStep3}>
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="bg-white dark:bg-gray-900 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Purchase Details
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{selectedToken}</Badge>
                <Badge variant="outline">{NETWORKS.find((n) => n.id === selectedNetwork)?.name}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-semibold mb-3 block">How much? (USD)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-400 font-bold">$</span>
                  <Input
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-2xl font-bold pl-10 h-14"
                    min={10}
                    max={2500}
                  />
                </div>
                {parsedAmount > 2500 && (
                  <p className="text-red-500 text-sm mt-2">Maximum purchase is $2,500</p>
                )}
                {parsedAmount > 0 && parsedAmount < 10 && (
                  <p className="text-red-500 text-sm mt-2">Minimum purchase is $10</p>
                )}

                <div className="flex flex-wrap gap-2 mt-3">
                  {quickAmounts.map((qa) => (
                    <button
                      key={qa}
                      onClick={() => setAmount(qa.toString())}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${parsedAmount === qa ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 dark:border-gray-600 hover:border-blue-400 text-gray-600 dark:text-gray-300"}`}
                    >
                      ${qa.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <QuoteDisplay amount={parsedAmount} token={selectedToken} />

              <div>
                <Label className="text-base font-semibold mb-2 block">
                  <Wallet className="w-4 h-4 inline mr-1" />
                  Your {isTron ? "Tron" : "EVM"} Wallet Address
                </Label>
                <p className="text-xs text-gray-400 mb-2">
                  {isTron ? "Enter your Tron (TRC-20) wallet address" : "Enter your wallet address (works with MetaMask, Coinbase Wallet, etc.)"}
                </p>
                <Input
                  placeholder={isTron ? "T..." : "0x..."}
                  value={walletAddress}
                  onChange={(e) => handleWalletChange(e.target.value)}
                  className={`font-mono text-sm ${walletError ? "border-red-500" : ""}`}
                />
                {walletError && <p className="text-red-500 text-xs mt-1">{walletError}</p>}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="h-12">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button
                  className="flex-1 h-12 text-lg"
                  onClick={() => createSessionMutation.mutate()}
                  disabled={!canProceedToStep4 || createSessionMutation.isPending}
                >
                  {createSessionMutation.isPending ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Creating order...</>
                  ) : (
                    <>Buy {selectedToken} <ArrowRight className="w-5 h-5 ml-2" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && showWidget && (
          <Card className="bg-white dark:bg-gray-900 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Complete Your Purchase
              </CardTitle>
              {orderCreated?.order && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">${parseFloat(orderCreated.order.fiatAmount).toFixed(2)} USD</Badge>
                  <Badge variant="outline">{orderCreated.order.cryptoCurrency} on {NETWORKS.find((n) => n.id === orderCreated.order.network)?.name}</Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {orderCreated?.widget?.mode === "staging" ? (
                <div className="space-y-4">
                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                    <Shield className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Transak integration is being configured.</strong> Once your API key is active, the payment widget will appear here. Your order has been recorded.
                    </AlertDescription>
                  </Alert>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Payment Widget Coming Soon</h3>
                    <p className="text-sm text-gray-500 mb-4">The payment form will load here once the Transak partnership is finalized. You'll be able to pay with card, Apple Pay, or Google Pay.</p>
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 text-left space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Order ID</span>
                        <span className="font-mono">#{orderCreated.order.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Amount</span>
                        <span className="font-semibold">${parseFloat(orderCreated.order.fiatAmount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Token</span>
                        <span>{orderCreated.order.cryptoCurrency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Network</span>
                        <span>{NETWORKS.find((n) => n.id === orderCreated.order.network)?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Wallet</span>
                        <span className="font-mono text-xs">{orderCreated.order.walletAddress.slice(0, 10)}...{orderCreated.order.walletAddress.slice(-6)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fee</span>
                        <span>${parseFloat(orderCreated.order.coinrailzFee).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setStep(2); setShowWidget(false); setOrderCreated(null); }}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Start New Purchase
                  </Button>
                </div>
              ) : (
                <TransakWidget config={orderCreated?.widget?.config} onClose={() => { setStep(2); setShowWidget(false); setOrderCreated(null); }} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["/api/onramp/transak/orders"] }); toast({ title: "Purchase complete!", description: "Your crypto is on its way to your wallet." }); }} />
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure payments</div>
          <div className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant delivery</div>
          <div className="flex items-center gap-1"><Globe className="w-3 h-3" /> 6 networks</div>
        </div>

        {isAuthenticated && orders.length > 0 && (
          <Card className="mt-8 bg-white dark:bg-gray-900 shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Purchases
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orders.slice(0, 5).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <div>
                      <div className="font-semibold">{order.cryptoCurrency} on {NETWORKS.find((n) => n.id === order.network)?.name || order.network}</div>
                      <div className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${parseFloat(order.fiatAmount).toFixed(2)}</div>
                      <Badge variant={order.status === "completed" ? "default" : order.status === "failed" || order.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
