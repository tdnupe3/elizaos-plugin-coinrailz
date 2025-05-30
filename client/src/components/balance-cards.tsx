import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Bitcoin, Send, Download, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { CryptoHolding } from "@shared/schema";

export function BalanceCards() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: cryptoHoldings } = useQuery({
    queryKey: ["/api/crypto/holdings"],
  });

  const { data: prices } = useQuery({
    queryKey: ["/api/crypto/prices"],
  });

  const calculateCryptoValue = () => {
    if (!cryptoHoldings || !prices) return 0;
    
    return cryptoHoldings.reduce((total: number, holding: CryptoHolding) => {
      const price = (prices as any)[holding.coinSymbol]?.price || 0;
      return total + (parseFloat(holding.amount) * price);
    }, 0);
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Fiat Balance Card */}
      <Card className="bg-white shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-800">USD Balance</h3>
                <p className="text-sm text-neutral-500">Available funds</p>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <span className="text-3xl font-bold text-neutral-800">
              {formatCurrency(user?.usdBalance || "0")}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button 
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
              onClick={() => setLocation("/funds?action=deposit")}
            >
              Add Money
            </Button>
            <Button 
              variant="outline"
              className="flex-1 text-sm font-medium"
              onClick={() => setLocation("/funds?action=withdraw")}
            >
              Withdraw
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Crypto Portfolio Card */}
      <Card className="bg-white shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Bitcoin className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-800">Crypto Portfolio</h3>
                <p className="text-sm text-neutral-500">Total value</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-600 font-medium">+12.5%</div>
            </div>
          </div>
          <div className="mb-4">
            <span className="text-3xl font-bold text-neutral-800">
              {formatCurrency(calculateCryptoValue())}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button 
              className="flex-1 bg-purple-600 text-white hover:bg-purple-700 text-sm font-medium"
              onClick={() => setLocation("/crypto?action=buy")}
            >
              Buy Crypto
            </Button>
            <Button 
              variant="outline"
              className="flex-1 text-sm font-medium"
              onClick={() => setLocation("/crypto?action=sell")}
            >
              Sell
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card className="bg-white shadow-sm border border-neutral-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-neutral-800 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Button 
              variant="ghost"
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 justify-start"
              onClick={() => setLocation("/send")}
            >
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Send className="w-4 h-4 text-green-600" />
              </div>
              <span className="font-medium text-neutral-700">Send Money</span>
            </Button>
            <Button 
              variant="ghost"
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 justify-start"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Download className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-medium text-neutral-700">Request Payment</span>
            </Button>
            <Button 
              variant="ghost"
              className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 justify-start"
              onClick={() => setLocation("/crypto")}
            >
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-violet-600" />
              </div>
              <span className="font-medium text-neutral-700">Exchange Crypto</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
