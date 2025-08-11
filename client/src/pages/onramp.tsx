import React, { useState } from "react";
import { NavigationHeader } from "@/components/navigation-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, CreditCard, Banknote, Shield, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function OnrampPage() {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [, setLocation] = useLocation();

  const handleOnramp = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      // Create onramp session
      const response = await fetch('/api/onramp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paymentMethod,
          targetCrypto: 'USDC'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Simulate successful funding and redirect to trading
        setLocation(`/swap?funded=${data.session.cryptoAmount}&crypto=${data.session.targetCrypto}`);
      }
    } catch (error) {
      console.error('Onramp failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Add Money to Trade
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Fund your wallet instantly with USD and start trading crypto immediately
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Onramp Form */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-green-600" />
                Fund Your Wallet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Amount Input */}
              <div>
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="relative mt-1">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg pl-8"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <Label>Payment Method</Label>
                <div className="grid grid-cols-1 gap-3 mt-2">
                  <Button
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("card")}
                    className="justify-start h-12"
                  >
                    <CreditCard className="w-4 h-4 mr-3" />
                    Credit/Debit Card
                    <span className="ml-auto text-xs text-green-600">Instant</span>
                  </Button>
                  
                  <Button
                    variant={paymentMethod === "bank" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("bank")}
                    className="justify-start h-12"
                  >
                    <Banknote className="w-4 h-4 mr-3" />
                    Bank Transfer (ACH)
                    <span className="ml-auto text-xs text-blue-600">1-2 days</span>
                  </Button>
                </div>
              </div>

              {/* Onramp Button */}
              <Button 
                onClick={handleOnramp}
                className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Add ${amount || "0"} & Start Trading
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {/* Security Notice */}
              <Alert className="bg-green-50 border-green-200">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Secure & Instant:</strong> Your funds are protected by bank-level security. 
                  Start trading immediately after funding.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Trading Preview */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                What You Can Trade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      ₿
                    </div>
                    <span className="font-medium">Bitcoin (BTC)</span>
                  </div>
                  <span className="text-green-600 font-medium">$63,420</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      Ξ
                    </div>
                    <span className="font-medium">Ethereum (ETH)</span>
                  </div>
                  <span className="text-green-600 font-medium">$3,240</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      U
                    </div>
                    <span className="font-medium">USDC Stablecoin</span>
                  </div>
                  <span className="text-gray-600 font-medium">$1.00</span>
                </div>

                <div className="text-center text-sm text-gray-500 mt-4">
                  + 500+ other cryptocurrencies
                </div>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation("/swap")}
                >
                  View All Trading Pairs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simple Flow Steps */}
        <div className="max-w-4xl mx-auto mt-12">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Simple 3-Step Process
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Add Money</h3>
              <p className="text-gray-600 text-sm">Fund your wallet with USD using card or bank transfer</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Connect Wallet</h3>
              <p className="text-gray-600 text-sm">Link any Web3 wallet (MetaMask, Coinbase, etc.)</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Start Trading</h3>
              <p className="text-gray-600 text-sm">Trade crypto instantly with best market rates</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}