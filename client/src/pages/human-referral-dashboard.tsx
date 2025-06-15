import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, DollarSign, Users, TrendingUp, Wallet } from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  totalCommissions: string;
  pendingCommissions: string;
  referralCode: string;
  referralLink: string;
  recentReferrals: Array<{
    referredUserId: string;
    referredUserEmail: string;
    commissionAmount: string;
    transactionAmount: string;
    isFirstTransaction: boolean;
    createdAt: Date;
  }>;
}

export default function HumanReferralDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch referral stats
  const { data: stats, isLoading, error } = useQuery<ReferralStats>({
    queryKey: ['/api/referrals/my-stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Generate referral link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/referrals/generate-link');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Referral Link Generated",
        description: "Your unique referral link is ready to share",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/referrals/my-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate referral link",
        variant: "destructive",
      });
    },
  });

  // Withdraw commissions mutation
  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      const response = await apiRequest('POST', '/api/referrals/withdraw', { amount });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Withdrawal Successful",
          description: `$${withdrawAmount} transferred to your balance`,
        });
        setWithdrawAmount("");
        queryClient.invalidateQueries({ queryKey: ['/api/referrals/my-stats'] });
      } else {
        toast({
          title: "Withdrawal Failed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid withdrawal amount",
        variant: "destructive",
      });
      return;
    }

    if (stats && amount > parseFloat(stats.pendingCommissions)) {
      toast({
        title: "Insufficient Balance",
        description: `Available balance: $${stats.pendingCommissions}`,
        variant: "destructive",
      });
      return;
    }

    withdrawMutation.mutate(withdrawAmount);
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load referral data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Referral Dashboard</h1>
          <p className="text-muted-foreground">Earn commissions by referring new users to Coin Railz</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalReferrals || 0}</div>
            <p className="text-xs text-muted-foreground">Users you've referred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.totalCommissions || "0.00"}</div>
            <p className="text-xs text-muted-foreground">Lifetime commissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats?.pendingCommissions || "0.00"}</div>
            <p className="text-xs text-muted-foreground">Ready to withdraw</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.3-0.6%</div>
            <p className="text-xs text-muted-foreground">Tiered by volume</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referral Link</CardTitle>
          <CardDescription>
            Share this link to earn tiered commissions: 0.3-0.6% based on transaction volume, plus 0.1% first-transaction bonus
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats?.referralLink ? (
            <div className="flex items-center space-x-2">
              <Input 
                value={stats.referralLink} 
                readOnly 
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(stats.referralLink)}
                disabled={copiedLink}
              >
                <Copy className="h-4 w-4" />
                {copiedLink ? "Copied!" : "Copy"}
              </Button>
            </div>
          ) : (
            <Button 
              onClick={() => generateLinkMutation.mutate()}
              disabled={generateLinkMutation.isPending || isLoading}
            >
              {generateLinkMutation.isPending ? "Generating..." : "Generate Referral Link"}
            </Button>
          )}

          {stats?.referralCode && (
            <div className="text-sm text-muted-foreground">
              Referral Code: <Badge variant="secondary">{stats.referralCode}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdraw Commissions */}
      <Card>
        <CardHeader>
          <CardTitle>Withdraw Commissions</CardTitle>
          <CardDescription>
            Transfer your earned commissions to your main wallet balance (minimum $5.00)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              placeholder="Enter amount"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              min="5"
              step="0.01"
              className="flex-1"
            />
            <Button
              onClick={handleWithdraw}
              disabled={withdrawMutation.isPending || !withdrawAmount || parseFloat(withdrawAmount) < 5}
            >
              {withdrawMutation.isPending ? "Processing..." : "Withdraw"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Available Balance: ${stats?.pendingCommissions || "0.00"}
          </p>
        </CardContent>
      </Card>

      {/* Recent Referrals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Referral Activity</CardTitle>
          <CardDescription>Your latest referral commissions and transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentReferrals && stats.recentReferrals.length > 0 ? (
            <div className="space-y-4">
              {stats.recentReferrals.map((referral, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{referral.referredUserEmail}</div>
                    <div className="text-sm text-muted-foreground">
                      Transaction: ${referral.transactionAmount}
                      {referral.isFirstTransaction && (
                        <Badge variant="secondary" className="ml-2">First Transaction</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">+${referral.commissionAmount}</div>
                    <div className="text-xs text-muted-foreground">Commission</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No referral activity yet</p>
              <p className="text-sm">Share your referral link to start earning commissions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Structure */}
      <Card>
        <CardHeader>
          <CardTitle>Profitable Commission Structure</CardTitle>
          <CardDescription>Sustainable tiered rates that grow with transaction volume</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-purple-600">Tier 1</h4>
              <p className="text-xl font-bold">0.3%</p>
              <p className="text-sm text-muted-foreground">
                $50 - $250 transactions
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-blue-600">Tier 2</h4>
              <p className="text-xl font-bold">0.4%</p>
              <p className="text-sm text-muted-foreground">
                $250 - $1,000 transactions
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-orange-600">Tier 3</h4>
              <p className="text-xl font-bold">0.5%</p>
              <p className="text-sm text-muted-foreground">
                $1,000 - $5,000 transactions
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-green-600">Tier 4</h4>
              <p className="text-xl font-bold">0.6%</p>
              <p className="text-sm text-muted-foreground">
                $5,000+ transactions
              </p>
            </div>
          </div>
          
          <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">First Transaction Bonus</h4>
            <p className="text-sm text-green-600 dark:text-green-400">
              Earn an additional 0.1% commission on your referral's first qualifying transaction
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Minimum transaction amount: $50.00 (ensures meaningful commissions)</p>
            <p>• Maximum commission per transaction: $15.00 (sustainable cap)</p>
            <p>• Minimum withdrawal amount: $2.50</p>
            <p>• 100% profitable on every transaction - aligned with platform sustainability</p>
            <p>• Higher volume transactions earn higher commission rates</p>
          </div>
          
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Example Earnings</h4>
            <div className="text-sm space-y-1 text-blue-600 dark:text-blue-400">
              <p>$100 transaction = $0.30 commission (first time: $0.40)</p>
              <p>$500 transaction = $2.00 commission (first time: $2.50)</p>
              <p>$2,000 transaction = $10.00 commission (first time: $12.00)</p>
              <p>$10,000 transaction = $15.00 commission (capped, first time: $15.00)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}