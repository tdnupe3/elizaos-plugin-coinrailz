import { useEffect, useState } from 'react';
import { init, backButton, mainButton, viewport } from '@telegram-apps/sdk-react';
import '@telegram-apps/telegram-ui/dist/styles.css';
import { AppRoot, Placeholder, Button, Cell, Section, List, Banner, Card, Title, Text, Headline, Subheadline } from '@telegram-apps/telegram-ui';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2, Sparkles, Wallet, MessageSquare, TrendingUp, AlertCircle, Share2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TelegramAccount {
  userId: string;
  telegramId: string;
  username?: string;
  firstName?: string;
  referralCode?: string;
  apiKey: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface TradeRecord {
  id: number;
  tokenMint: string;
  action: string;
  amount: string;
  fee: string | null;
  txHash: string | null;
  slippage: string | null;
  pnl: string | null;
  status: string | null;
  createdAt: string;
}

function TradingPnL({ initData }: { initData: string }) {
  const { data, isLoading } = useQuery<{ trades: TradeRecord[]; totalPnL: number; winRate: number; count: number }>({
    queryKey: ['/api/telegram/trades', initData],
    queryFn: async () => {
      const res = await fetch(`/api/telegram/trades?initData=${encodeURIComponent(initData)}&limit=10`);
      if (!res.ok) throw new Error('Failed to load trades');
      return res.json();
    },
    enabled: !!initData && initData !== '',
    staleTime: 30_000,
  });

  if (isLoading) return null;
  if (!data || data.count === 0) return null;

  const pnlColor = (data.totalPnL ?? 0) >= 0 ? 'text-green-500' : 'text-red-500';
  const pnlSign = (data.totalPnL ?? 0) >= 0 ? '+' : '';

  return (
    <Section header="Trading P&L (Paper)">
      <Card className="mx-4 mb-2 p-3">
        <div className="flex justify-between items-center mb-2">
          <div>
            <Text weight="2">Total P&L</Text>
            <Text className={`text-lg font-bold ${pnlColor}`}>
              {pnlSign}{(data.totalPnL ?? 0).toFixed(4)} SOL
            </Text>
          </div>
          <div className="text-right">
            <Text weight="2">Win Rate</Text>
            <Text className="text-lg font-bold text-blue-500">{(data.winRate ?? 0).toFixed(0)}%</Text>
          </div>
          <div className="text-right">
            <Text weight="2">Trades</Text>
            <Text className="text-lg font-bold">{data.count}</Text>
          </div>
        </div>
      </Card>
      <List>
        {data.trades.slice(0, 5).map((t) => (
          <Cell
            key={t.id}
            subtitle={`${t.tokenMint.substring(0, 8)}… · ${new Date(t.createdAt).toLocaleDateString()}`}
            after={
              <Text weight="2" className={parseFloat(t.pnl || '0') >= 0 ? 'text-green-500' : 'text-red-500'}>
                {parseFloat(t.pnl || '0') >= 0 ? '+' : ''}{parseFloat(t.pnl || '0').toFixed(4)}
              </Text>
            }
            data-testid={`trade-${t.id}`}
          >
            {t.action.toUpperCase()} {parseFloat(t.amount).toFixed(3)} SOL
          </Cell>
        ))}
      </List>
    </Section>
  );
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

  // Development mode toggle - allows viewing UI without Telegram
  const DEV_MODE = import.meta.env.DEV;

  // Get initData for authentication
  const getInitData = () => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      return window.Telegram.WebApp.initData;
    }
    // In dev mode, return empty string to skip validation
    return DEV_MODE ? 'dev-mode' : '';
  };

  // Component-level initData — used by TradingPnL and other sub-components
  const initData = getInitData();

  // Link account and get $1 bonus
  const { data: account, isLoading: isLinking } = useQuery<TelegramAccount>({
    queryKey: ['/api/telegram/link'],
    queryFn: async () => {
      const initData = getInitData();
      if (!initData) {
        throw new Error('Telegram data not available');
      }

      // In dev mode, return mock account
      if (DEV_MODE && initData === 'dev-mode') {
        return {
          userId: 'dev-user-123',
          telegramId: '123456789',
          username: 'demo_user',
          firstName: 'Demo',
          referralCode: 'TDEV12345',
          apiKey: 'cr_tg_dev_key_preview_only'
        };
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

      // In dev mode, return mock transactions
      if (DEV_MODE && initData === 'dev-mode') {
        return [
          {
            id: '1',
            amount: 1.00,
            type: 'bonus',
            description: 'Welcome bonus',
            createdAt: new Date().toISOString()
          }
        ];
      }

      const response = await fetch(`/api/telegram/activity?initData=${encodeURIComponent(initData)}`);
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
    enabled: !!account,
    refetchInterval: DEV_MODE ? false : 5000 // Don't refresh in dev mode
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

      // In dev mode, return mock response
      if (DEV_MODE && initData === 'dev-mode') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        return {
          response: `This is a demo response. In production, the AI would analyze your request: "${message}". Try asking about wallet risks, token prices, or DEX liquidity!`
        };
      }

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
                    <div key={idx}>
                      <div
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                            : 'bg-gray-100 dark:bg-gray-800 mr-8'
                        }`}
                      >
                        <Text>{msg.content}</Text>
                      </div>
                      {msg.role === 'assistant' && (
                        <div className="flex justify-end mr-8 mt-1">
                          <button
                            onClick={() => {
                              if (window.Telegram?.WebApp) {
                                try {
                                  window.Telegram.WebApp.switchInlineQuery(
                                    `I just got this insight from Coin Railz AI: "${msg.content.substring(0, 100)}..." Try it: @coinrailz_bot`,
                                    ['users', 'groups', 'channels']
                                  );
                                } catch (error) {
                                  // Fallback if inline sharing is disabled
                                  toast({
                                    title: "Share via Telegram",
                                    description: "Copy this message and share it with your friends!"
                                  });
                                }
                              }
                            }}
                            className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                            data-testid={`button-share-result-${idx}`}
                          >
                            <Share2 className="w-3 h-3" />
                            Share
                          </button>
                        </div>
                      )}
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

        {/* Invite Friends (Viral Growth) */}
        <Section header="Grow Your Credits">
          <List>
            <Cell
              before={<Users className="w-6 h-6 text-purple-500" />}
              subtitle="Share Coin Railz with friends"
              onClick={() => {
                if (window.Telegram?.WebApp && account?.referralCode) {
                  const inviteUrl = `https://t.me/coinrailz_bot?start=${account.referralCode}`;
                  const shareText = `🚀 Try Coin Railz Agent Console - Get $1 free credits!\n\nAI-powered blockchain intelligence: wallet risk checks, token prices, DEX liquidity & more.\n\n${inviteUrl}`;
                  
                  try {
                    window.Telegram.WebApp.switchInlineQuery(shareText, ['users', 'groups', 'channels']);
                  } catch (error) {
                    // Fallback if inline sharing is disabled
                    toast({
                      title: "Your Referral Link",
                      description: inviteUrl
                    });
                  }
                } else {
                  const fallbackUrl = account?.referralCode 
                    ? `https://t.me/coinrailz_bot?start=${account.referralCode}`
                    : 'https://t.me/coinrailz_bot';
                  toast({
                    title: "Share link",
                    description: fallbackUrl
                  });
                }
              }}
              data-testid="button-invite-friends"
            >
              Invite Friends
            </Cell>
          </List>
        </Section>

        {/* Trading P&L */}
        <TradingPnL initData={initData} />

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
