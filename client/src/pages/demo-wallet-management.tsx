import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Minus, CreditCard, DollarSign, CheckCircle, AlertCircle } from "@/lib/icons";
import { useLocation } from "wouter";
import { DEMO_WALLET_BALANCES } from "@/lib/demoData";

export default function DemoWalletManagement() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [balances, setBalances] = useState(DEMO_WALLET_BALANCES);
  const [transactions, setTransactions] = useState([
    { id: 1, type: "deposit", amount: 500, method: "Bank Transfer", status: "completed", date: "2025-01-30", fee: 0 },
    { id: 2, type: "deposit", amount: 250, method: "Debit Card", status: "completed", date: "2025-01-28", fee: 3.50 },
    { id: 3, type: "withdrawal", amount: 100, method: "Bank Transfer", status: "pending", date: "2025-01-29", fee: 0 },
    { id: 4, type: "deposit", amount: 1000, method: "Wire Transfer", status: "completed", date: "2025-01-27", fee: 15.00 },
    { id: 5, type: "withdrawal", amount: 75, method: "Instant Transfer", status: "completed", date: "2025-01-26", fee: 1.99 }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Calculate fee based on method
    const getFee = (method: string, amount: number) => {
      switch (method) {
        case "Debit Card": return amount * 0.014; // 1.4% fee
        case "Instant Transfer": return 1.99;
        case "Wire Transfer": return 15.00;
        case "Bank Transfer": return 0;
        default: return 0;
      }
    };

    const fee = getFee(method, parseFloat(amount));
    
    // Add transaction to history
    const newTransaction = {
      id: transactions.length + 1,
      type: activeTab,
      amount: parseFloat(amount),
      method,
      status: "processing",
      date: new Date().toISOString().split('T')[0],
      fee
    };

    // Update balances
    if (activeTab === "deposit") {
      const netAmount = parseFloat(amount) - fee;
      setBalances(prev => prev.map(balance => 
        balance.currency === "USD" 
          ? { ...balance, available: balance.available + netAmount }
          : balance
      ));
    } else {
      const totalAmount = parseFloat(amount) + fee;
      setBalances(prev => prev.map(balance => 
        balance.currency === "USD" 
          ? { ...balance, available: balance.available - totalAmount }
          : balance
      ));
    }
    
    setTransactions(prev => [newTransaction, ...prev]);
    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Reset form after success
    setTimeout(() => {
      setShowSuccess(false);
      setAmount("");
      setMethod("");
    }, 3000);
  };

  const calculateFee = () => {
    const amt = parseFloat(amount) || 0;
    if (activeTab === "deposit") {
      if (method === "debit_card") return amt * 0.029; // 2.9%
      if (method === "bank_transfer") return 0; // Free
    } else {
      if (method === "bank_transfer") return 2.50; // $2.50 flat
      if (method === "instant") return amt * 0.015; // 1.5%
    }
    return 0;
  };

  const fee = calculateFee();
  const netAmount = activeTab === "deposit" 
    ? (parseFloat(amount) || 0) - fee 
    : (parseFloat(amount) || 0) + fee;

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {activeTab === "deposit" ? "Deposit" : "Withdrawal"} Initiated!
            </h2>
            <p className="text-gray-600 mb-4">
              Your ${amount} {activeTab} is being processed
            </p>
            <Badge variant="secondary" className="mb-4">
              Demo Mode - No real funds transferred
            </Badge>
            <Button onClick={() => setLocation('/demo')} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/demo')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Demo
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Wallet Management</h1>
                <p className="text-sm text-gray-600">Demo Mode - Fund management simulation</p>
              </div>
            </div>
            <Badge variant="outline">Demo</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Balance */}
          <div className="lg:col-span-1">
            <Card className="bg-white mb-6">
              <CardHeader>
                <CardTitle>USD Wallet Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  ${DEMO_WALLET_BALANCES[0].balance}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Available: ${DEMO_WALLET_BALANCES[0].availableBalance}</p>
                  <p>Frozen: ${DEMO_WALLET_BALANCES[0].frozenBalance}</p>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.slice(0, 3).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        {tx.type === "deposit" ? (
                          <Plus className="w-4 h-4 text-green-600" />
                        ) : (
                          <Minus className="w-4 h-4 text-red-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium capitalize">{tx.type}</p>
                          <p className="text-xs text-gray-500">{tx.method}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {tx.type === "deposit" ? "+" : "-"}${tx.amount}
                        </p>
                        <Badge 
                          variant={tx.status === "completed" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Deposit/Withdrawal Form */}
          <div className="lg:col-span-2">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Fund Management Demo</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="deposit">
                      <Plus className="w-4 h-4 mr-2" />
                      Deposit
                    </TabsTrigger>
                    <TabsTrigger value="withdrawal">
                      <Minus className="w-4 h-4 mr-2" />
                      Withdraw
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="deposit" className="space-y-6 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Deposit Method</Label>
                        <Select value={method} onValueChange={setMethod} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose deposit method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">
                              <div className="flex items-center">
                                <span>Bank Transfer (ACH) - Free</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="debit_card">
                              <div className="flex items-center">
                                <CreditCard className="w-4 h-4 mr-2" />
                                <span>Debit Card - 2.9% fee</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          step="0.01"
                          min="10"
                          max="25000"
                          required
                        />
                        <p className="text-xs text-gray-500">
                          Minimum: $10, Maximum: $25,000 per transaction
                        </p>
                      </div>

                      {amount && method && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <h3 className="font-medium text-gray-900">Deposit Summary</h3>
                          <div className="flex justify-between text-sm">
                            <span>Deposit Amount:</span>
                            <span>${parseFloat(amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Processing Fee:</span>
                            <span>${fee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2 font-medium">
                            <span>You'll Receive:</span>
                            <span>${netAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-600 mt-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            <span>
                              {method === "bank_transfer" 
                                ? "Funds will be available in 1-3 business days"
                                : "Funds available instantly"
                              }
                            </span>
                          </div>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !amount || !method}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            Processing Deposit...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Deposit ${amount || "0.00"} (Demo)
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="withdrawal" className="space-y-6 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Withdrawal Method</Label>
                        <Select value={method} onValueChange={setMethod} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose withdrawal method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">
                              <span>Bank Transfer (ACH) - $2.50 fee</span>
                            </SelectItem>
                            <SelectItem value="instant">
                              <span>Instant Withdrawal - 1.5% fee</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          step="0.01"
                          min="1"
                          max={DEMO_WALLET_BALANCES[0].availableBalance}
                          required
                        />
                        <p className="text-xs text-gray-500">
                          Available balance: ${DEMO_WALLET_BALANCES[0].availableBalance}
                        </p>
                      </div>

                      {amount && method && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <h3 className="font-medium text-gray-900">Withdrawal Summary</h3>
                          <div className="flex justify-between text-sm">
                            <span>Withdrawal Amount:</span>
                            <span>${parseFloat(amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Processing Fee:</span>
                            <span>${fee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2 font-medium">
                            <span>Total Deducted:</span>
                            <span>${netAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-600 mt-2">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            <span>
                              {method === "bank_transfer" 
                                ? "Funds will arrive in 1-3 business days"
                                : "Funds available within 30 minutes"
                              }
                            </span>
                          </div>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !amount || !method || parseFloat(amount) > parseFloat(DEMO_WALLET_BALANCES[0].availableBalance)}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            Processing Withdrawal...
                          </>
                        ) : (
                          <>
                            <Minus className="w-4 h-4 mr-2" />
                            Withdraw ${amount || "0.00"} (Demo)
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Demo Mode:</strong> This demonstrates our fund management interface. 
                    No real money will be deposited or withdrawn from any accounts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}