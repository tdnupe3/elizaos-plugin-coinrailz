import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface OutreachStats {
  totalGroups: number;
  queuedMessages: number;
  isRunning: boolean;
  lastUpdate: string;
}

export function OutreachDashboard() {
  const [stats, setStats] = useState<OutreachStats | null>(null);
  const [chatId, setChatId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load stats on component mount
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/outreach/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const addGroup = async () => {
    if (!chatId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a chat ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/outreach/add-group', {
        method: 'POST',
        body: JSON.stringify({ chatId: chatId.trim(), groupName: groupName.trim() || undefined })
      });

      if (response.success) {
        toast({
          title: "Success",
          description: response.message
        });
        setChatId('');
        setGroupName('');
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to add group');
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

  const startCampaign = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/outreach/start-campaign', {
        method: 'POST'
      });

      if (response.success) {
        toast({
          title: "Campaign Started",
          description: "🚀 @FeedAlphaBot promotion campaign is now running!"
        });
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to start campaign');
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

  const stopCampaign = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/outreach/stop-campaign', {
        method: 'POST'
      });

      if (response.success) {
        toast({
          title: "Campaign Stopped",
          description: "Outreach campaign has been stopped"
        });
        loadStats();
      } else {
        throw new Error(response.error || 'Failed to stop campaign');
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
          <CardTitle>🚀 @FeedAlphaBot Outreach Campaign</CardTitle>
          <CardDescription>
            Promote your Solana trading bot to crypto Telegram groups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalGroups}</div>
                <div className="text-sm text-gray-500">Groups Reached</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.queuedMessages}</div>
                <div className="text-sm text-gray-500">Queued Messages</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${stats.isRunning ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.isRunning ? '🟢' : '🔴'}
                </div>
                <div className="text-sm text-gray-500">Campaign Status</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-mono text-gray-600">
                  {new Date(stats.lastUpdate).toLocaleTimeString()}
                </div>
                <div className="text-sm text-gray-500">Last Update</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Target Group</CardTitle>
          <CardDescription>
            Add crypto Telegram groups where your bot has posting permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="@cryptotrading or -1001234567890"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              data-testid="input-chat-id"
            />
            <Input
              placeholder="Group name (optional)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              data-testid="input-group-name"
            />
          </div>
          <Button 
            onClick={addGroup} 
            disabled={isLoading || !chatId.trim()}
            data-testid="button-add-group"
          >
            Add Group to Campaign
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={startCampaign} 
              disabled={isLoading || stats?.isRunning}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-start-campaign"
            >
              🚀 Start Campaign
            </Button>
            <Button 
              onClick={stopCampaign} 
              disabled={isLoading || !stats?.isRunning}
              variant="outline"
              data-testid="button-stop-campaign"
            >
              ⏸️ Stop Campaign
            </Button>
          </div>
          
          <div className="bg-gray-50 p-4 rounded text-sm">
            <h4 className="font-semibold mb-2">How to use:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Add your bot (@FeedAlphaBot) to crypto Telegram groups</li>
              <li>Make sure your bot has posting permissions in those groups</li>
              <li>Add the group chat IDs here (like @groupname or -1001234567890)</li>
              <li>Start the campaign to automatically promote your bot</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}