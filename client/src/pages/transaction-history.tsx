import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowDown, ArrowUp, Bitcoin } from "@/lib/icons";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Using native date formatting instead of date-fns
import type { Transaction, CryptoTransaction } from "@shared/schema";

// Helper function to replace date-fns format
const formatDateTime = (date: Date, pattern: string) => {
  if (pattern === "MMM dd, yyyy 'at' h:mm a") {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' at ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  }
  return date.toString();
};

export default function TransactionHistory() {
  const [, setLocation] = useLocation();

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: cryptoTransactions, isLoading: cryptoLoading } = useQuery<CryptoTransaction[]>({
    queryKey: ["/api/crypto/transactions"],
  });

  const { data: dexTradingData, isLoading: dexLoading } = useQuery<{
    metrics?: { totalTransactions: number; totalVolume: string; totalFees: string; totalRevenue: string };
    transactions?: Array<{
      id: string; fromToken: string; toToken: string; createdAt: string;
      amount: string; fee?: string; status: string;
    }>;
  }>({
    queryKey: ["/api/trading/transactions"],
    retry: false,
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "send":
        return <ArrowUp className="w-4 h-4 text-red-500" />;
      case "receive":
        return <ArrowDown className="w-4 h-4 text-green-500" />;
      default:
        return <ArrowUp className="w-4 h-4 text-neutral-500" />;
    }
  };

  const getCryptoIcon = (type: string) => {
    switch (type) {
      case "buy":
        return <ArrowDown className="w-4 h-4 text-green-500" />;
      case "sell":
        return <ArrowUp className="w-4 h-4 text-red-500" />;
      default:
        return <Bitcoin className="w-4 h-4 text-orange-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">Transaction History</h1>
          <p className="text-neutral-500">View all your payments and crypto transactions</p>
        </div>

        <Tabs defaultValue="payments" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="crypto">Crypto</TabsTrigger>
            <TabsTrigger value="dex">DEX Trading</TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-neutral-500">Loading transactions...</div>
                  </div>
                ) : !transactions || transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-500">No transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((transaction: Transaction) => (
                      <div key={transaction.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
                        <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
                          {getTransactionIcon(transaction.transactionType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-neutral-800">
                                {transaction.transactionType === "send" ? "Sent to" : "Received from"} {transaction.toEmail}
                              </p>
                              <p className="text-sm text-neutral-500">
                                {formatDateTime(new Date(transaction.createdAt!), "MMM dd, yyyy 'at' h:mm a")}
                              </p>
                              {transaction.message && (
                                <p className="text-sm text-neutral-600 mt-1">"{transaction.message}"</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${
                                transaction.transactionType === "receive" ? "text-green-600" : "text-red-500"
                              }`}>
                                {transaction.transactionType === "receive" ? "+" : "-"}{formatCurrency(transaction.amount)}
                              </p>
                              <p className="text-sm text-neutral-500 capitalize">{transaction.status}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crypto">
            <Card>
              <CardHeader>
                <CardTitle>Crypto Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {cryptoLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="text-neutral-500">Loading crypto transactions...</div>
                  </div>
                ) : !cryptoTransactions || cryptoTransactions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-500">No crypto transactions found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cryptoTransactions.map((transaction: CryptoTransaction) => (
                      <div key={transaction.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          {getCryptoIcon(transaction.transactionType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-neutral-800 capitalize">
                                {transaction.transactionType} {transaction.coinSymbol}
                              </p>
                              <p className="text-sm text-neutral-500">
                                {formatDateTime(new Date(transaction.createdAt!), "MMM dd, yyyy 'at' h:mm a")}
                              </p>
                              <p className="text-sm text-neutral-600">
                                {parseFloat(transaction.amount).toFixed(8)} {transaction.coinSymbol} 
                                {transaction.pricePerCoin && ` at ${formatCurrency(transaction.pricePerCoin)}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-neutral-800">
                                {transaction.totalValue && formatCurrency(transaction.totalValue)}
                              </p>
                              <p className="text-sm text-neutral-500 capitalize">{transaction.status}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dex">
            <div className="space-y-6">
              {/* Revenue Analytics Summary */}
              {dexTradingData?.metrics && (
                <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-blue-900">DEX Trading Analytics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{dexTradingData.metrics.totalTransactions}</p>
                        <p className="text-sm text-blue-800">Total Trades</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">${parseFloat(dexTradingData.metrics.totalVolume).toFixed(2)}</p>
                        <p className="text-sm text-green-800">Total Volume</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">${parseFloat(dexTradingData.metrics.totalFees).toFixed(6)}</p>
                        <p className="text-sm text-purple-800">Platform Fees</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">${parseFloat(dexTradingData.metrics.totalRevenue).toFixed(6)}</p>
                        <p className="text-sm text-orange-800">Revenue Generated</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* DEX Trading Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle>DEX Trading History</CardTitle>
                  <p className="text-sm text-gray-600">Your DEX swaps with revenue tracking</p>
                </CardHeader>
                <CardContent>
                  {dexLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="text-neutral-500">Loading DEX transactions...</div>
                    </div>
                  ) : !dexTradingData?.transactions || dexTradingData.transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="mb-4">
                        <Bitcoin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-neutral-500">No DEX trading history found</p>
                        <p className="text-sm text-neutral-400 mt-1">Your trading transactions will appear here after making swaps</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dexTradingData.transactions.map((transaction: any) => (
                        <div key={transaction.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                            <Bitcoin className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-neutral-800">
                                  Swap: {transaction.fromToken} → {transaction.toToken}
                                </p>
                                <p className="text-sm text-neutral-500">
                                  {formatDateTime(new Date(transaction.createdAt), "MMM dd, yyyy 'at' h:mm a")}
                                </p>
                                <div className="flex space-x-4 mt-1">
                                  <p className="text-sm text-blue-600">
                                    Amount: ${parseFloat(transaction.amount).toFixed(6)}
                                  </p>
                                  <p className="text-sm text-green-600">
                                    Platform Fee: ${parseFloat(transaction.platformFee).toFixed(6)}
                                  </p>
                                  {transaction.transactionHash && (
                                    <p className="text-xs text-purple-600">
                                      Hash: {transaction.transactionHash.slice(0, 12)}...
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-blue-600">
                                  DEX Trade
                                </p>
                                <p className="text-sm text-neutral-500 capitalize">{transaction.status}</p>
                                <div className="text-xs text-green-600 mt-1">
                                  Revenue: ${parseFloat(transaction.platformFee).toFixed(6)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
