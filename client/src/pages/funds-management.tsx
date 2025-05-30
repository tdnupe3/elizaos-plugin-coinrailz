import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CreditCard, Building2, TrendingUp, TrendingDown, Clock, CheckCircle } from "lucide-react";

interface WalletBalance {
  id: number;
  currency: string;
  balance: string;
  availableBalance: string;
  frozenBalance: string;
}

interface Transaction {
  id: number;
  type: string;
  method: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  category: string;
  bankAccount?: string;
  platformFee?: string;
}

export default function FundsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("bank_transfer");
  const [withdrawAccount, setWithdrawAccount] = useState("");

  const { data: balances, isLoading: balancesLoading } = useQuery<WalletBalance[]>({
    queryKey: ["/api/wallet/balances"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/wallet/transactions"],
  });

  const depositMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/wallet/deposit", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Deposit Initiated",
        description: "Your deposit has been processed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setDepositAmount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Deposit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/wallet/withdraw", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Initiated",
        description: "Your withdrawal is being processed. Funds will arrive in 1-3 business days.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      setWithdrawAmount("");
      setWithdrawAccount("");
    },
    onError: (error: Error) => {
      toast({
        title: "Withdrawal Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid deposit amount.",
        variant: "destructive",
      });
      return;
    }

    depositMutation.mutate({
      amount: depositAmount,
      currency: "USD",
      method: depositMethod,
    });
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount.",
        variant: "destructive",
      });
      return;
    }

    if (!withdrawAccount.trim()) {
      toast({
        title: "Bank Account Required",
        description: "Please enter your bank account details.",
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate({
      amount: withdrawAmount,
      currency: "USD",
      bankAccount: withdrawAccount,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
      case 'processing':
        return <Clock className="h-4 w-4 text-slate-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatAmount = (amount: string, currency: string = 'USD') => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(num);
  };

  const usdBalance = balances?.find(b => b.currency === 'USD');

  if (balancesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Funds Management</h1>
        <p className="text-muted-foreground">Deposit and withdraw funds from your digital wallet</p>
      </div>

      {/* Wallet Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usdBalance ? formatAmount(usdBalance.balance) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              USD Wallet
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {usdBalance ? formatAmount(usdBalance.availableBalance) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frozen</CardTitle>
            <TrendingDown className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-600">
              {usdBalance ? formatAmount(usdBalance.frozenBalance) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Processing transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Deposit and Withdraw */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Funds</CardTitle>
            <CardDescription>
              Add money to your wallet or withdraw to your bank account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="deposit" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="deposit" className="space-y-4">
                <form onSubmit={handleDeposit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="depositAmount">Amount</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      step="0.01"
                      min="1"
                      max="10000"
                      placeholder="Enter amount"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="depositMethod">Funding Method</Label>
                    <Select value={depositMethod} onValueChange={setDepositMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select funding method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="debit_card">Debit Card</SelectItem>
                        <SelectItem value="ach">ACH Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 p-3 rounded">
                    <p className="font-medium mb-1">Deposit Fees:</p>
                    <ul className="text-xs space-y-1">
                      <li>• Bank Transfer: Free (3-5 business days)</li>
                      <li>• Debit Card: 2.9% fee (Instant)</li>
                      <li>• ACH Transfer: $0.25 fee (1-2 business days)</li>
                    </ul>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={depositMutation.isPending}
                  >
                    {depositMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        Processing...
                      </div>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Deposit Funds
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="withdraw" className="space-y-4">
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="withdrawAmount">Amount</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      step="0.01"
                      min="10"
                      max={usdBalance ? parseFloat(usdBalance.availableBalance) : 0}
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="withdrawAccount">Bank Account</Label>
                    <Input
                      id="withdrawAccount"
                      type="text"
                      placeholder="Account ending in 1234"
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                    />
                  </div>

                  <div className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-800 p-3 rounded">
                    <p className="font-medium mb-1">Withdrawal Info:</p>
                    <ul className="text-xs space-y-1">
                      <li>• Minimum: $10.00</li>
                      <li>• Fee: $2.50 per withdrawal</li>
                      <li>• Processing: 1-3 business days</li>
                    </ul>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={withdrawMutation.isPending}
                  >
                    {withdrawMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                        Processing...
                      </div>
                    ) : (
                      <>
                        <Building2 className="mr-2 h-4 w-4" />
                        Withdraw Funds
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest deposits and withdrawals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <p className="font-medium capitalize">
                          {transaction.type} - {transaction.method.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'deposit' ? '+' : '-'}{formatAmount(transaction.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {transaction.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm">Make your first deposit to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}