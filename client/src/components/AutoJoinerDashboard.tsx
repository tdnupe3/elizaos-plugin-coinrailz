import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AutoJoinStats {
  isRunning: boolean;
  status: string;
  totalGroups: number;
  joinedCount: number;
  failedCount: number;
  progress: number;
  logs: string[];
}

export function AutoJoinerDashboard() {
  const [stats, setStats] = useState<AutoJoinStats | null>(null);
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [groupUrls, setGroupUrls] = useState(`https://t.me/cryptotrading
https://t.me/solana_trading
https://t.me/defi_discussion
https://t.me/pump_fun_alerts
https://t.me/altcoin_signals`);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const { toast } = useToast();

  // Load stats on component mount
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/auto-joiner/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const startAutoJoin = async () => {
    if (!apiId.trim() || !apiHash.trim() || !phoneNumber.trim()) {
      toast({
        title: "Missing Credentials",
        description: "Please enter your Telegram API ID, Hash, and Phone Number",
        variant: "destructive"
      });
      return;
    }

    const urls = groupUrls.split('\n').filter(url => url.trim().length > 0);
    if (urls.length === 0) {
      toast({
        title: "No Groups",
        description: "Please enter at least one group URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auto-joiner/start', {
        method: 'POST',
        body: JSON.stringify({ 
          apiId: apiId.trim(), 
          apiHash: apiHash.trim(), 
          phoneNumber: phoneNumber.trim(),
          groupUrls: urls
        })
      });

      if (response.success) {
        toast({
          title: "Auto-Joiner Started",
          description: `🚀 Started joining ${urls.length} crypto groups!`
        });
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to start auto-joiner');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopAutoJoin = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auto-joiner/stop', {
        method: 'POST'
      });

      if (response.success) {
        toast({
          title: "Stopped",
          description: "Auto-joiner has been stopped"
        });
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to stop auto-joiner');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetStats = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/auto-joiner/reset', {
        method: 'POST'
      });

      if (response.success) {
        toast({
          title: "Reset Complete",
          description: "Auto-joiner stats have been reset"
        });
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to reset');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🤖 FREE Telegram Group Auto-Joiner</CardTitle>
          <CardDescription>
            Automatically join hundreds of crypto Telegram groups - completely free!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.joinedCount}</div>
                <div className="text-sm text-gray-500">Groups Joined</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failedCount}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalGroups}</div>
                <div className="text-sm text-gray-500">Total Groups</div>
              </div>
              <div className="text-center">
                <div className={`text-sm font-bold ${
                  stats.isRunning ? 'text-green-600' : 
                  stats.status === 'completed' ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {stats.status.toUpperCase()}
                </div>
                <div className="text-sm text-gray-500">Status</div>
              </div>
            </div>
          )}

          {stats && stats.totalGroups > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(stats.progress)}%</span>
              </div>
              <Progress value={stats.progress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🔑 Telegram API Credentials</CardTitle>
            <CardDescription>
              Get these from <a href="https://my.telegram.org/" target="_blank" className="text-blue-600 underline">my.telegram.org</a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="API ID (numbers only)"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              data-testid="input-api-id"
            />
            <Input
              placeholder="API Hash (letters and numbers)"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              data-testid="input-api-hash"
            />
            <Input
              placeholder="Phone Number (+1234567890)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              data-testid="input-phone-number"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📝 Group URLs to Join</CardTitle>
            <CardDescription>
              One URL per line (https://t.me/groupname)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="https://t.me/cryptotrading..."
              value={groupUrls}
              onChange={(e) => setGroupUrls(e.target.value)}
              rows={8}
              data-testid="textarea-group-urls"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚀 Auto-Joiner Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button 
              onClick={startAutoJoin} 
              disabled={isLoading || stats?.isRunning}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-start-autojoiner"
            >
              🚀 Start Auto-Joining
            </Button>
            <Button 
              onClick={stopAutoJoin} 
              disabled={isLoading || !stats?.isRunning}
              variant="outline"
              data-testid="button-stop-autojoiner"
            >
              ⏸️ Stop
            </Button>
            <Button 
              onClick={resetStats} 
              disabled={isLoading || stats?.isRunning}
              variant="outline"
              data-testid="button-reset-stats"
            >
              🧹 Reset
            </Button>
            <Button 
              onClick={() => setShowLogs(!showLogs)} 
              variant="outline"
              data-testid="button-toggle-logs"
            >
              {showLogs ? '📄 Hide Logs' : '📄 Show Logs'}
            </Button>
          </div>
          
          <div className="bg-gray-50 p-4 rounded text-sm">
            <h4 className="font-semibold mb-2">How it works:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Get your Telegram API credentials from <a href="https://my.telegram.org/" target="_blank" className="text-blue-600 underline">my.telegram.org</a></li>
              <li>Enter crypto group URLs you want to join</li>
              <li>Click "Start Auto-Joining" and wait (5-10 minutes between each group)</li>
              <li>Your account will automatically join all groups!</li>
              <li>Then add @FeedAlphaBot to each group you joined</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {showLogs && stats && stats.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📜 Auto-Joiner Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
              {stats.logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}