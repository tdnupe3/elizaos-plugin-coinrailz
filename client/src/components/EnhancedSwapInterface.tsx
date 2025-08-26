import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpDown, TrendingUp, Zap, Shield, RefreshCw } from "@/lib/icons";
import { SubscriptionFeeDisplay } from "@/components/SubscriptionFeeDisplay";
import { PremiumSavingsIndicator, PremiumUserBadge } from "@/components/PremiumUserBadge";

interface SwapRate {
  provider: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  networkFee: number;
  serviceFee?: number;
}

interface SwapForm {
  fromToken: string;
  toToken: string;
  amount: string;
  toAddress: string;
  flow: 'standard' | 'fixed-rate';
}

export default function EnhancedSwapInterface() {
  const [swapForm, setSwapForm] = useState<SwapForm>({
    fromToken: 'BTC',
    toToken: 'ETH',
    amount: '',
    toAddress: '',
    flow: 'standard'
  });
  const [bestRates, setBestRates] = useState<SwapRate[]>([]);
  const { toast } = useToast();

  // Fetch available currencies from ChangeNOW
  const { data: currenciesData } = useQuery({
    queryKey: ['/api/changenow/currencies'],
  });

  // Get best rates from both ChangeNOW and 1inch
  const getRatesMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest('GET', `/api/dex/best-rate/${swapForm.fromToken}/${swapForm.toToken}/${amount}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setBestRates(data.rates || []);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Rate Fetch Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create ChangeNOW exchange
  const createExchangeMutation = useMutation({
    mutationFn: async (formData: SwapForm) => {
      const response = await apiRequest('POST', '/api/changenow/exchange', formData);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Exchange Created",
          description: "Your cross-chain swap has been initiated!",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Exchange Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAmountChange = (amount: string) => {
    setSwapForm(prev => ({ ...prev, amount }));
    if (amount && parseFloat(amount) > 0) {
      getRatesMutation.mutate(amount);
    }
  };

  const handleSwap = () => {
    if (!swapForm.amount || !swapForm.toAddress) {
      toast({
        title: "Invalid Input",
        description: "Please enter amount and destination address",
        variant: "destructive",
      });
      return;
    }
    createExchangeMutation.mutate(swapForm);
  };

  const popularTokens = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'DOGE', 'LTC', 'XRP'];
  const availableCurrencies = (currenciesData as any)?.currencies || popularTokens;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5" />
              Enhanced Cross-Chain Swap
            </div>
            <PremiumUserBadge variant="icon-only" />
          </CardTitle>
          <CardDescription>
            Compare rates from multiple providers including ChangeNOW (900+ currencies) and 1inch DEX aggregation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fromToken">From Token</Label>
              <Select 
                value={swapForm.fromToken} 
                onValueChange={(value) => setSwapForm(prev => ({ ...prev, fromToken: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-500 mb-2">Popular</div>
                    {popularTokens.map((token) => (
                      <SelectItem key={token} value={token}>
                        {token}
                      </SelectItem>
                    ))}
                  </div>
                  {availableCurrencies.length > popularTokens.length && (
                    <div className="p-2 border-t">
                      <div className="text-sm font-medium text-gray-500 mb-2">All Currencies</div>
                      {availableCurrencies
                        .filter((c: any) => !popularTokens.includes(c.ticker || c))
                        .slice(0, 20)
                        .map((currency: any) => (
                          <SelectItem key={currency.ticker || currency} value={currency.ticker || currency}>
                            {currency.name || currency} ({currency.ticker || currency})
                          </SelectItem>
                        ))}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="toToken">To Token</Label>
              <Select 
                value={swapForm.toToken} 
                onValueChange={(value) => setSwapForm(prev => ({ ...prev, toToken: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-500 mb-2">Popular</div>
                    {popularTokens.map((token) => (
                      <SelectItem key={token} value={token}>
                        {token}
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.00000001"
              placeholder="0.00"
              value={swapForm.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            {swapForm.amount && parseFloat(swapForm.amount) > 0 && (
              <PremiumSavingsIndicator 
                amount={parseFloat(swapForm.amount)} 
                className="mt-1" 
              />
            )}
          </div>

          <div>
            <Label htmlFor="toAddress">Destination Address</Label>
            <Input
              id="toAddress"
              placeholder="Enter receiving wallet address"
              value={swapForm.toAddress}
              onChange={(e) => setSwapForm(prev => ({ ...prev, toAddress: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="flow">Exchange Type</Label>
            <Select 
              value={swapForm.flow} 
              onValueChange={(value: 'standard' | 'fixed-rate') => setSwapForm(prev => ({ ...prev, flow: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Standard (Best Rate)
                  </div>
                </SelectItem>
                <SelectItem value="fixed-rate">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Fixed Rate (Rate Protection)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {bestRates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Best Exchange Rates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bestRates.map((rate, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? "default" : "secondary"}>
                      {rate.provider}
                    </Badge>
                    {index === 0 && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Best Rate
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">
                      {rate.toAmount.toFixed(6)} {swapForm.toToken}
                    </div>
                    <div className="text-sm text-gray-500">
                      Rate: {rate.rate.toFixed(6)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fee Display with Subscription Discounts */}
      {swapForm.amount && parseFloat(swapForm.amount) > 0 && (
        <SubscriptionFeeDisplay 
          amount={parseFloat(swapForm.amount)}
          feeType="trading"
          showUpgradePrompt={true}
          compact={false}
        />
      )}

      <div className="flex gap-3">
        <Button 
          onClick={handleSwap} 
          disabled={createExchangeMutation.isPending || !swapForm.amount || !swapForm.toAddress}
          className="flex-1"
        >
          {createExchangeMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Creating Exchange...
            </>
          ) : (
            "Create Exchange"
          )}
        </Button>
        <Button 
          variant="outline" 
          onClick={() => swapForm.amount && getRatesMutation.mutate(swapForm.amount)}
          disabled={getRatesMutation.isPending || !swapForm.amount}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}