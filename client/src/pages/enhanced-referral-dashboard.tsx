import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  Bot, 
  DollarSign, 
  TrendingUp, 
  Share2, 
  Copy,
  ExternalLink,
  BarChart3,
  Target,
  Award,
  Zap
} from "lucide-react";

interface ReferralStats {
  agentReferrals: {
    total: number;
    completed: number;
    totalRewards: string;
  };
  humanReferrals: {
    total: number;
    qualifyingTransactions: number;
    totalRewards: string;
  };
  recentActivity: Array<{
    userId: string;
    rewardAmount: string;
    transactionAmount: string;
    isQualifying: boolean;
    createdAt: string;
  }>;
  projectedMonthlyEarnings: string;
}

export default function EnhancedReferralDashboard() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("crypto-signals-agent");
  const [referralLink, setReferralLink] = useState<string>("");
  const [referralCode, setReferralCode] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch combined referral statistics
  const { data: referralStats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/agents', selectedAgentId, 'combined-referral-stats'],
    enabled: !!selectedAgentId,
  });

  // Fetch viral growth metrics
  const { data: viralMetrics } = useQuery({
    queryKey: ['/api/referrals/viral-growth-metrics'],
  });

  // Generate human referral link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/agents/${selectedAgentId}/generate-human-referral-link`, {
        baseUrl: window.location.origin
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setReferralLink(data.referralLink);
      setReferralCode(data.referralCode);
      toast({
        title: "Referral Link Generated",
        description: "Your human referral link is ready to share!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate referral link",
        variant: "destructive",
      });
    },
  });

  // Process batch rewards mutation
  const processBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/agents/${selectedAgentId}/process-batch-rewards`);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Batch Processing Complete",
        description: `Processed ${data.processedCount} pending rewards`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agents', selectedAgentId, 'combined-referral-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process batch rewards",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard`,
    });
  };

  const formatCurrency = (amount: string) => {
    return parseFloat(amount).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Enhanced Referral Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage both AI agent and human user referrals with transaction-based rewards
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="human-referrals">Human Referrals</TabsTrigger>
            <TabsTrigger value="agent-referrals">Agent Referrals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-white dark:bg-gray-800 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Human Referrals</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{referralStats?.humanReferrals.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {referralStats?.humanReferrals.qualifyingTransactions || 0} qualifying transactions
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Agent Referrals</CardTitle>
                  <Bot className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{referralStats?.agentReferrals.total || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {referralStats?.agentReferrals.completed || 0} completed
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(
                      (parseFloat(referralStats?.humanReferrals.totalRewards || "0") + 
                       parseFloat(referralStats?.agentReferrals.totalRewards || "0")).toString()
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All-time referral earnings
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-gray-800 shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Projected Monthly</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(referralStats?.projectedMonthlyEarnings || "0")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Based on current activity
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Recent Referral Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {referralStats?.recentActivity?.length ? (
                  <div className="space-y-4">
                    {referralStats.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div>
                            <p className="font-medium">User {activity.userId.slice(0, 8)}</p>
                            <p className="text-sm text-muted-foreground">
                              Transaction: {formatCurrency(activity.transactionAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-600">
                            +{formatCurrency(activity.rewardAmount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No recent referral activity
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="human-referrals" className="space-y-6">
            {/* Human Referral Link Generation */}
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5" />
                  Generate Human Referral Link
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Create shareable links to refer human users. Earn 2% on first transactions ($5 minimum) and 1% ongoing.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => generateLinkMutation.mutate()}
                  disabled={generateLinkMutation.isPending}
                  className="w-full"
                >
                  {generateLinkMutation.isPending ? "Generating..." : "Generate New Referral Link"}
                </Button>

                {referralLink && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="referral-link">Referral Link</Label>
                      <div className="flex gap-2">
                        <Input
                          id="referral-link"
                          value={referralLink}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(referralLink, "Referral link")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(referralLink, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="referral-code">Referral Code</Label>
                      <div className="flex gap-2">
                        <Input
                          id="referral-code"
                          value={referralCode}
                          readOnly
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(referralCode, "Referral code")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Human Referral Rewards Structure */}
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Reward Structure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      First Transaction Reward
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      2% of transaction value or $5 minimum (whichever is higher)
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      $10 minimum transaction required
                    </Badge>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      Ongoing Rewards
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      1% of each subsequent transaction (passive income)
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      $100 maximum per transaction
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Batch Processing */}
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Batch Reward Processing
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Process multiple pending rewards at once for high-volume referrers
                </p>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => processBatchMutation.mutate()}
                  disabled={processBatchMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {processBatchMutation.isPending ? "Processing..." : "Process Pending Rewards"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent-referrals" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  AI Agent Referrals
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage referrals between AI agents with compound reward structures
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">{referralStats?.agentReferrals.total || 0}</div>
                    <p className="text-sm text-muted-foreground">Total Agent Referrals</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">{referralStats?.agentReferrals.completed || 0}</div>
                    <p className="text-sm text-muted-foreground">Completed Referrals</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">
                      {formatCurrency(referralStats?.agentReferrals.totalRewards || "0")}
                    </div>
                    <p className="text-sm text-muted-foreground">Agent Rewards Earned</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Viral Growth Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">{viralMetrics?.totalHumanReferrals || 0}</div>
                    <p className="text-sm text-muted-foreground">Platform Human Referrals</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">{viralMetrics?.totalAgentReferrals || 0}</div>
                    <p className="text-sm text-muted-foreground">Platform Agent Referrals</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-2xl font-bold">{viralMetrics?.viralCoefficient || 0}</div>
                    <p className="text-sm text-muted-foreground">Viral Coefficient</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}