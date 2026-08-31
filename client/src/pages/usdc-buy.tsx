import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  DollarSign, 
  Shield, 
  Zap, 
  CheckCircle,
  ArrowRight,
  Bank,
  Wallet
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  fee: string;
  time: string;
  description: string;
  available: boolean;
}

export default function USDCBuy() {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<string>("card");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch current USDC balance
  const { data: usdcBalance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/user/circle/balance'],
    enabled: !!user
  });

  const paymentMethods: PaymentMethod[] = [
    {
      id: "card",
      name: "Credit/Debit Card",
      icon: CreditCard,
      fee: "2.9% + $0.30",
      time: "Instant",
      description: "Buy USDC instantly with your card",
      available: true
    },
    {
      id: "bank",
      name: "Bank Transfer (ACH)",
      icon: Bank,
      fee: "0.5%",
      time: "1-3 business days",
      description: "Lower fees with bank transfer",
      available: true
    },
    {
      id: "wire",
      name: "Wire Transfer",
      icon: Wallet,
      fee: "1.0% + $25",
      time: "Same day",
      description: "Fast bank wire transfer",
      available: true
    }
  ];

  const handlePurchase = async () => {
    // Feature coming soon
    alert("USDC purchasing coming soon!");
  };

  const calculateFees = (amount: string, method: string) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { fee: 0, total: 0 };

    let fee = 0;
    switch (method) {
      case "card":
        fee = amt * 0.029 + 0.30;
        break;
      case "bank":
        fee = amt * 0.005;
        break;
      case "wire":
        fee = amt * 0.01 + 25;
        break;
    }

    return {
      fee: fee,
      total: amt + fee
    };
  };

  const fees = calculateFees(amount, selectedMethod);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Buy USDC
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Purchase USDC with multiple payment methods
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                Back to Dashboard
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Purchase Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Purchase USDC
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Amount Input */}
                <div>
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="10"
                      className="pl-8"
                    />
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Minimum purchase: $10
                  </p>
                </div>

                {/* Payment Methods */}
                <div>
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedMethod === method.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => method.available && setSelectedMethod(method.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <method.icon className="h-5 w-5 mr-3 text-gray-600" />
                            <div>
                              <div className="font-medium">{method.name}</div>
                              <div className="text-sm text-gray-500">{method.description}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">{method.fee}</div>
                            <div className="text-xs text-gray-500">{method.time}</div>
                          </div>
                        </div>
                        {selectedMethod === method.id && (
                          <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchase Summary */}
                {amount && parseFloat(amount) > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3">Purchase Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>USDC Amount:</span>
                        <span>${parseFloat(amount).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing Fee:</span>
                        <span>${fees.fee.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>Total Cost:</span>
                        <span>${fees.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Purchase Button */}
                <div className="relative">
                  <Button 
                    onClick={handlePurchase}
                    disabled={true}
                    className="w-full"
                    size="lg"
                  >
                    Purchase ${amount || "0"} USDC
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                  <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Balance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="h-5 w-5 mr-2" />
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {balanceLoading ? "Loading..." : `$${usdcBalance?.balance || '0.00'}`}
                </div>
                <p className="text-sm text-gray-500">USDC Balance</p>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Why Buy USDC?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Instant Transfers</div>
                      <div className="text-xs text-gray-500">Send money globally in seconds</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Ultra-Low Fees</div>
                      <div className="text-xs text-gray-500">1.25% vs 4.5% traditional methods</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Earn Yield</div>
                      <div className="text-xs text-gray-500">Earn interest on your USDC holdings</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="text-sm font-medium">Dollar-Backed</div>
                      <div className="text-xs text-gray-500">1:1 backed by US dollar reserves</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/p2p-transfer">
                      <Zap className="h-4 w-4 mr-2" />
                      Send USDC
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/usdc-savings">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Earn Yield
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/usdc-ecosystem-dashboard">
                      <Shield className="h-4 w-4 mr-2" />
                      USDC Hub
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}