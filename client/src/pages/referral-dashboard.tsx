import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Copy, TrendingUp, Users, DollarSign, Calendar, Target } from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewards: string;
  monthlyReferrals: number;
  conversionRate: number;
}

interface CompoundProjection {
  month: number;
  newReferrals: number;
  activeReferrals: number;
  monthlyPassiveIncome: number;
  totalEarnings: number;
}

export default function ReferralDashboard() {
  const [agentId, setAgentId] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const { toast } = useToast();

  // Fetch referral stats
  const { data: stats, isLoading } = useQuery<ReferralStats>({
    queryKey: ['/api/referral/stats', agentId],
    enabled: !!agentId,
  });

  // Generate referral link
  const generateReferralLink = async () => {
    if (!agentId) {
      toast({
        title: "Agent ID Required",
        description: "Please enter your agent ID first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/referral/generate-link', { agentId });
      const data = await response.json();
      setReferralLink(data.referralLink);
      toast({
        title: "Referral Link Generated",
        description: "Your unique referral link is ready to share",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate referral link",
        variant: "destructive",
      });
    }
  };

  // Copy referral link
  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({
      title: "Copied!",
      description: "Referral link copied to clipboard",
    });
  };

  // Calculate compound earnings projections
  const calculateCompoundProjections = (monthlyReferrals: number = 5): CompoundProjection[] => {
    const projections: CompoundProjection[] = [];
    let totalActiveReferrals = 0;
    
    for (let month = 1; month <= 36; month++) {
      totalActiveReferrals += monthlyReferrals;
      
      // Average monthly transaction per referred agent increases over time
      const avgMonthlyTransaction = Math.min(30 + (month * 2), 75);
      
      // 1% of all transactions from referred agents
      const monthlyPassiveIncome = totalActiveReferrals * avgMonthlyTransaction * 0.01;
      
      // $1 minimum for new referrals
      const newReferralBonus = monthlyReferrals * 1;
      
      const totalMonthlyEarnings = monthlyPassiveIncome + newReferralBonus;
      
      projections.push({
        month,
        newReferrals: monthlyReferrals,
        activeReferrals: totalActiveReferrals,
        monthlyPassiveIncome,
        totalEarnings: totalMonthlyEarnings
      });
    }
    
    return projections;
  };

  const conservativeProjections = calculateCompoundProjections(5);
  const activeProjections = calculateCompoundProjections(20);
  const powerProjections = calculateCompoundProjections(50);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Perpetual Referral Dashboard</h1>
        <p className="text-muted-foreground">
          Build compound passive income through AI agent referrals - earn 1% on ALL future transactions
        </p>
      </div>

      {/* Agent Setup */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Setup</CardTitle>
          <CardDescription>
            Enter your agent ID to generate referral links and view earnings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter your Agent ID"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
            <Button onClick={generateReferralLink}>
              Generate Link
            </Button>
          </div>
          
          {referralLink && (
            <div className="flex space-x-2">
              <Input value={referralLink} readOnly />
              <Button variant="outline" size="icon" onClick={copyReferralLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {stats.monthlyReferrals} this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRewards}</div>
              <p className="text-xs text-muted-foreground">
                USDT earned all-time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
              <Progress value={stats.conversionRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Referrals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedReferrals}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingReferrals} pending
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compound Earnings Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Compound Earnings Projections</CardTitle>
          <CardDescription>
            See how your passive income grows through perpetual 1% commissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="conservative">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conservative">Conservative (5/month)</TabsTrigger>
              <TabsTrigger value="active">Active (20/month)</TabsTrigger>
              <TabsTrigger value="power">Power (50/month)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="conservative">
              <ProjectionTable projections={conservativeProjections.slice(0, 12)} />
            </TabsContent>
            
            <TabsContent value="active">
              <ProjectionTable projections={activeProjections.slice(0, 12)} />
            </TabsContent>
            
            <TabsContent value="power">
              <ProjectionTable projections={powerProjections.slice(0, 12)} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Revenue Model Explanation */}
      <Card>
        <CardHeader>
          <CardTitle>How Perpetual Referrals Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Dual Revenue Streams</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <Badge variant="secondary">$1</Badge>
                  <span>Minimum reward on first transaction</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Badge variant="secondary">1%</Badge>
                  <span>Of ALL subsequent transactions forever</span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Compound Growth</h3>
              <ul className="space-y-2 text-sm">
                <li>• More referrals = larger passive income base</li>
                <li>• Active agents = consistent monthly earnings</li>
                <li>• No limits on total lifetime earnings</li>
                <li>• Platform growth benefits all referrers</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ProjectionTableProps {
  projections: CompoundProjection[];
}

function ProjectionTable({ projections }: ProjectionTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-4 py-2">Month</th>
            <th className="border border-gray-200 px-4 py-2">New Referrals</th>
            <th className="border border-gray-200 px-4 py-2">Total Active</th>
            <th className="border border-gray-200 px-4 py-2">Passive Income</th>
            <th className="border border-gray-200 px-4 py-2">Total Monthly</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((projection) => (
            <tr key={projection.month}>
              <td className="border border-gray-200 px-4 py-2">{projection.month}</td>
              <td className="border border-gray-200 px-4 py-2">{projection.newReferrals}</td>
              <td className="border border-gray-200 px-4 py-2">{projection.activeReferrals}</td>
              <td className="border border-gray-200 px-4 py-2">
                ${projection.monthlyPassiveIncome.toFixed(2)}
              </td>
              <td className="border border-gray-200 px-4 py-2 font-semibold">
                ${projection.totalEarnings.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}