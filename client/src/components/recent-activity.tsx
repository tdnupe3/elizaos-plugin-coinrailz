import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Bitcoin } from "@/lib/icons";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
// Using native date formatting instead of date-fns
import type { Transaction } from "@shared/schema";

export function RecentActivity() {
  const [, setLocation] = useLocation();

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

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

  const getTimeAgo = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return "Recently";
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-800">Recent Activity</CardTitle>
          <Button 
            variant="link" 
            className="text-blue-600 text-sm font-medium p-0"
            onClick={() => setLocation("/history")}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-neutral-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/2"></div>
                </div>
                <div className="h-4 bg-neutral-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500">No recent transactions</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 3).map((transaction: Transaction) => (
              <div key={transaction.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors">
                {getTransactionIcon(transaction.transactionType)}
                <div className="flex-1">
                  <p className="font-medium text-neutral-800">
                    {transaction.transactionType === "send" ? "Sent to" : "Received from"} {transaction.toEmail}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {getTimeAgo(transaction.createdAt?.toISOString() ?? new Date().toISOString())}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${
                    transaction.transactionType === "receive" ? "text-green-600" : "text-red-500"
                  }`}>
                    {transaction.transactionType === "receive" ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
