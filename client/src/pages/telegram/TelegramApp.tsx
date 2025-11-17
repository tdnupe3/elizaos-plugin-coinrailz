import { useEffect, useState } from 'react';
import { init, backButton, mainButton, viewport } from '@telegram-apps/sdk-react';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { AppRoot, Placeholder, Button, Cell, Section, List, Banner, Card, Title, Text, Headline, Subheadline } from '@telegram-apps/telegram-ui';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Sparkles, Wallet, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TelegramAccount {
  userId: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  apiKey: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export default function TelegramApp() {
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([]);
  const [isChatting, setIsChatting] = useState(false);

  // Initialize Telegram SDK
  useEffect(() => {
    try {
      init();
      viewport.mount();
      viewport.expand();
      backButton.mount();
      mainButton.mount();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize Telegram SDK:', error);
      setIsInitialized(true); // Continue anyway for development
    }
  }, []);

  // Get initData for authentication
  const getInitData = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp.initData;
    }
    return '';
  };

  // Link account and get $1 bonus
  const { data: account, isLoading: isLinking } = useQuery<TelegramAccount>({
    queryKey: ['/api/telegram/link'],
    queryFn: async () => {
      const initData = getInitData();
      if (!initData) {
        throw new Error('Telegram data not available');
      }
      
      const response = await apiRequest('/api/telegram/link', {
        method: 'POST',
        body: JSON.stringify({ initData })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to link account');
      }
      
      return response.json();
    },
    enabled: isInitialized,
    retry: false
  });

  // Get activity
  const { data: activity = [] } = useQuery<Transaction[]>({
    queryKey: ['/api/telegram/activity'],
    queryFn: async () => {
      const initData = getInitData();
      const response = await fetch(`/api/telegram/activity?initData=${encodeURIComponent(initData)}`);
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
    enabled: !!account,
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Calculate balance from transactions
  useEffect(() => {
    if (activity && activity.length > 0) {
      const total = activity.reduce((sum, tx) => {
        if (tx.type === 'bonus' || tx.type === 'topup') {
          return sum + tx.amount;
        } else {
          return sum - tx.amount;
        }
      }, 0);
      setBalance(total);
    } else if (account) {
      setBalance(1.00); // Default $1 bonus
    }
  }, [activity, account]);

  // Send chat message
  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const initData = getInitData();
      const response = await apiRequest('/api/telegram/agent-chat', {
        method: 'POST',
        body: JSON.stringify({ initData, message })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Chat failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setChatHistory(prev => [...prev, 
        { role: 'user', content: chatMessage },
        { role: 'assistant', content: data.response }
      ]);
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/telegram/activity'] });
      toast({
        title: "Message sent",
        description: "AI responded successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Chat failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    if ((balance ?? 0) < 0.10) {
      toast({
        title: "Insufficient credits",
        description: "You need at least $0.10 to chat. Please top up.",
        variant: "destructive"
      });
      return;
    }
    chatMutation.mutate(chatMessage);
  };

  // Loading state
  if (isLinking) {
    return (
      <AppRoot>
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <Headline weight="2">Setting up your account...</Headline>
          <Text className="text-center mt-2 text-gray-500">
            Getting your $1 welcome bonus ready
          </Text>
        </div>
      </AppRoot>
    );
  }

  // Error state
  if (!account && !isLinking) {
    return (
      <AppRoot>
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <Headline weight="2">Connection Error</Headline>
          <Text className="text-center mt-2 text-gray-500">
            Please open this app from Telegram
          </Text>
        </div>
      </AppRoot>
    );
  }

  return (
    <AppRoot>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header with Balance */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <Title level="3" weight="1" className="text-white">
                Coin Railz AI
              </Title>
              <Text className="text-blue-100 text-sm">
                {account?.username || account?.firstName || 'User'}
              </Text>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <Wallet className="w-5 h-5" />
                <Headline weight="1" className="text-white">
                  ${(balance ?? 0).toFixed(2)}
                </Headline>
              </div>
              <Text className="text-blue-100 text-xs">Available Credits</Text>
            </div>
          </div>
        </div>

        {/* Welcome Banner */}
        {balance === 1.00 && activity.length <= 1 && (
          <div className="p-4">
            <Banner
              header="Welcome! 🎉"
              subheader="You've received $1.00 in free credits to try our AI services"
              type="section"
            >
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </Banner>
          </div>
        )}

        {/* Services Section */}
        <Section header="AI Services">
          <List>
            <Cell
              before={<MessageSquare className="w-6 h-6 text-blue-500" />}
              subtitle="$0.10 per message"
              onClick={() => setIsChatting(!isChatting)}
              data-testid="button-ai-chat"
            >
              AI Copilot Chat
            </Cell>
            <Cell
              before={<TrendingUp className="w-6 h-6 text-green-500" />}
              subtitle="Wallet risk, token prices, DEX liquidity"
            >
              Blockchain Services
            </Cell>
          </List>
        </Section>

        {/* Chat Interface */}
        {isChatting && (
          <Section header="Chat with AI">
            <Card className="p-4 m-4">
              <div className="mb-4 max-h-96 overflow-y-auto space-y-2">
                {chatHistory.length === 0 ? (
                  <Text className="text-gray-500 text-center py-8">
                    Ask me about wallet risks, token prices, or DEX liquidity!
                  </Text>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                          : 'bg-gray-100 dark:bg-gray-800 mr-8'
                      }`}
                    >
                      <Text>{msg.content}</Text>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  disabled={chatMutation.isPending}
                  data-testid="input-chat-message"
                />
                <Button
                  mode="filled"
                  size="m"
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || chatMutation.isPending}
                  data-testid="button-send-message"
                >
                  {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
            </Card>
          </Section>
        )}

        {/* Recent Activity */}
        {activity.length > 0 && (
          <Section header="Recent Activity">
            <List>
              {activity.slice(0, 5).map((tx) => (
                <Cell
                  key={tx.id}
                  subtitle={new Date(tx.createdAt).toLocaleString()}
                  after={
                    <Text weight="2" className={tx.type === 'chat' ? 'text-red-500' : 'text-green-500'}>
                      {tx.type === 'chat' ? '-' : '+'}${tx.amount.toFixed(2)}
                    </Text>
                  }
                  data-testid={`transaction-${tx.id}`}
                >
                  {tx.description}
                </Cell>
              ))}
            </List>
          </Section>
        )}

        {/* Top Up Button */}
        <div className="p-4 pb-8">
          <Button
            mode="filled"
            size="l"
            stretched
            onClick={() => {
              toast({
                title: "Coming soon",
                description: "Top-up with Stripe/USDC will be available soon"
              });
            }}
            data-testid="button-topup"
          >
            <Wallet className="w-5 h-5 mr-2" />
            Top Up Credits
          </Button>
        </div>
      </div>
    </AppRoot>
  );
}
