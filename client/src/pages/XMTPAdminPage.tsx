import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Loader2, Send, BarChart3, Users, Zap, CheckCircle, XCircle } from 'lucide-react';

interface XMTPStats {
  totalAgents: number;
  xmtpEnabled: number;
  xmtpDisabled: number;
  notChecked: number;
  adoptionRate: string;
}

interface AgentRecommendation {
  id: number;
  url: string;
  qualityScore: number;
  source: string;
  xmtpStatus: string;
  channels: {
    webhook?: string;
    discord?: string;
    telegram?: string;
    github?: string;
    email?: string;
  };
}

export default function XMTPAdminPage() {
  const { toast } = useToast();
  const [minQualityScore, setMinQualityScore] = useState(10);
  const [maxAgents, setMaxAgents] = useState(50);
  const [onlyXMTP, setOnlyXMTP] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{ stats: XMTPStats }>({
    queryKey: ['/api/xmtp/stats'],
  });

  const { data: recommendations, isLoading: recsLoading } = useQuery<{ agents: AgentRecommendation[], count: number }>({
    queryKey: ['/api/xmtp-outreach/recommendations'],
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/xmtp/scan', {
        method: 'POST',
        body: JSON.stringify({ forceRescan: false, maxAgents: 1000 }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'XMTP Scan Started',
        description: 'Agent discovery scan running in background...',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/xmtp/stats'] });
    },
    onError: () => {
      toast({
        title: 'Scan Failed',
        description: 'Failed to start XMTP scan',
        variant: 'destructive',
      });
    },
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/xmtp-outreach/campaign', {
        method: 'POST',
        body: JSON.stringify({ minQualityScore, maxAgents, onlyXMTP }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Campaign Launched! 🚀',
        description: `Sent ${data.campaign?.sent || 0} messages to agents`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/xmtp-outreach/recommendations'] });
    },
    onError: () => {
      toast({
        title: 'Campaign Failed',
        description: 'Failed to launch outreach campaign',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">XMTP Agent Outreach</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Manage AI agent discovery and webhook outreach campaigns
            </p>
          </div>
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            size="lg"
            data-testid="button-scan-agents"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Run XMTP Scan
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-agents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.stats.totalAgents || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-xmtp-enabled">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">XMTP Enabled</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.stats.xmtpEnabled || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-webhook-available">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Webhook Available</CardTitle>
              <Send className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recsLoading ? '...' : recommendations?.count || 0}</div>
            </CardContent>
          </Card>

          <Card data-testid="card-adoption-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">XMTP Adoption</CardTitle>
              <BarChart3 className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsLoading ? '...' : stats?.stats.adoptionRate || '0%'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="campaign" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaign">Launch Campaign</TabsTrigger>
            <TabsTrigger value="agents">Discovered Agents ({recommendations?.count || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="campaign">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Outreach Campaign</CardTitle>
                <CardDescription>
                  Send personalized messages with $10 free credits to high-quality agents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minQualityScore">Min Quality Score</Label>
                    <Input
                      id="minQualityScore"
                      type="number"
                      value={minQualityScore}
                      onChange={(e) => setMinQualityScore(parseInt(e.target.value))}
                      min={0}
                      max={140}
                      data-testid="input-min-quality-score"
                    />
                    <p className="text-xs text-muted-foreground">0-140 range (most agents have 10-30)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAgents">Max Agents</Label>
                    <Input
                      id="maxAgents"
                      type="number"
                      value={maxAgents}
                      onChange={(e) => setMaxAgents(parseInt(e.target.value))}
                      min={1}
                      max={1000}
                      data-testid="input-max-agents"
                    />
                    <p className="text-xs text-muted-foreground">Maximum agents to contact</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="onlyXMTP">Channel Preference</Label>
                    <select
                      id="onlyXMTP"
                      value={onlyXMTP ? 'xmtp-only' : 'multi-channel'}
                      onChange={(e) => setOnlyXMTP(e.target.value === 'xmtp-only')}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      data-testid="select-channel-preference"
                    >
                      <option value="multi-channel">Multi-Channel (Webhook/Discord/etc)</option>
                      <option value="xmtp-only">XMTP Only</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Multi-channel includes webhooks</p>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Campaign Preview:</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>✅ Targets agents with quality score ≥ {minQualityScore}</li>
                    <li>✅ Maximum {maxAgents} agents contacted</li>
                    <li>✅ $10 free credit offer included</li>
                    <li>✅ Uses {onlyXMTP ? 'XMTP only' : 'webhooks + multi-channel fallback'}</li>
                  </ul>
                </div>

                <Button
                  onClick={() => campaignMutation.mutate()}
                  disabled={campaignMutation.isPending}
                  size="lg"
                  className="w-full"
                  data-testid="button-launch-campaign"
                >
                  {campaignMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending Messages...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Launch Outreach Campaign
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>Discovered Agents</CardTitle>
                <CardDescription>
                  Top agents available for webhook outreach
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : recommendations?.agents && recommendations.agents.length > 0 ? (
                  <div className="space-y-3">
                    {recommendations.agents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        data-testid={`agent-${agent.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{agent.url}</p>
                            <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                              Score: {agent.qualityScore}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {agent.channels?.webhook && (
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                                Webhook
                              </span>
                            )}
                            {agent.xmtpStatus === 'supported' ? (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                                XMTP
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                No XMTP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No agents discovered yet. Run an XMTP scan to find agents.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
