import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, TrendingUp, DollarSign, Shield, ArrowLeft } from "@/lib/icons";
import { useLocation } from "wouter";

export default function XRPLiquidityProvision() {
  const [, setLocation] = useLocation();
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("30");

  const handleProvideXRPLiquidity = () => {
    console.log("Providing XRP liquidity:", { amount, duration });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/xrp-ecosystem")}
            className="text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            XRP Liquidity Provision
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Provide liquidity to XRP markets and earn competitive yields through market making and institutional pools
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Liquidity Provision Form */}
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Droplets className="w-6 h-6" />
                Provide XRP Liquidity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="amount">XRP Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-lg"
                />
                <p className="text-sm text-gray-500 mt-1">Minimum: 100 XRP</p>
              </div>

              <div>
                <Label htmlFor="duration">Lock Period (Days)</Label>
                <select 
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                >
                  <option value="7">7 Days (3.5% APY)</option>
                  <option value="30">30 Days (4.2% APY)</option>
                  <option value="90">90 Days (5.1% APY)</option>
                  <option value="180">180 Days (6.0% APY)</option>
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Expected Returns</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Daily Yield:</span>
                    <span className="font-medium">0.115% ({(parseFloat(amount || "0") * 0.00115).toFixed(2)} XRP)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Return:</span>
                    <span className="font-medium text-green-600">
                      {(parseFloat(amount || "0") * 0.042 * (parseInt(duration) / 365)).toFixed(2)} XRP
                    </span>
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleProvideXRPLiquidity}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                Provide Liquidity
              </Button>
            </CardContent>
          </Card>

          {/* Market Statistics */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <TrendingUp className="w-6 h-6" />
                Market Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">$2.4B</div>
                  <div className="text-sm text-gray-600">Total XRP Liquidity</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">4.8%</div>
                  <div className="text-sm text-gray-600">Average APY</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">156k</div>
                  <div className="text-sm text-gray-600">Active Providers</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-orange-600">24/7</div>
                  <div className="text-sm text-gray-600">Market Making</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Liquidity Pools</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>XRP/USD</span>
                    <span className="text-green-600 font-medium">5.2% APY</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>XRP/EUR</span>
                    <span className="text-green-600 font-medium">4.8% APY</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span>XRP/BTC</span>
                    <span className="text-green-600 font-medium">6.1% APY</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardContent className="p-6">
              <DollarSign className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Competitive Yields</h3>
              <p className="text-gray-600">
                Earn up to 6.0% APY on your XRP holdings through optimized market making strategies
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Institutional Grade</h3>
              <p className="text-gray-600">
                Secure smart contracts audited by leading blockchain security firms
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <Droplets className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Flexible Terms</h3>
              <p className="text-gray-600">
                Choose from multiple lock periods to match your investment strategy
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}