import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  CreditCard,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface CreditTransaction {
  id: number;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  description: string;
  paymentMethod?: string;
  serviceName?: string;
  referenceId?: string;
  createdAt: string;
}

export default function CreditsPage() {
  const { toast } = useToast();
  const [purchaseAmount, setPurchaseAmount] = useState('50');
  const [cryptoAmount, setCryptoAmount] = useState('');
  const [txHash, setTxHash] = useState('');

  const { data: balanceData, isLoading: balanceLoading } = useQuery<{ balance: number }>({
    queryKey: ['/api/credits/balance'],
  });

  const { data: transactionsData } = useQuery<{ transactions: CreditTransaction[] }>({
    queryKey: ['/api/credits/transactions'],
  });

  const stripePurchaseMutation = useMutation({
    mutationFn: (amount: number) =>
      apiRequest('/api/credits/purchase/stripe', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to create checkout session",
        variant: "destructive"
      });
    }
  });

  const cryptoPurchaseMutation = useMutation({
    mutationFn: (data: { txHash: string; token: string; chain: string; amount: string }) =>
      apiRequest('/api/credits/purchase/crypto', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/credits/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/credits/transactions'] });
      toast({
        title: "Credits Added",
        description: "Your crypto payment was verified and credits added successfully",
      });
      setTxHash('');
      setCryptoAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to verify crypto payment",
        variant: "destructive"
      });
    }
  });

  const handleStripePurchase = () => {
    const amount = parseFloat(purchaseAmount);
    if (amount < 10) {
      toast({
        title: "Invalid Amount",
        description: "Minimum purchase is $10",
        variant: "destructive"
      });
      return;
    }
    stripePurchaseMutation.mutate(amount);
  };

  const handleCryptoPurchase = () => {
    if (!txHash || !cryptoAmount) {
      toast({
        title: "Missing Information",
        description: "Please provide transaction hash and amount",
        variant: "destructive"
      });
      return;
    }
    cryptoPurchaseMutation.mutate({
      txHash,
      token: 'usdc',
      chain: 'base',
      amount: cryptoAmount
    });
  };

  const copyPlatformAddress = () => {
    const address = "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91";
    navigator.clipboard.writeText(address);
    toast({
      title: "Copied",
      description: "Platform wallet address copied to clipboard"
    });
  };

  const balance = balanceData?.balance || 0;
  const transactions = (transactionsData?.transactions || []) as CreditTransaction[];

  const thisMonth = transactions
    .filter(t => t.type === 'purchase' && new Date(t.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const lastMonth = transactions
    .filter(t => {
      const txDate = new Date(t.createdAt);
      const now = new Date();
      return t.type === 'purchase' && 
        txDate.getMonth() === (now.getMonth() - 1) && 
        txDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalSpent = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  const totalAdded = transactions
    .filter(t => t.type === 'purchase')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 dark:from-background dark:via-background dark:to-muted/10">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
              Credits Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Manage your prepaid credits for x402 micropayment services
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/credits/balance'] });
              queryClient.invalidateQueries({ queryKey: ['/api/credits/transactions'] });
            }}
            data-testid="button-refresh-credits"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <Card className="lg:col-span-2 bg-card dark:bg-card border-border dark:border-border" data-testid="card-balance-main">
            <CardHeader>
              <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                Available Balance
              </p>
              <CardTitle className="text-7xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground" data-testid="text-balance-amount">
                ${balance.toFixed(2)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Ready for instant payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                    This Month
                  </p>
                  <p className="text-3xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                    ${thisMonth.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Added to account</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                    Last Month
                  </p>
                  <p className="text-3xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                    ${lastMonth.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {thisMonth > lastMonth ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" />
                        {((thisMonth - lastMonth) / lastMonth * 100).toFixed(0)}% increase
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Previous period</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-total-spent">
              <CardHeader className="pb-3">
                <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                  Total Spent
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                  ${totalSpent.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">On API calls</p>
              </CardContent>
            </Card>

            <Card className="bg-card dark:bg-card border-border dark:border-border" data-testid="card-total-added">
              <CardHeader className="pb-3">
                <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                  Total Added
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold font-['Space_Grotesk'] text-foreground dark:text-foreground">
                  ${totalAdded.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Lifetime purchases</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk']">Purchase Credits</CardTitle>
            <CardDescription>
              Add credits to your account using credit card or cryptocurrency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="stripe" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="stripe" data-testid="tab-stripe">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Credit Card
                </TabsTrigger>
                <TabsTrigger value="crypto" data-testid="tab-crypto">
                  <Wallet className="h-4 w-4 mr-2" />
                  USDC/USDT
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stripe" className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="stripe-amount">Amount (USD)</Label>
                  <div className="flex gap-4">
                    <Input
                      id="stripe-amount"
                      type="number"
                      min="10"
                      step="10"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      placeholder="50"
                      data-testid="input-stripe-amount"
                    />
                    <Button
                      onClick={handleStripePurchase}
                      disabled={stripePurchaseMutation.isPending}
                      className="whitespace-nowrap"
                      data-testid="button-purchase-stripe"
                    >
                      {stripePurchaseMutation.isPending ? "Processing..." : "Purchase with Card"}
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">Minimum purchase: $10</p>
                </div>

                <div className="flex gap-2 mt-4">
                  {[10, 25, 50, 100, 250].map(amount => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setPurchaseAmount(amount.toString())}
                      data-testid={`button-quick-${amount}`}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="crypto" className="space-y-4 mt-6">
                <div className="bg-muted/50 dark:bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Platform Wallet (Base Chain)</p>
                      <code className="text-xs text-muted-foreground break-all">
                        0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
                      </code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyPlatformAddress}
                      data-testid="button-copy-address"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send USDC or USDT on Base Chain to this address
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="crypto-amount">Amount Sent (USD)</Label>
                    <Input
                      id="crypto-amount"
                      type="number"
                      step="0.01"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      placeholder="100.00"
                      data-testid="input-crypto-amount"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tx-hash">Transaction Hash</Label>
                    <Input
                      id="tx-hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x..."
                      data-testid="input-tx-hash"
                    />
                  </div>

                  <Button
                    onClick={handleCryptoPurchase}
                    disabled={cryptoPurchaseMutation.isPending}
                    className="w-full"
                    data-testid="button-verify-crypto"
                  >
                    {cryptoPurchaseMutation.isPending ? "Verifying..." : "Verify & Add Credits"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-card border-border dark:border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-['Space_Grotesk']">Transaction History</CardTitle>
            <CardDescription>All credit purchases and service payments</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">Amount</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                      <TableCell className="text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {tx.type === 'purchase' ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                            <ArrowUp className="h-3 w-3 mr-1" />
                            Purchase
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                            <ArrowDown className="h-3 w-3 mr-1" />
                            Payment
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-md truncate">
                        {tx.description}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${parseFloat(tx.amount) > 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground dark:text-foreground'}`}>
                        {parseFloat(tx.amount) > 0 ? '+' : ''}${parseFloat(tx.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${parseFloat(tx.balanceAfter).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
