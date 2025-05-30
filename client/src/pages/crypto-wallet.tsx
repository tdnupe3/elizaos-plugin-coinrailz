import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { CryptoHoldings } from "@/components/crypto-holdings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buyCryptoSchema, sellCryptoSchema, type BuyCrypto, type SellCrypto } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function CryptoWallet() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedCoin, setSelectedCoin] = useState<string>("");
  const [selectedSellCoin, setSelectedSellCoin] = useState<string>("");
  const [activeTab, setActiveTab] = useState("buy");

  // Get URL params to determine initial tab
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "sell") {
      setActiveTab("sell");
    }
  }, []);

  const { data: prices } = useQuery({
    queryKey: ["/api/crypto/prices"],
  });

  const { data: holdings } = useQuery({
    queryKey: ["/api/crypto/holdings"],
  });

  const buyForm = useForm<BuyCrypto>({
    resolver: zodResolver(buyCryptoSchema),
    defaultValues: {
      coinSymbol: "",
      coinName: "",
      amount: "",
      pricePerCoin: "",
    },
  });

  const sellForm = useForm<SellCrypto>({
    resolver: zodResolver(sellCryptoSchema),
    defaultValues: {
      coinSymbol: "",
      amount: "",
      pricePerCoin: "",
    },
  });

  const buyCryptoMutation = useMutation({
    mutationFn: async (data: BuyCrypto) => {
      const response = await apiRequest("POST", "/api/crypto/buy", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Crypto purchase completed successfully",
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase crypto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BuyCrypto) => {
    buyCryptoMutation.mutate(data);
  };

  const handleCoinSelect = (coinSymbol: string) => {
    const coinData = {
      BTC: { name: "Bitcoin", price: prices?.BTC?.price || 45000 },
      ETH: { name: "Ethereum", price: prices?.ETH?.price || 3200 },
      ADA: { name: "Cardano", price: prices?.ADA?.price || 0.85 },
      DOT: { name: "Polkadot", price: prices?.DOT?.price || 25.30 },
    };

    const coin = coinData[coinSymbol as keyof typeof coinData];
    if (coin) {
      form.setValue("coinSymbol", coinSymbol);
      form.setValue("coinName", coin.name);
      form.setValue("pricePerCoin", coin.price.toString());
      setSelectedCoin(coinSymbol);
    }
  };

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
          <div className="lg:col-span-2 space-y-6">
            {/* Market Prices */}
            <Card>
              <CardHeader>
                <CardTitle>Market Prices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {prices && Object.entries(prices).map(([symbol, data]) => (
                    <div key={symbol} className="flex items-center justify-between p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <span className="font-bold text-orange-600">{symbol}</span>
                        </div>
                        <div>
                          <p className="font-medium">{symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : symbol === 'ADA' ? 'Cardano' : 'Polkadot'}</p>
                          <p className="text-sm text-neutral-500">{symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${(data as any).price.toLocaleString()}</p>
                        <div className={`flex items-center text-sm ${(data as any).change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {(data as any).change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {Math.abs((data as any).change)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Buy Crypto */}
            <Card>
              <CardHeader>
                <CardTitle>Buy Cryptocurrency</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <Label>Select Cryptocurrency</Label>
                    <Select onValueChange={handleCoinSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a cryptocurrency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                        <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                        <SelectItem value="DOT">Polkadot (DOT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCoin && (
                    <>
                      <div>
                        <Label>Amount to Buy</Label>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          {...form.register("amount")}
                        />
                        {form.formState.errors.amount && (
                          <p className="text-sm text-red-500 mt-1">{form.formState.errors.amount.message}</p>
                        )}
                      </div>

                      <div>
                        <Label>Price per Coin</Label>
                        <Input
                          type="number"
                          step="0.01"
                          readOnly
                          {...form.register("pricePerCoin")}
                        />
                      </div>

                      <div className="bg-neutral-50 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-600">Total Cost</span>
                          <span className="font-semibold text-lg">
                            ${form.watch("amount") && form.watch("pricePerCoin") 
                              ? (parseFloat(form.watch("amount")) * parseFloat(form.watch("pricePerCoin"))).toFixed(2)
                              : "0.00"}
                          </span>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        disabled={buyCryptoMutation.isPending}
                      >
                        {buyCryptoMutation.isPending ? "Processing..." : "Buy Crypto"}
                      </Button>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <CryptoHoldings />
          </div>
        </div>
      </main>
    </div>
  );
}
