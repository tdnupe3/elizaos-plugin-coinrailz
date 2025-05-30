import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { CryptoHoldings } from "@/components/crypto-holdings";
import { WalletConnect } from "@/components/wallet-connect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buyCryptoSchema, sellCryptoSchema, type BuyCrypto, type SellCrypto } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

export default function CryptoWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCoin, setSelectedCoin] = useState<string>("");
  const [selectedSellCoin, setSelectedSellCoin] = useState<string>("");
  const [activeTab, setActiveTab] = useState("buy");

  // Get URL params to determine initial tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "sell") {
      setActiveTab("sell");
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">Crypto Wallet</h1>
          <p className="text-neutral-500">Manage your cryptocurrency portfolio</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wallet Connect */}
          <div className="lg:col-span-1">
            <WalletConnect />
          </div>
          
          {/* Main Trading Interface */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="buy">Buy Crypto</TabsTrigger>
                <TabsTrigger value="sell">Sell Crypto</TabsTrigger>
              </TabsList>

              {/* Market Prices */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { symbol: 'BTC', name: 'Bitcoin', price: 43250, change: 2.5 },
                      { symbol: 'ETH', name: 'Ethereum', price: 2650, change: -1.2 },
                      { symbol: 'SOL', name: 'Solana', price: 98, change: 4.8 },
                      { symbol: 'ADA', name: 'Cardano', price: 0.52, change: -0.8 }
                    ].map((coin) => (
                      <div key={coin.symbol} className="flex items-center justify-between p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                            <span className="font-bold text-orange-600">{coin.symbol}</span>
                          </div>
                          <div>
                            <p className="font-medium">{coin.name}</p>
                            <p className="text-sm text-neutral-500">{coin.symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${coin.price.toLocaleString()}</p>
                          <div className={`flex items-center text-sm ${coin.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {coin.change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {Math.abs(coin.change)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <TabsContent value="buy">
                <Card>
                  <CardHeader>
                    <CardTitle>Buy Cryptocurrency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="bg-blue-50 rounded-lg p-4 space-y-2 text-sm">
                        <h4 className="font-medium text-blue-900">How Crypto Buying Works:</h4>
                        <ul className="text-blue-800 space-y-1">
                          <li>• Connect your wallet using the panel on the left</li>
                          <li>• Choose your preferred cryptocurrency and payment method</li>
                          <li>• Complete KYC verification for regulatory compliance</li>
                          <li>• Funds are deposited directly to your connected wallet</li>
                        </ul>
                      </div>

                      <div>
                        <Label>Select Cryptocurrency</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a cryptocurrency to buy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                            <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                            <SelectItem value="SOL">Solana (SOL)</SelectItem>
                            <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Amount (USD)</Label>
                        <Input
                          type="number"
                          placeholder="100.00"
                          min="10"
                          step="0.01"
                        />
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">Estimated Crypto Amount</span>
                          <span className="font-semibold text-lg text-green-600">
                            0.00231 BTC
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          1% platform fee • Real-time market rates
                        </p>
                      </div>

                      <Button className="w-full bg-green-600 hover:bg-green-700">
                        Buy Cryptocurrency
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sell">
                <Card>
                  <CardHeader>
                    <CardTitle>Sell Cryptocurrency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="bg-orange-50 rounded-lg p-4 space-y-2 text-sm">
                        <h4 className="font-medium text-orange-900">How Crypto Selling Works:</h4>
                        <ul className="text-orange-800 space-y-1">
                          <li>• Your wallet must be connected to access your holdings</li>
                          <li>• Select the cryptocurrency you want to sell</li>
                          <li>• Choose your preferred payout method (bank transfer, etc.)</li>
                          <li>• Funds are processed within 1-3 business days</li>
                        </ul>
                      </div>

                      <div>
                        <Label>Select Cryptocurrency to Sell</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose from your holdings" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BTC">Bitcoin (BTC) - 0.025</SelectItem>
                            <SelectItem value="ETH">Ethereum (ETH) - 1.5</SelectItem>
                            <SelectItem value="SOL">Solana (SOL) - 25</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Amount to Sell</Label>
                        <Input
                          type="number"
                          placeholder="0.001"
                          step="0.00000001"
                        />
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">Estimated USD Value</span>
                          <span className="font-semibold text-lg text-green-600">
                            $432.50
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          1% platform fee • Real-time market rates
                        </p>
                      </div>

                      <Button className="w-full bg-red-600 hover:bg-red-700">
                        Sell Cryptocurrency
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* Crypto Holdings */}
        <div className="mt-8">
          <CryptoHoldings />
        </div>
        
        {/* ISO Compliance Footer */}
        <div className="mt-8 text-center">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 inline-block">
            <p className="text-xs text-emerald-700 font-medium">
              ISO 20022 Compliant Crypto Transactions • FATF Travel Rule Enabled
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}