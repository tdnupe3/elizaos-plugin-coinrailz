import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bitcoin, TrendingUp, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { CryptoHolding } from "@shared/schema";

export function CryptoHoldings() {
  const [, setLocation] = useLocation();

  const { data: holdings, isLoading } = useQuery({
    queryKey: ["/api/crypto/holdings"],
  });

  const { data: prices } = useQuery({
    queryKey: ["/api/crypto/prices"],
  });

  const getCoinIcon = (symbol: string) => {
    const colors = {
      BTC: "bg-amber-500",
      ETH: "bg-blue-600",
      ADA: "bg-blue-500",
      DOT: "bg-pink-500",
    };

    return (
      <div className={`w-8 h-8 ${colors[symbol as keyof typeof colors] || "bg-neutral-500"} rounded-full flex items-center justify-center`}>
        <Bitcoin className="w-4 h-4 text-white" />
      </div>
    );
  };

  const getCoinName = (symbol: string) => {
    const names = {
      BTC: "Bitcoin",
      ETH: "Ethereum",
      ADA: "Cardano",
      DOT: "Polkadot",
    };
    return names[symbol as keyof typeof names] || symbol;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const calculateValue = (holding: CryptoHolding) => {
    if (!prices) return 0;
    const price = (prices as any)[holding.coinSymbol]?.price || 0;
    return parseFloat(holding.amount) * price;
  };

  const getChangePercentage = (symbol: string) => {
    if (!prices) return 0;
    return (prices as any)[symbol]?.change || 0;
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-800">Crypto Holdings</CardTitle>
          <Button 
            variant="link" 
            className="text-purple-600 text-sm font-medium p-0"
            onClick={() => setLocation("/crypto")}
          >
            Manage
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-neutral-200 rounded-full"></div>
                  <div>
                    <div className="h-4 bg-neutral-200 rounded w-20 mb-2"></div>
                    <div className="h-3 bg-neutral-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-neutral-200 rounded w-16 mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-10"></div>
                </div>
              </div>
            ))}
          </div>
        ) : !holdings || !Array.isArray(holdings) || holdings.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bitcoin className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-neutral-500 mb-4">No crypto holdings yet</p>
            <Button 
              onClick={() => setLocation("/crypto")}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Buy Your First Crypto
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.isArray(holdings) && holdings.map((holding: CryptoHolding) => {
              const change = getChangePercentage(holding.coinSymbol);
              const value = calculateValue(holding);
              
              return (
                <div key={holding.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getCoinIcon(holding.coinSymbol)}
                    <div>
                      <p className="font-medium text-neutral-800">{getCoinName(holding.coinSymbol)}</p>
                      <p className="text-sm text-neutral-500">
                        {parseFloat(holding.amount).toFixed(8)} {holding.coinSymbol}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-neutral-800">{formatCurrency(value)}</p>
                    <div className={`text-sm flex items-center ${change > 0 ? "text-green-600" : "text-red-500"}`}>
                      {change > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {Math.abs(change)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
