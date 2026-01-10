import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import MobileNavigation from '@/components/MobileNavigation';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Rocket, 
  Wallet,
  PlayCircle,
  StopCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Coins
} from 'lucide-react';

interface LaunchRecord {
  id: string;
  tokenMint?: string;
  metadata: { name: string; symbol: string; description: string };
  status: string;
  launchTime: string;
  costSol: number;
  recoverySol: number;
  profitLossSol: number;
  pumpfunUrl?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  mode: 'paper' | 'live';
  config: {
    targetLaunches: number;
    initialLiquiditySol: number;
    delayBetweenLaunchesMs: number;
  };
  stats: {
    totalLaunches: number;
    successfulLaunches: number;
    failedLaunches: number;
    totalSpentSol: number;
    totalRecoveredSol: number;
    profitLossSol: number;
    profitLossUsd: number;
  };
  launches: LaunchRecord[];
}

interface LauncherStatus {
  wallet: {
    address: string;
    balanceSol: number;
    balanceUsd: number;
    network: string;
    initialized: boolean;
  };
  activeCampaign: Campaign | null;
  isRunning: boolean;
  totalCampaigns: number;
}

export default function TokenLauncher() {
  const [liveMode, setLiveMode] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [targetLaunches, setTargetLaunches] = useState(5);
  const [initialLiquidity, setInitialLiquidity] = useState(0.1);

  const { data: status, isLoading, refetch } = useQuery<{ success: boolean; data: LauncherStatus }>({
    queryKey: ['/api/launcher/status'],
    refetchInterval: 3000
  });

  const { data: campaigns } = useQuery<{ success: boolean; data: Campaign[] }>({
    queryKey: ['/api/launcher/campaigns']
  });

  const singleLaunchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/launcher/single-launch', {
        method: 'POST',
        body: JSON.stringify({ mode: liveMode ? 'live' : 'paper' })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launcher/status'] });
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/launcher/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: campaignName || `Campaign ${Date.now()}`,
          config: {
            targetLaunches,
            initialLiquiditySol: initialLiquidity,
            delayBetweenLaunchesMs: 10000
          },
          mode: liveMode ? 'live' : 'paper'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launcher/campaigns'] });
      setCampaignName('');
    }
  });

  const startCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/launcher/campaigns/${campaignId}/start`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launcher/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/launcher/campaigns'] });
    }
  });

  const stopCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/launcher/campaigns/${campaignId}/stop`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launcher/status'] });
    }
  });

  const launcherData = status?.data;
  const campaignList = campaigns?.data || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <MobileNavigation />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Rocket className="h-8 w-8 text-purple-500" />
                PumpFun Token Launcher
              </h1>
              <p className="text-gray-400 mt-2">Launch meme tokens and target trading bots</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="live-mode" className="text-sm">Paper</Label>
                <Switch 
                  id="live-mode" 
                  checked={liveMode} 
                  onCheckedChange={setLiveMode}
                />
                <Label htmlFor="live-mode" className="text-sm">Live</Label>
              </div>
              <Badge className={liveMode ? 'bg-red-600' : 'bg-blue-600'}>
                {liveMode ? 'LIVE MODE' : 'PAPER MODE'}
              </Badge>
            </div>
          </div>
        </div>

        {liveMode && (
          <Card className="mb-6 bg-red-900/20 border-red-600">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-semibold text-red-400">Live Mode - View Only</p>
                <p className="text-sm text-red-300">
                  Live operations require authenticated API access. Use the CLI or direct API calls with TOKEN_LAUNCHER_API_SECRET.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Wallet Balance</p>
                  <p className="text-2xl font-bold text-green-400">
                    {launcherData?.wallet?.balanceSol?.toFixed(4) || '0'} SOL
                  </p>
                  <p className="text-sm text-gray-500">
                    ~${launcherData?.wallet?.balanceUsd?.toFixed(2) || '0'}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Status</p>
                  <p className="text-2xl font-bold">
                    {launcherData?.isRunning ? (
                      <span className="text-yellow-400">Running</span>
                    ) : (
                      <span className="text-gray-300">Idle</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {launcherData?.wallet?.network || 'devnet'}
                  </p>
                </div>
                {launcherData?.isRunning ? (
                  <Zap className="h-8 w-8 text-yellow-500 animate-pulse" />
                ) : (
                  <Clock className="h-8 w-8 text-gray-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Campaigns</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {launcherData?.totalCampaigns || 0}
                  </p>
                </div>
                <Target className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Campaign</p>
                  <p className="text-lg font-bold truncate">
                    {launcherData?.activeCampaign?.name || 'None'}
                  </p>
                </div>
                <RefreshCw 
                  className={`h-8 w-8 text-blue-500 cursor-pointer hover:text-blue-400 ${isLoading ? 'animate-spin' : ''}`}
                  onClick={() => refetch()}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="quick-launch" className="space-y-6">
          <TabsList className="bg-gray-800">
            <TabsTrigger value="quick-launch">Quick Launch</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-launch" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Single Token Launch
                  </CardTitle>
                  <CardDescription>Launch one token with bot-attractive metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-400">
                    Generates random meme token with optimized name, symbol, and description designed to attract trading bots.
                  </p>
                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={() => singleLaunchMutation.mutate()}
                    disabled={singleLaunchMutation.isPending || liveMode}
                  >
                    {singleLaunchMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    {liveMode ? 'Use API for Live Mode' : 'Launch Token (Paper)'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-500" />
                    Create Campaign
                  </CardTitle>
                  <CardDescription>Launch multiple tokens in sequence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="campaign-name">Campaign Name</Label>
                    <Input 
                      id="campaign-name"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="My Campaign"
                      className="bg-gray-700 border-gray-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="target-launches">Target Launches</Label>
                      <Input 
                        id="target-launches"
                        type="number"
                        value={targetLaunches}
                        onChange={(e) => setTargetLaunches(parseInt(e.target.value) || 5)}
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                    <div>
                      <Label htmlFor="initial-liquidity">Liquidity (SOL)</Label>
                      <Input 
                        id="initial-liquidity"
                        type="number"
                        step="0.1"
                        value={initialLiquidity}
                        onChange={(e) => setInitialLiquidity(parseFloat(e.target.value) || 0.1)}
                        className="bg-gray-700 border-gray-600"
                      />
                    </div>
                  </div>
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => createCampaignMutation.mutate()}
                    disabled={createCampaignMutation.isPending || liveMode}
                  >
                    {liveMode ? 'Use API for Live Mode' : 'Create Campaign'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            {campaignList.length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-8 text-center text-gray-400">
                  No campaigns yet. Create one to get started!
                </CardContent>
              </Card>
            ) : (
              campaignList.map((campaign) => (
                <Card key={campaign.id} className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {campaign.name}
                          <Badge className={campaign.mode === 'live' ? 'bg-red-600' : 'bg-blue-600'}>
                            {campaign.mode}
                          </Badge>
                          <Badge className={
                            campaign.status === 'running' ? 'bg-yellow-600' :
                            campaign.status === 'completed' ? 'bg-green-600' :
                            'bg-gray-600'
                          }>
                            {campaign.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {campaign.stats.totalLaunches} / {campaign.config.targetLaunches} launches
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {campaign.status === 'pending' && (
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => startCampaignMutation.mutate(campaign.id)}
                            disabled={campaign.mode === 'live'}
                            title={campaign.mode === 'live' ? 'Use API with TOKEN_LAUNCHER_API_SECRET for live mode' : ''}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            {campaign.mode === 'live' ? 'API Only' : 'Start'}
                          </Button>
                        )}
                        {campaign.status === 'running' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => stopCampaignMutation.mutate(campaign.id)}
                            disabled={campaign.mode === 'live'}
                            title={campaign.mode === 'live' ? 'Use API with TOKEN_LAUNCHER_API_SECRET for live mode' : ''}
                          >
                            <StopCircle className="h-4 w-4 mr-1" />
                            {campaign.mode === 'live' ? 'API Only' : 'Stop'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-400">Success Rate</p>
                        <p className="text-lg font-bold">
                          {campaign.stats.totalLaunches > 0 
                            ? ((campaign.stats.successfulLaunches / campaign.stats.totalLaunches) * 100).toFixed(0)
                            : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Spent</p>
                        <p className="text-lg font-bold text-red-400">
                          {campaign.stats.totalSpentSol.toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Recovered</p>
                        <p className="text-lg font-bold text-green-400">
                          {campaign.stats.totalRecoveredSol.toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">P&L (SOL)</p>
                        <p className={`text-lg font-bold ${campaign.stats.profitLossSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {campaign.stats.profitLossSol >= 0 ? '+' : ''}{campaign.stats.profitLossSol.toFixed(4)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">P&L (USD)</p>
                        <p className={`text-lg font-bold ${campaign.stats.profitLossUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {campaign.stats.profitLossUsd >= 0 ? '+' : ''}${campaign.stats.profitLossUsd.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={(campaign.stats.totalLaunches / campaign.config.targetLaunches) * 100} 
                      className="h-2"
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {campaignList.flatMap(c => c.launches).length === 0 ? (
              <Card className="bg-gray-800 border-gray-700">
                <CardContent className="p-8 text-center text-gray-400">
                  No launch history yet.
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle>Recent Launches</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {campaignList.flatMap(c => c.launches).slice(-20).reverse().map((launch) => (
                      <div key={launch.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          {launch.profitLossSol >= 0 ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{launch.metadata.name} ({launch.metadata.symbol})</p>
                            <p className="text-sm text-gray-400">{launch.tokenMint?.slice(0, 12)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${launch.profitLossSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {launch.profitLossSol >= 0 ? '+' : ''}{launch.profitLossSol.toFixed(4)} SOL
                          </p>
                          <Badge className={launch.status === 'exited' ? 'bg-green-600' : 'bg-gray-600'}>
                            {launch.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <Card className="mt-8 bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-500" />
              Wallet Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Address</p>
                <p className="font-mono text-sm break-all">{launcherData?.wallet?.address || 'Not configured'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Network</p>
                <p className="font-medium">{launcherData?.wallet?.network || 'Unknown'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
