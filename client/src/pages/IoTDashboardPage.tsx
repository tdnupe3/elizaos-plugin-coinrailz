import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Cpu, 
  DollarSign,
  Activity,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  Plus,
  Send,
  Wallet,
  Clock,
  Key,
  Copy
} from "lucide-react";

export default function IoTDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [activeAccountId, setActiveAccountId] = useState("");
  const [activeDeviceId, setActiveDeviceId] = useState("");

  const [deviceForm, setDeviceForm] = useState({
    deviceId: "",
    deviceName: "",
    deviceType: "sensor" as const,
    spendingLimit: "100"
  });

  const [meterForm, setMeterForm] = useState({
    eventType: "sensor_reading" as const,
    units: "1"
  });

  const [topupForm, setTopupForm] = useState({
    packId: "starter_25" as const,
    paymentMethod: "stripe" as const
  });

  useSEO({
    title: "IoT Dashboard | Device Management & Credits | Coin Railz",
    description: "Register devices, meter billable events, manage credits balance, and view transaction history.",
    keywords: "IoT dashboard, device registration, metering, credits, transaction history"
  });

  const authHeaders: Record<string, string> = apiKey ? { "x-api-key": apiKey } : {};

  const { data: catalogData, isLoading: catalogLoading, refetch: refetchCatalog } = useQuery<any>({
    queryKey: ['/api/iot/catalog'],
    staleTime: 30000
  });

  const fetchBalance = async () => {
    if (!activeDeviceId || !apiKey) return null;
    const res = await fetch(`/api/iot/balance/${activeDeviceId}`, {
      headers: authHeaders
    });
    if (!res.ok) throw new Error("Failed to fetch balance");
    return res.json();
  };

  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery<any>({
    queryKey: ['iot-balance', activeDeviceId],
    queryFn: fetchBalance,
    enabled: !!activeDeviceId && !!apiKey,
    staleTime: 10000
  });

  const fetchTransactions = async () => {
    if (!activeDeviceId || !apiKey) return { transactions: [] };
    const res = await fetch(`/api/iot/transactions/${activeDeviceId}`, {
      headers: authHeaders
    });
    if (!res.ok) throw new Error("Failed to fetch transactions");
    return res.json();
  };

  const { data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery<any>({
    queryKey: ['iot-transactions', activeDeviceId],
    queryFn: fetchTransactions,
    enabled: !!activeDeviceId && !!apiKey,
    staleTime: 10000
  });

  const registerDeviceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/iot/register', {
        method: 'POST',
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          deviceId: deviceForm.deviceId || `dev_${Date.now()}`,
          accountId: activeAccountId,
          deviceName: deviceForm.deviceName,
          deviceType: deviceForm.deviceType,
          spendingLimit: parseFloat(deviceForm.spendingLimit) || 100,
          canReceivePayments: true,
          canSendPayments: true
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details?.[0]?.message || "Failed to register device");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      const newDeviceId = data.device?.deviceId || data.device?.id;
      toast({ title: "Device Registered", description: `Device ID: ${newDeviceId}` });
      setDeviceForm({ deviceId: "", deviceName: "", deviceType: "sensor", spendingLimit: "100" });
      if (newDeviceId) {
        setActiveDeviceId(newDeviceId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to register device", variant: "destructive" });
    }
  });

  const meterEventMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/iot/meter', {
        method: 'POST',
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          deviceId: activeDeviceId,
          eventType: meterForm.eventType,
          units: parseInt(meterForm.units) || 1
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details?.[0]?.message || "Failed to meter event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event Metered", description: "Billable event recorded successfully" });
      refetchBalance();
      refetchTransactions();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to meter event", variant: "destructive" });
    }
  });

  const topupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/iot/topup', {
        method: 'POST',
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          accountId: activeAccountId,
          packId: topupForm.packId,
          paymentMethod: topupForm.paymentMethod
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details?.[0]?.message || "Failed to initiate top up");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.approvalUrl) {
        window.location.href = data.approvalUrl;
      } else {
        toast({ title: "Top Up Initiated", description: data.message || "Processing payment..." });
        refetchBalance();
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to initiate top up", variant: "destructive" });
    }
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const handleRegisterDevice = () => {
    if (!apiKey) {
      toast({ title: "Error", description: "Please enter your API Key first", variant: "destructive" });
      return;
    }
    if (!activeAccountId) {
      toast({ title: "Error", description: "Please enter an Account ID first", variant: "destructive" });
      return;
    }
    registerDeviceMutation.mutate();
  };

  const handleMeterEvent = () => {
    if (!apiKey) {
      toast({ title: "Error", description: "Please enter your API Key first", variant: "destructive" });
      return;
    }
    if (!activeDeviceId) {
      toast({ title: "Error", description: "Please enter a Device ID first", variant: "destructive" });
      return;
    }
    meterEventMutation.mutate();
  };

  const handleTopUp = () => {
    if (!apiKey) {
      toast({ title: "Error", description: "Please enter your API Key first", variant: "destructive" });
      return;
    }
    if (!activeAccountId) {
      toast({ title: "Error", description: "Please enter an Account ID first", variant: "destructive" });
      return;
    }
    topupMutation.mutate();
  };

  const products = Array.isArray(catalogData) ? catalogData : (catalogData?.products || []);
  const productCount = products.length;
  const balance = balanceData?.balance ?? balanceData?.creditsBalance ?? 0;
  const transactions = transactionsData?.transactions || transactionsData?.events || [];

  const packPricing: Record<string, { price: number; credits: number; id: string }> = {
    starter_25: { price: 25, credits: 5000, id: "starter_25" },
    growth_100: { price: 100, credits: 25000, id: "growth_100" },
    enterprise_500: { price: 500, credits: 200000, id: "enterprise_500" }
  };

  const isAuthenticated = !!apiKey && !!activeAccountId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/iot")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">IoT Dashboard</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/fleet")}>Fleet</Button>
              <Button variant="ghost" onClick={() => setLocation("/weather")}>Weather</Button>
              <Button variant="ghost" onClick={() => setLocation("/credits/proof")}>Audit Trail</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="mb-8 border-2 border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-600" />
              Authentication
            </CardTitle>
            <CardDescription>
              Enter your API key and Account ID from pilot onboarding to access your devices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="iot_key_xxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Account ID</Label>
                <Input
                  value={activeAccountId}
                  onChange={(e) => setActiveAccountId(e.target.value)}
                  placeholder="iot_acc_xxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>Device ID (for queries)</Label>
                <div className="flex gap-2">
                  <Input
                    value={activeDeviceId}
                    onChange={(e) => setActiveDeviceId(e.target.value)}
                    placeholder="dev_xxxxx"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => { refetchBalance(); refetchTransactions(); }}
                    disabled={!activeDeviceId || !apiKey || balanceLoading}
                  >
                    {balanceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
            {!isAuthenticated && (
              <p className="text-sm text-amber-600 mt-4">
                Don't have credentials yet? <Button variant="link" className="p-0 h-auto" onClick={() => setLocation("/pilot/onboard")}>Start a pilot</Button> to get your API key and Account ID.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  <Cpu className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold">{productCount}</div>
              <div className="text-sm text-gray-500">Products Listed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Activity className="w-5 h-5" />
                </div>
                {transactions.length > 0 && <ArrowUpRight className="w-5 h-5 text-green-500" />}
              </div>
              <div className="text-2xl font-bold">{isAuthenticated && activeDeviceId ? transactions.length : "—"}</div>
              <div className="text-sm text-gray-500">Events Metered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold">
                {isAuthenticated && activeDeviceId ? (balanceLoading ? "..." : `$${balance.toFixed(2)}`) : "—"}
              </div>
              <div className="text-sm text-gray-500">Credits Balance</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold">$0.005</div>
              <div className="text-sm text-gray-500">Per Event</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="devices" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="metering">Metering</TabsTrigger>
            <TabsTrigger value="transactions">History</TabsTrigger>
            <TabsTrigger value="topup">Top Up</TabsTrigger>
          </TabsList>

          <TabsContent value="devices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Register New Device
                </CardTitle>
                <CardDescription>
                  Add a new IoT device to your account. You'll receive a unique Device ID for metering.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Device ID (optional)</Label>
                    <Input
                      value={deviceForm.deviceId}
                      onChange={(e) => setDeviceForm({ ...deviceForm, deviceId: e.target.value })}
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Device Name</Label>
                    <Input
                      value={deviceForm.deviceName}
                      onChange={(e) => setDeviceForm({ ...deviceForm, deviceName: e.target.value })}
                      placeholder="e.g., Truck #42 GPS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Device Type</Label>
                    <Select
                      value={deviceForm.deviceType}
                      onValueChange={(v: any) => setDeviceForm({ ...deviceForm, deviceType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sensor">Sensor</SelectItem>
                        <SelectItem value="gateway">Gateway</SelectItem>
                        <SelectItem value="actuator">Actuator</SelectItem>
                        <SelectItem value="iot_device">IoT Device</SelectItem>
                        <SelectItem value="ai_agent">AI Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Spending Limit ($)</Label>
                    <Input
                      type="number"
                      value={deviceForm.spendingLimit}
                      onChange={(e) => setDeviceForm({ ...deviceForm, spendingLimit: e.target.value })}
                    />
                  </div>
                </div>
                <Button 
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleRegisterDevice}
                  disabled={registerDeviceMutation.isPending || !isAuthenticated}
                >
                  {registerDeviceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Register Device
                </Button>
                {!isAuthenticated && (
                  <p className="text-sm text-amber-600 mt-2">
                    Enter API Key and Account ID above to register devices
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metering">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Submit Billable Event
                </CardTitle>
                <CardDescription>
                  Meter a billable event for the selected device. Default cost: $0.005-0.01 per event depending on type.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Event Type</Label>
                    <Select
                      value={meterForm.eventType}
                      onValueChange={(v: any) => setMeterForm({ ...meterForm, eventType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sensor_reading">Sensor Reading ($0.005)</SelectItem>
                        <SelectItem value="message">Message ($0.01)</SelectItem>
                        <SelectItem value="data_access">Data Access ($0.01)</SelectItem>
                        <SelectItem value="api_call">API Call ($0.005)</SelectItem>
                        <SelectItem value="stream_minute">Stream Minute ($0.02)</SelectItem>
                        <SelectItem value="compute_second">Compute Second ($0.001)</SelectItem>
                        <SelectItem value="storage_mb">Storage MB ($0.0005)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Units</Label>
                    <Input
                      type="number"
                      min="1"
                      value={meterForm.units}
                      onChange={(e) => setMeterForm({ ...meterForm, units: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                  onClick={handleMeterEvent}
                  disabled={meterEventMutation.isPending || !isAuthenticated || !activeDeviceId}
                >
                  {meterEventMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Submit Event
                </Button>
                {!activeDeviceId && isAuthenticated && (
                  <p className="text-sm text-amber-600 mt-2">
                    Enter a Device ID above to meter events
                  </p>
                )}
                {!isAuthenticated && (
                  <p className="text-sm text-amber-600 mt-2">
                    Enter API Key and Account ID above to meter events
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Transaction History
                </CardTitle>
                <CardDescription>
                  View all billable events and credits activity for the selected device.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isAuthenticated || !activeDeviceId ? (
                  <div className="text-center py-8 text-gray-500">
                    <Wallet className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Enter API Key, Account ID, and Device ID to view transaction history</p>
                  </div>
                ) : transactionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  </div>
                ) : transactions.length > 0 ? (
                  <div className="space-y-3">
                    {transactions.slice(0, 20).map((tx: any, index: number) => (
                      <div key={tx.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === 'topup' || tx.type === 'credit' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {tx.type === 'topup' || tx.type === 'credit' ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{tx.eventType || tx.type || 'Event'}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(tx.createdAt || tx.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className={`font-medium ${
                          tx.type === 'topup' || tx.type === 'credit' ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {tx.type === 'topup' || tx.type === 'credit' ? '+' : '-'}
                          ${Math.abs(tx.totalCost || tx.amount || tx.cost || 0.005).toFixed(4)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No transactions found for this device</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topup">
            <div className="grid md:grid-cols-3 gap-6">
              {Object.entries(packPricing).map(([packId, { price, credits }]) => (
                <Card 
                  key={packId} 
                  className={`cursor-pointer transition-all ${
                    topupForm.packId === packId ? 'ring-2 ring-emerald-500' : 'hover:shadow-lg'
                  }`}
                  onClick={() => setTopupForm({ ...topupForm, packId: packId as any })}
                >
                  <CardHeader>
                    <CardTitle className="capitalize">{packId.replace('_', ' $')}</CardTitle>
                    <CardDescription>{credits.toLocaleString()} credits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-600">${price}</div>
                    <div className="text-sm text-gray-500 mt-2">
                      ${(price / credits * 1000).toFixed(2)} per 1K events
                    </div>
                    {topupForm.packId === packId && (
                      <Badge className="mt-3 bg-emerald-100 text-emerald-700">Selected</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Complete Purchase
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={topupForm.paymentMethod}
                      onValueChange={(v: any) => setTopupForm({ ...topupForm, paymentMethod: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stripe">Credit Card (Stripe)</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-sm text-gray-500">Total</div>
                    <div className="text-2xl font-bold">
                      ${packPricing[topupForm.packId]?.price || 25}
                    </div>
                    <div className="text-sm text-emerald-600">
                      {(packPricing[topupForm.packId]?.credits || 5000).toLocaleString()} credits
                    </div>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleTopUp}
                  disabled={topupMutation.isPending || !isAuthenticated}
                >
                  {topupMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Purchase Credits
                </Button>
                {!isAuthenticated && (
                  <p className="text-sm text-amber-600 mt-2 text-center">
                    Enter API Key and Account ID above to purchase credits
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Data Products Catalog</span>
              <Badge variant="secondary">{catalogLoading ? 'Loading...' : `${productCount} products`}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {catalogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : products.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-4">
                {products.slice(0, 6).map((product: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{product.name}</div>
                      <div className="text-xs text-gray-500">{product.dataType || product.type || 'data'}</div>
                    </div>
                    <Badge variant="secondary">
                      ${product.pricePerReading || product.price || '0.00'}/read
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Cpu className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No products listed yet</p>
                <Button 
                  variant="link" 
                  onClick={() => setLocation("/weather/demo")}
                  className="mt-2"
                >
                  Try the demo to create one
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 bg-gradient-to-r from-emerald-600 to-green-600 text-white">
          <CardContent className="py-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Need Help Getting Started?</h3>
                <p className="opacity-90">
                  Check out our integration guide or start a 30-day pilot.
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="secondary"
                  onClick={() => setLocation("/integrate")}
                >
                  Integration Guide
                </Button>
                <Button 
                  className="bg-white text-emerald-600 hover:bg-gray-100"
                  onClick={() => setLocation("/pilot/onboard")}
                >
                  Start Pilot
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
