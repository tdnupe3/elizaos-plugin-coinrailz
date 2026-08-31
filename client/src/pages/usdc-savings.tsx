import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  DollarSign, 
  Shield, 
  Zap, 
  CheckCircle,
  ArrowRight,
  Wallet,
  BarChart3,
  Clock,
  Star
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface YieldProduct {
  id: string;
  name: string;
  apy: number;
  risk: 'low' | 'medium' | 'high';
  minimumAmount: number;
  description: string;
  features: string[];
  protocol: string;
  lockupPeriod: string;
  available: boolean;
}

export default function USDCSavings() {
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<string>("aave");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch current USDC balance
  const { data: usdcBalance, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/user/circle/balance'],
    enabled: !!user
  });

  const yieldProducts: YieldProduct[] = [
    {
      id: "aave",
      name: "Aave USDC Lending",
      apy: 4.2,
      risk: "low",
      minimumAmount: 10,
      description: "Earn yield by lending USDC on Aave protocol",
      features: [
        "Variable APY",
        "Instant withdrawals",
        "Established protocol",
        "Insurance coverage"
      ],
      protocol: "Aave V3",
      lockupPeriod: "None",
      available: true
    },
    {
      id: "compound",
      name: "Compound USDC Supply",
      apy: 3.8,
      risk: "low",
      minimumAmount: 10,
      description: "Supply USDC to Compound protocol for yield",
      features: [
        "Stable returns",
        "No lock-up",
        "Proven track record",
        "Liquid staking"
      ],
      protocol: "Compound V3",
      lockupPeriod: "None",
      available: true
    },
    {
      id: "yearn",
      name: "Yearn USDC Vault",
      apy: 5.1,
      risk: "medium",
      minimumAmount: 50,
      description: "Automated yield farming with Yearn Finance",
      features: [
        "Optimized strategies",
        "Auto-compounding",
        "Strategy rotation",
        "Higher yields"
      ],
      protocol: "Yearn V2",
      lockupPeriod: "None",
      available: true
    },
    {
      id: "convex",
      name: "Convex USDC Pool",
      apy: 6.3,
      risk: "medium",
      minimumAmount: 100,
      description: "Earn boosted rewards on Curve pools via Convex",
      features: [
        "Boosted CRV rewards",
        "CVX token rewards",
        "Liquidity provision",
        "Higher risk/reward"
      ],
      protocol: "Convex",
      lockupPeriod: "None",
      available: true
    }
  ];

  const handleInvest = async () => {
    if (!amount || parseFloat(amount) < 10) {
      alert("Minimum investment amount is $10");
      return;
    }

    const selectedProductData = yieldProducts.find(p => p.id === selectedProduct);
    if (!selectedProductData) return;

    if (parseFloat(amount) < selectedProductData.minimumAmount) {
      alert(`Minimum amount for ${selectedProductData.name} is $${selectedProductData.minimumAmount}`);
      return;
    }

    setIsProcessing(true);
    
    try {
      // Simulate DeFi yield investment process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // In production, this would integrate with DeFi protocols
      // through smart contracts to invest USDC
      
      alert(`Successfully invested $${amount} USDC in ${selectedProductData.name}!`);
      setAmount("");
    } catch (error) {
      console.error('Investment failed:', error);
      alert("Investment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedProductData = yieldProducts.find(p => p.id === selectedProduct);
  
  const calculateEstimatedEarnings = (amount: string, apy: number) => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { daily: 0, monthly: 0, yearly: 0 };

    const yearlyEarnings = amt * (apy / 100);
    const monthlyEarnings = yearlyEarnings / 12;
    const dailyEarnings = yearlyEarnings / 365;

    return {
      daily: dailyEarnings,
      monthly: monthlyEarnings,
      yearly: yearlyEarnings
    };
  };

  const earnings = selectedProductData ? calculateEstimatedEarnings(amount, selectedProductData.apy) : { daily: 0, monthly: 0, yearly: 0 };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="secondary" className="bg-red-100 text-red-800">High Risk</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                USDC Savings & Yield
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Earn competitive yields on your USDC holdings through DeFi protocols
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
          {/* Investment Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Invest in USDC Yield
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Yield Products */}
                <div>
                  <Label>Select Yield Product</Label>
                  <div className="grid grid-cols-1 gap-4 mt-2">
                    {yieldProducts.map((product) => (
                      <div
                        key={product.id}
                        className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedProduct === product.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                            : 'border-gray-200 hover:border-gray-300'
                        } ${!product.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => product.available && setSelectedProduct(product.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium">{product.name}</h3>
                              <div className="flex items-center space-x-2">
                                {getRiskBadge(product.risk)}
                                <span className="text-lg font-bold text-green-600">
                                  {product.apy}% APY
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                              {product.description}
                            </p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>Min: ${product.minimumAmount}</span>
                              <span>Protocol: {product.protocol}</span>
                              <span>Lockup: {product.lockupPeriod}</span>
                            </div>
                          </div>
                        </div>
                        {selectedProduct === product.id && (
                          <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-blue-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <Label htmlFor="amount">Investment Amount (USDC)</Label>
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
                    Minimum: ${selectedProductData?.minimumAmount || 10}
                  </p>
                </div>

                {/* Earnings Projection */}
                {amount && parseFloat(amount) > 0 && selectedProductData && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3">Estimated Earnings</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          ${earnings.daily.toFixed(2)}
                        </div>
                        <div className="text-gray-500">Daily</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          ${earnings.monthly.toFixed(2)}
                        </div>
                        <div className="text-gray-500">Monthly</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">
                          ${earnings.yearly.toFixed(2)}
                        </div>
                        <div className="text-gray-500">Yearly</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Product Features */}
                {selectedProductData && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium mb-3">Features</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProductData.features.map((feature, index) => (
                        <div key={index} className="flex items-center text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invest Button */}
                <Button 
                  onClick={handleInvest}
                  disabled={!amount || parseFloat(amount) < (selectedProductData?.minimumAmount || 10) || isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? (
                    "Processing Investment..."
                  ) : (
                    <>
                      Invest ${amount || "0"} USDC
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
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
                  Available Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {balanceLoading ? "Loading..." : `$${usdcBalance?.balance || '0.00'}`}
                </div>
                <p className="text-sm text-gray-500">USDC Available</p>
              </CardContent>
            </Card>

            {/* Yield Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Yield Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {yieldProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.protocol}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">{product.apy}%</div>
                        <div className="text-xs text-gray-500">{product.risk} risk</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Safety Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Safety Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="font-medium">Smart Contract Audited</div>
                      <div className="text-gray-500">All protocols undergo security audits</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 mr-2" />
                    <div>
                      <div className="font-medium">Insurance Coverage</div>
                      <div className="text-gray-500">Additional protection available</div>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5 mr-2" />
                    <div>
                      <div className="font-medium">Instant Withdrawals</div>
                      <div className="text-gray-500">Access your funds anytime</div>
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
                    <Link href="/usdc-buy">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Buy More USDC
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/p2p-transfer">
                      <Zap className="h-4 w-4 mr-2" />
                      Send USDC
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