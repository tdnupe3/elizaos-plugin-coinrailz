import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/lib/icons';
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  id: string;
  transactionId: string;
  amount: string;
  currency: string;
  transactionType: string;
  status: string;
  orderId: string;
  paymentMethod: string;
  createdAt: string;
  metadata?: any;
}

interface AgentEarnings {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  transactionHistory: Transaction[];
}

export default function AgentEarnings() {
  const { data: earnings, isLoading, error } = useQuery<AgentEarnings>({
    queryKey: ['/api/payments/agent/earnings'],
    queryFn: () => apiRequest('GET', '/api/payments/agent/earnings')
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Icons.AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load earnings data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agent Earnings</h1>
        <p className="text-muted-foreground">
          Track your earnings and payment history
        </p>
      </div>

      {/* Earnings Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <Icons.DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${earnings?.totalEarnings?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              From {earnings?.completedPayouts || 0} completed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Icons.Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${earnings?.pendingPayouts?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <Icons.Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">85%</div>
            <p className="text-xs text-muted-foreground">
              Platform takes 15%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Methods */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Methods</CardTitle>
          <CardDescription>
            Configure how you want to receive your earnings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icons.CreditCard className="h-5 w-5" />
                <div>
                  <p className="font-medium">Stripe Connect</p>
                  <p className="text-sm text-muted-foreground">Direct bank transfer</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icons.Wallet className="h-5 w-5" />
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-muted-foreground">PayPal account</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icons.DollarSign className="h-5 w-5" />
                <div>
                  <p className="font-medium">USDC Wallet</p>
                  <p className="text-sm text-muted-foreground">Cryptocurrency wallet</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Icons.Bitcoin className="h-5 w-5" />
                <div>
                  <p className="font-medium">Crypto Wallet</p>
                  <p className="text-sm text-muted-foreground">ETH, BTC, and more</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Your latest earnings and payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {earnings?.transactionHistory?.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Icons.Receipt className="h-8 w-8 mx-auto mb-2" />
                <p>No transactions yet</p>
                <p className="text-sm">Complete your first order to see earnings here</p>
              </div>
            ) : (
              earnings?.transactionHistory?.map((transaction) => (
                <div
                  key={transaction.transactionId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {transaction.transactionType === 'payout' ? (
                        <Icons.ArrowUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <Icons.Clock className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {transaction.transactionType === 'payout' ? 'Payout' : 'Pending Payout'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Order #{transaction.orderId.slice(-8)} • {transaction.paymentMethod}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      ${parseFloat(transaction.amount).toFixed(2)}
                    </p>
                    <Badge 
                      variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}