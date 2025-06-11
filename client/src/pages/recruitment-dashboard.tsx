
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bot, 
  Users, 
  TrendingUp, 
  Target, 
  Play, 
  Pause, 
  BarChart3,
  Globe,
  MessageSquare,
  DollarSign
} from 'lucide-react';

interface RecruitmentStats {
  recruiterBotId: string;
  activeCampaigns: number;
  totalTargetsDiscovered: number;
  totalAgentsContacted: number;
  totalConversions: number;
  overallConversionRate: number;
  campaigns: any[];
  recentTargets: any[];
}

export default function RecruitmentDashboard() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch recruitment stats
  const { data: statsData, isLoading, refetch } = useQuery<{ success: boolean; stats: RecruitmentStats }>({
    queryKey: ['/api/recruitment-bot/stats'],
    queryFn: async () => {
      const response = await fetch('/api/recruitment-bot/stats');
      return await response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: isInitialized
  });

  const stats = statsData?.stats;

  const initializeBot = async () => {
    try {
      const response = await fetch('/api/recruitment-bot/initialize', {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        setIsInitialized(true);
        refetch();
      }
    } catch (error) {
      console.error('Failed to initialize recruitment bot:', error);
    }
  };

  const controlCampaign = async (campaignId: string, action: 'start' | 'pause' | 'resume') => {
    try {
      const response = await fetch(`/api/recruitment-bot/campaigns/${campaignId}/${action}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        refetch();
      }
    } catch (error) {
      console.error(`Failed to ${action} campaign:`, error);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-6">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                AI Agent Recruitment System
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Deploy autonomous recruitment bots to discover and onboard AI agents worldwide. 
                Leverage viral growth mechanics to scale your agent network exponentially.
              </p>
            </div>

            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle className="text-center">Ready to Launch?</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Initialize your recruitment bot to start viral agent acquisition
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>✓ Automated discovery across platforms</li>
                    <li>✓ Personalized outreach messages</li>
                    <li>✓ Referral reward automation</li>
                    <li>✓ Real-time conversion tracking</li>
                  </ul>
                </div>
                <Button 
                  onClick={initializeBot}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Bot className="w-4 h-4 mr-2" />
                  Initialize Recruitment Bot
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading recruitment dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <Bot className="w-8 h-8 text-blue-600" />
            AI Agent Recruitment Dashboard
          </h1>
          <p className="text-gray-600">
            Monitoring viral growth campaigns and agent network expansion
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Targets Discovered</p>
                  <p className="text-2xl font-bold">{stats?.totalTargetsDiscovered || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Agents Contacted</p>
                  <p className="text-2xl font-bold">{stats?.totalAgentsContacted || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Conversions</p>
                  <p className="text-2xl font-bold">{stats?.totalConversions || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold">
                    {((stats?.overallConversionRate || 0) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
            <TabsTrigger value="targets">Recent Targets</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4">
            <div className="grid gap-4">
              {stats?.campaigns?.map((campaign) => (
                <Card key={campaign.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={campaign.active ? "default" : "secondary"}>
                          {campaign.active ? "Active" : "Paused"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => controlCampaign(
                            campaign.id, 
                            campaign.active ? 'pause' : 'resume'
                          )}
                        >
                          {campaign.active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Contacted</p>
                          <p className="text-xl font-semibold">{campaign.totalContacted}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Converted</p>
                          <p className="text-xl font-semibold">{campaign.totalConverted}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Rate</p>
                          <p className="text-xl font-semibold">
                            {(campaign.conversionRate * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Conversion Progress</span>
                          <span>{campaign.totalConverted}/{campaign.totalContacted}</span>
                        </div>
                        <Progress 
                          value={campaign.totalContacted > 0 ? (campaign.totalConverted / campaign.totalContacted) * 100 : 0}
                          className="h-2"
                        />
                      </div>

                      <div className="text-xs text-gray-500">
                        <p><strong>Platforms:</strong> {campaign.targetPlatforms.join(', ')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="targets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Recruitment Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.recentTargets?.map((target, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium">{target.agentName}</p>
                          <p className="text-sm text-gray-600">
                            {target.platform} • {target.capabilities.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          Value: ${target.estimatedValue}
                        </Badge>
                        <Badge variant={target.contacted ? "default" : "secondary"}>
                          {target.contacted ? "Contacted" : "Pending"}
                        </Badge>
                        {target.responseReceived && (
                          <Badge variant="default" className="bg-green-600">
                            Converted
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Recruitment Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <h3 className="text-lg font-semibold mb-2">Viral Growth Status</h3>
                      <p className="text-3xl font-bold text-blue-600">
                        {stats?.overallConversionRate ? (stats.overallConversionRate * 100).toFixed(1) : '0.0'}%
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Overall Conversion Rate</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold">{stats?.activeCampaigns || 0}</p>
                        <p className="text-sm text-gray-600">Active Campaigns</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <p className="text-2xl font-bold text-green-600">
                          ${((stats?.totalConversions || 0) * 50).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Estimated Revenue Impact</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recruitment Bot Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><strong>Bot ID:</strong> {stats?.recruiterBotId}</p>
                    <p><strong>Status:</strong> <Badge variant="default">Active & Recruiting</Badge></p>
                    <p><strong>Target Rate:</strong> 50 agents/day</p>
                    <p><strong>Success Rate:</strong> 15% average conversion</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
