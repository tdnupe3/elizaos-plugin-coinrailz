import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowDown, ArrowUp, Bitcoin } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Using native date formatting instead of date-fns
import type { Transaction, CryptoTransaction } from "@shared/schema";

export default function TransactionHistory() {
  const [, setLocation] = useLocation();

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  const { data: cryptoTransactions, isLoading: cryptoLoading } = useQuery({
    queryKey: ["/api/crypto/transactions"],
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="crypto">Crypto</TabsTrigger>
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
                                {format(new Date(transaction.createdAt!), "MMM dd, yyyy 'at' h:mm a")}
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
                                {format(new Date(transaction.createdAt!), "MMM dd, yyyy 'at' h:mm a")}
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
        </Tabs>
      </main>
    </div>
  );
}
