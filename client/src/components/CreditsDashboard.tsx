import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, TrendingUp, TrendingDown, DollarSign, CreditCard, Award, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreditsBalance {
  creditsBalance: number;
  dollarValue: string;
  monthlySpendTotal: number;
  monthlySpendingLimit: number;
  monthlyRemaining: number;
  maxAutoApprovePayment: number;
  successfulTransactions: number;
  freeCreditsGranted: boolean;
}

interface CreditTransaction {
  id: number;
  type: string;
  amount: number;
  dollarValue: number;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export function CreditsDashboard() {
  const { toast } = useToast();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('10');

  const { data: balance, isLoading, isError: balanceError } = useQuery<{ success: boolean; data?: CreditsBalance }>({
    queryKey: ['/api/credits/balance'],
    retry: false,
  });

  const { data: transactions, isError: transactionsError } = useQuery<{ success: boolean; data?: CreditTransaction[] }>({
    queryKey: ['/api/credits/transactions'],
    retry: false,
  });

  const isAuthenticated = balance?.success && !balanceError;

  // Preview data for unauthenticated users (shows UI, prompts signup)
  const previewBalance: CreditsBalance = {
    creditsBalance: 100,
    dollarValue: '10.00',
    monthlySpendTotal: 0,
    monthlySpendingLimit: 1100,
    monthlyRemaining: 1100,
    maxAutoApprovePayment: 100,
    successfulTransactions: 0,
    freeCreditsGranted: true,
  };

  const claimFreeCredits = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/credits/claim-free', 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/credits/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/transactions'] });
      toast({
        title: "Free Credits Claimed!",
        description: "$1 (10 credits) added to your account",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Claim Credits",
        description: error?.message || "Unable to claim free credits. Please try again.",
        variant: "destructive",
      });
    },
  });

  const purchaseCredits = useMutation({
    mutationFn: async (amount: number) => {
      return await apiRequest('/api/credits/purchase', 'POST', { amount });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/credits/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/transactions'] });
      setIsPurchaseModalOpen(false);
      toast({
        title: "Credits Purchased!",
        description: `Added ${data.creditsAdded} credits ($${data.dollarAmount})`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error?.message || "Unable to purchase credits. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-48 bg-muted rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-32 bg-muted rounded-xl"></div>
            <div className="h-32 bg-muted rounded-xl"></div>
            <div className="h-32 bg-muted rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const credits = isAuthenticated && balance?.data ? balance.data : previewBalance;
  const percentSpent = (credits.monthlySpendTotal / credits.monthlySpendingLimit) * 100;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8" data-testid="credits-dashboard">
      {/* Main Balance Card */}
      <Card className="p-8 lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                AVAILABLE CREDITS
              </div>
              <div className="text-6xl md:text-7xl font-bold font-[Space_Grotesk] text-blue-900 dark:text-blue-100" data-testid="credits-balance">
                {credits.creditsBalance.toFixed(0)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                ≈ ${credits.dollarValue} USD
              </div>
            </div>

            {/* Transaction Success Badge */}
            <div className="inline-flex items-center gap-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2 rounded-full" data-testid="transaction-badge">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium text-sm">Successful</span>
              <span className="bg-green-200 dark:bg-green-800 px-3 py-0.5 rounded-full text-xs font-semibold" data-testid="transaction-count">
                {credits.successfulTransactions}
              </span>
            </div>

            {/* Free Credits CTA - Available for all users */}
            {!credits.freeCreditsGranted && (
              <Button
                onClick={() => claimFreeCredits.mutate()}
                disabled={claimFreeCredits.isPending}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                data-testid="button-claim-free-credits"
              >
                <Award className="w-4 h-4 mr-2" />
                Claim $1 Free Credits
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4 md:text-right">
            <Button 
              variant="default" 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-add-credits"
              onClick={() => setIsPurchaseModalOpen(true)}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Add Credits
            </Button>
            <div className="text-xs text-muted-foreground">
              Min. $10 (100 credits)
            </div>
          </div>
        </div>

        {/* Monthly Spend Indicator */}
        <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Monthly Spend</span>
            <span className="text-sm font-semibold">
              ${credits.monthlySpendTotal.toFixed(2)} / ${credits.monthlySpendingLimit.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                percentSpent > 80 ? 'bg-red-500' : percentSpent > 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(percentSpent, 100)}%` }}
            ></div>
          </div>
        </div>
      </Card>

      {/* Running Total Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* This Month Widget */}
        <Card className="p-6 hover:shadow-lg transition-all" data-testid="widget-monthly-spend">
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              THIS MONTH
            </div>
            <div className="text-5xl font-bold font-[Space_Grotesk]" data-testid="text-monthly-spend">
              ${credits.monthlySpendTotal.toFixed(0)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              {credits.monthlySpendTotal > 50 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-green-600 font-medium">+{percentSpent.toFixed(0)}% of limit</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-600 font-medium">{(100 - percentSpent).toFixed(0)}% available</span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Remaining Budget Widget */}
        <Card className="p-6 hover:shadow-lg transition-all" data-testid="widget-remaining-budget">
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              REMAINING BUDGET
            </div>
            <div className="text-5xl font-bold font-[Space_Grotesk] text-green-600" data-testid="text-remaining-budget">
              ${credits.monthlyRemaining.toFixed(0)}
            </div>
            <div className="text-sm text-muted-foreground">
              Auto-approve limit: ${credits.maxAutoApprovePayment.toFixed(2)}
            </div>
          </div>
        </Card>

        {/* Total Credits Widget */}
        <Card className="p-6 hover:shadow-lg transition-all bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800" data-testid="widget-total-credits">
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              CREDIT BALANCE
            </div>
            <div className="text-5xl font-bold font-[Space_Grotesk] text-purple-600 dark:text-purple-400" data-testid="text-credit-balance">
              {credits.creditsBalance.toFixed(0)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-purple-500" />
              <span className="text-purple-600 dark:text-purple-400 font-medium">
                ${credits.dollarValue} available
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Transactions */}
      {transactions?.data && transactions.data.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
          <div className="space-y-2">
            {transactions.data.slice(0, 10).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                data-testid={`transaction-${tx.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    tx.type === 'purchase' ? 'bg-green-500' :
                    tx.type === 'bonus' ? 'bg-blue-500' :
                    tx.type === 'usage' ? 'bg-orange-500' : 'bg-gray-500'
                  }`}></div>
                  <div>
                    <div className="font-medium text-sm">{tx.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} credits
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Balance: {tx.balanceAfter.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Purchase Credits Modal */}
      <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
        <DialogContent data-testid="modal-purchase-credits">
          <DialogHeader>
            <DialogTitle>Purchase Credits</DialogTitle>
            <DialogDescription>
              Add credits to your account. Minimum purchase is $10 (100 credits).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                min="10"
                step="10"
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
                placeholder="10"
                data-testid="input-purchase-amount"
              />
              <p className="text-sm text-muted-foreground">
                = {(parseFloat(purchaseAmount) * 10 || 0).toFixed(0)} credits
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsPurchaseModalOpen(false)}
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const amount = parseFloat(purchaseAmount);
                  if (isFinite(amount) && amount >= 10) {
                    purchaseCredits.mutate(amount);
                  }
                }}
                disabled={
                  purchaseCredits.isPending || 
                  !isFinite(parseFloat(purchaseAmount)) || 
                  parseFloat(purchaseAmount) < 10
                }
                data-testid="button-confirm-purchase"
              >
                {purchaseCredits.isPending ? 'Processing...' : 'Purchase'}
              </Button>
            </div>
            {(!isFinite(parseFloat(purchaseAmount)) || parseFloat(purchaseAmount) < 10) && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Please enter a valid amount of $10 or more
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
