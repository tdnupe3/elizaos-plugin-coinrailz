import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Bitcoin, Send, Download, ArrowLeftRight, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation } from "wouter";

// Sample data for demo mode
const demoUser = {
  firstName: "Demo",
  lastName: "User",
  email: "demo@moneyrailz.com",
  usdBalance: "2,847.50"
};

const demoCryptoHoldings = [
  { id: 1, coinSymbol: "BTC", coinName: "Bitcoin", amount: "0.05673421", currentPrice: 45000 },
  { id: 2, coinSymbol: "ETH", coinName: "Ethereum", amount: "1.23456789", currentPrice: 3200 },
  { id: 3, coinSymbol: "ADA", coinName: "Cardano", amount: "2847.50000000", currentPrice: 0.85 }
];

const demoTransactions = [
  { id: 1, type: "receive", email: "john.doe@email.com", amount: "150.00", date: "2025-01-30", message: "Coffee payment" },
  { id: 2, type: "send", email: "sarah.smith@email.com", amount: "75.00", date: "2025-01-29", message: "Lunch split" },
  { id: 3, type: "receive", email: "alex.wilson@email.com", amount: "250.00", date: "2025-01-28", message: "Freelance work" }
];

const demoPrices = {
  BTC: { price: 45000, change: 5.2 },
  ETH: { price: 3200, change: -2.1 },
  ADA: { price: 0.85, change: 1.8 },
  DOT: { price: 25.30, change: 3.4 }
};

function DemoModeHeader() {
  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-300">
            Demo Mode
          </Badge>
          <span className="text-sm text-violet-700">
            You're exploring Coin Railz with sample data
          </span>
        </div>
        <Button 
          size="sm"
          onClick={() => window.location.href = "/api/login"}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Sign Up for Real Account
        </Button>
      </div>
    </div>
  );
}

function DemoBalanceCards() {
  const [, setLocation] = useLocation();

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount.replace(',', '')) : amount);
  };

  const calculateCryptoValue = () => {
    return demoCryptoHoldings.reduce((total, holding) => {
      return total + (parseFloat(holding.amount) * holding.currentPrice);
    }, 0);
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
              {formatCurrency(demoUser.usdBalance)}
            </span>
          </div>
          <div className="flex space-x-2">
            <Button 
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium"
              onClick={() => setLocation("/demo/funds?action=deposit")}
            >
              Add Money
            </Button>
            <Button 
              variant="outline"
              className="flex-1 text-sm font-medium"
              onClick={() => setLocation("/demo/funds?action=withdraw")}
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
              onClick={() => setLocation("/demo/crypto?action=buy")}
            >
              Buy Crypto
            </Button>
            <Button 
              variant="outline"
              className="flex-1 text-sm font-medium"
              onClick={() => setLocation("/demo/crypto?action=sell")}
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
              onClick={() => setLocation("/demo/send")}
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
              onClick={() => setLocation("/demo/crypto")}
            >
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <ArrowLeftRight className="w-4 h-4 text-orange-600" />
              </div>
              <span className="font-medium text-neutral-700">Exchange Crypto</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DemoRecentActivity() {
  const [, setLocation] = useLocation();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "send":
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <ArrowUp className="w-4 h-4 text-red-500" />
          </div>
        );
      case "receive":
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <ArrowDown className="w-4 h-4 text-green-500" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
            <ArrowUp className="w-4 h-4 text-neutral-500" />
          </div>
        );
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-800">Recent Activity</CardTitle>
          <Button 
            variant="link" 
            className="text-blue-600 text-sm font-medium p-0"
            onClick={() => setLocation("/demo/history")}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {demoTransactions.slice(0, 3).map((transaction) => (
            <div key={transaction.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors">
              {getTransactionIcon(transaction.type)}
              <div className="flex-1">
                <p className="font-medium text-neutral-800">
                  {transaction.type === "send" ? "Sent to" : "Received from"} {transaction.email}
                </p>
                <p className="text-sm text-neutral-500">
                  {transaction.date}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-semibold ${
                  transaction.type === "receive" ? "text-green-600" : "text-red-500"
                }`}>
                  {transaction.type === "receive" ? "+" : "-"}{formatCurrency(transaction.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoCryptoHoldings() {
  const [, setLocation] = useLocation();

  const getCoinIcon = (symbol: string) => {
    const colors = {
      BTC: "bg-orange-500",
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getChangePercentage = (symbol: string) => {
    return demoPrices[symbol as keyof typeof demoPrices]?.change || 0;
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-800">Crypto Holdings</CardTitle>
          <Button 
            variant="link" 
            className="text-purple-600 text-sm font-medium p-0"
            onClick={() => setLocation("/demo/crypto")}
          >
            Manage
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {demoCryptoHoldings.map((holding) => {
            const change = getChangePercentage(holding.coinSymbol);
            const value = parseFloat(holding.amount) * holding.currentPrice;
            
            return (
              <div key={holding.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getCoinIcon(holding.coinSymbol)}
                  <div>
                    <p className="font-medium text-neutral-800">{holding.coinName}</p>
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
      </CardContent>
    </Card>
  );
}

export default function DemoDashboard() {
  return (
    <div className="min-h-screen bg-gray-100">
      <NavigationHeader isDemo={true} />
      <DemoModeHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800 mb-2">
            Welcome back, {demoUser.firstName}!
          </h1>
          <p className="text-neutral-500">Manage your payments and crypto portfolio</p>
        </div>

        <DemoBalanceCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white shadow-sm border border-neutral-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-semibold text-neutral-800">Send Money (Demo)</CardTitle>
                  <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-300">
                    Preview Mode
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-neutral-600 mb-4">This is a preview of the send money feature</p>
                  <Button onClick={() => window.location.href = "/api/login"}>
                    Sign Up to Send Real Money
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <DemoRecentActivity />
            <DemoCryptoHoldings />
          </div>
        </div>
      </main>
    </div>
  );
}