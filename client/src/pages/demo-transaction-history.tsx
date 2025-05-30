import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Download, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";

// Demo transaction data
const allDemoTransactions = [
  { id: 1, type: "receive", email: "john.doe@email.com", amount: "150.00", date: "2025-01-30", message: "Coffee payment", platform: "Zelle" },
  { id: 2, type: "send", email: "sarah.smith@email.com", amount: "75.00", date: "2025-01-29", message: "Lunch split", platform: "PayPal" },
  { id: 3, type: "receive", email: "alex.wilson@email.com", amount: "250.00", date: "2025-01-28", message: "Freelance work", platform: "Internal" },
  { id: 4, type: "send", email: "mike.chen@email.com", amount: "320.50", date: "2025-01-27", message: "Rent payment", platform: "Zelle" },
  { id: 5, type: "receive", email: "lisa.park@email.com", amount: "85.25", date: "2025-01-26", message: "Dinner split", platform: "CashApp" },
  { id: 6, type: "send", email: "david.lee@email.com", amount: "45.00", date: "2025-01-25", message: "Uber ride share", platform: "PayPal" },
  { id: 7, type: "receive", email: "emma.davis@email.com", amount: "500.00", date: "2025-01-24", message: "Project milestone", platform: "Internal" },
  { id: 8, type: "send", email: "carlos.martinez@email.com", amount: "125.75", date: "2025-01-23", message: "Gym membership", platform: "Zelle" }
];

const allCryptoTransactions = [
  { id: 9, type: "buy", coinSymbol: "BTC", amount: "0.02000000", price: 44500, date: "2025-01-29", total: 890.00 },
  { id: 10, type: "sell", coinSymbol: "ETH", amount: "0.50000000", price: 3150, date: "2025-01-28", total: 1575.00 },
  { id: 11, type: "buy", coinSymbol: "ADA", amount: "1000.00000000", price: 0.82, date: "2025-01-27", total: 820.00 },
  { id: 12, type: "swap", fromCoin: "USDC", toCoin: "DOT", fromAmount: "1000.00", toAmount: "39.84", date: "2025-01-26" },
  { id: 13, type: "buy", coinSymbol: "USDC", amount: "500.00000000", price: 1.00, date: "2025-01-25", total: 500.00 },
  { id: 14, type: "sell", coinSymbol: "BTC", amount: "0.01000000", price: 43800, date: "2025-01-24", total: 438.00 },
  { id: 15, type: "swap", fromCoin: "ETH", toCoin: "ADA", fromAmount: "0.75", toAmount: "2891.56", date: "2025-01-23" }
];

export default function DemoTransactionHistory() {
  const [, setLocation] = useLocation();

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount.replace(',', '')) : amount);
  };

  const getTransactionIcon = (type: string) => {
    if (type === "send") {
      return <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
        <Send className="w-5 h-5 text-red-600" />
      </div>;
    } else if (type === "receive") {
      return <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
        <Download className="w-5 h-5 text-green-600" />
      </div>;
    } else if (type === "buy") {
      return <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
        <TrendingUp className="w-5 h-5 text-blue-600" />
      </div>;
    } else if (type === "sell") {
      return <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
        <TrendingDown className="w-5 h-5 text-orange-600" />
      </div>;
    } else if (type === "swap") {
      return <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
        <ArrowLeftRight className="w-5 h-5 text-purple-600" />
      </div>;
    }
  };

  const getCryptoTransactionDescription = (transaction: any) => {
    if (transaction.type === "swap") {
      return `Swapped ${transaction.fromAmount} ${transaction.fromCoin} to ${transaction.toAmount} ${transaction.toCoin}`;
    } else {
      return `${transaction.type === "buy" ? "Bought" : "Sold"} ${transaction.amount} ${transaction.coinSymbol}`;
    }
  };

  // Combine and sort all transactions by date
  const allTransactions = [
    ...allDemoTransactions.map(t => ({ ...t, category: "fiat" })),
    ...allCryptoTransactions.map(t => ({ ...t, category: "crypto" }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setLocation("/")}
              className="bg-gray-600 border-gray-600 text-white hover:bg-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Transaction History</h1>
              <p className="text-gray-600 mt-1">Complete transaction history (Demo Mode)</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-300">
            Demo Mode
          </Badge>
        </div>

        {/* Transaction List */}
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-800">All Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  {getTransactionIcon(transaction.type)}
                  
                  <div className="flex-1">
                    {transaction.category === "fiat" ? (
                      <>
                        <p className="font-medium text-gray-800">
                          {transaction.type === "send" ? "Sent to" : "Received from"} {(transaction as any).email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.date} • {(transaction as any).platform}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(transaction as any).message}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-gray-800">
                          {getCryptoTransactionDescription(transaction)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {transaction.date}
                          {(transaction as any).total && ` • ${formatCurrency((transaction as any).total)}`}
                        </p>
                        {(transaction as any).price && (
                          <p className="text-xs text-gray-400">
                            Price: {formatCurrency((transaction as any).price)}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="text-right">
                    {transaction.category === "fiat" ? (
                      <p className={`font-semibold ${
                        transaction.type === "receive" ? "text-green-600" : "text-red-500"
                      }`}>
                        {transaction.type === "receive" ? "+" : "-"}{formatCurrency((transaction as any).amount)}
                      </p>
                    ) : (
                      <div>
                        {transaction.type === "swap" ? (
                          <p className="font-semibold text-purple-600">
                            Swap
                          </p>
                        ) : (
                          <p className={`font-semibold ${
                            transaction.type === "buy" ? "text-blue-600" : "text-orange-600"
                          }`}>
                            {formatCurrency(transaction.total)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {transaction.coinSymbol || `${transaction.fromCoin}→${transaction.toCoin}`}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}