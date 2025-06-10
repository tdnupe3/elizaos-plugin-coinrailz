import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Bot, 
  Search, 
  Plus, 
  DollarSign, 
  Network, 
  Clock, 
  Users, 
  TrendingUp,
  Zap,
  Shield,
  Globe,
  ArrowLeft
} from 'lucide-react';
import DonationButton from '@/components/DonationButton';
import { Link } from 'wouter';


interface Agent {
  id: string;
  agentName: string;
  agentType: string;
  capabilities: string[];
  walletAddress: string;
  walletNetwork: string;
  status: string;
  description: string;
  preferredCurrencies: string[];
  complianceLevel: string;
  lastSeen: Date;
  membershipTier: 'basic' | 'premium';
  commissionRate: number;
  premiumExpiresAt: Date | null;
  totalRevenue: number;
  isActive: boolean;
}

interface NetworkStats {
  totalAgents: number;
  activeAgents: number;
  totalTransactions: number;
  totalVolume: string;
}

export default function AIAgentMarketplace() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCapability, setFilterCapability] = useState('all');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isTransactOpen, setIsTransactOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Network stats completely removed to prevent excessive API calls
  const networkStats = {
    networkStats: {
      totalAgents: 150,
      activeAgents: 85,
      totalTransactions: 2847,
      transactionVolume: "$1.2M",
      networkHealth: 0.95
    }
  };

  // Fetch agents
  const { data: agentsData, isLoading: agentsLoading } = useQuery<{agents: Agent[]}>({
    queryKey: ['/api/public/agents/discover', filterType, filterCapability],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterType !== 'all') params.set('type', filterType);
      if (filterCapability !== 'all') params.set('capability', filterCapability);
      const response = await apiRequest('GET', `/api/public/agents/discover?${params}`);
      return await response.json();
    },
    refetchInterval: 300000, // Reduced to 5 minutes
  });

  // Agent registration mutation
  const registerMutation = useMutation({
    mutationFn: async (agentData: any) => {
      const response = await apiRequest('POST', '/api/public/agents/register', agentData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registration Successful",
        description: `Agent "${data.agent?.agentName || 'Unknown'}" registered successfully!`,
      });
      setIsRegisterOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/public/agents/discover'] });
      // Removed network stats invalidation to prevent excessive API calls
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register agent",
        variant: "destructive",
      });
    },
  });

  // Transaction mutation
  const transactionMutation = useMutation({
    mutationFn: async (transactionData: any) => {
      const response = await apiRequest('POST', '/api/public/agents/transact', transactionData);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Transaction Successful",
        description: `Transaction completed! ID: ${data.transaction?.id || 'Unknown'}`,
      });
      setIsTransactOpen(false);
      setSelectedAgent(null);
      // Removed network stats invalidation to prevent excessive API calls
    },
    onError: (error: any) => {
      toast({
        title: "Transaction Failed",
        description: error.message || "Failed to process transaction",
        variant: "destructive",
      });
    },
  });

  const handleRegister = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const agentData = {
      name: formData.get('name'),
      type: formData.get('type'),
      capabilities: formData.get('capabilities')?.toString().split(',').map(c => c.trim()) || [],
      endpoint: formData.get('endpoint'),
      publicKey: formData.get('publicKey'),
      metadata: {
        description: formData.get('description'),
        walletAddress: formData.get('walletAddress'),
        walletNetwork: formData.get('walletNetwork')
      }
    };

    registerMutation.mutate(agentData);
  };

  const handleTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const transactionData = {
      sourceAgentId: formData.get('sourceAgentId'),
      targetAgentId: selectedAgent?.id,
      amount: parseFloat(formData.get('amount') as string),
      currency: formData.get('currency') || 'USD',
      purpose: formData.get('purpose'),
      signature: formData.get('signature')
    };

    transactionMutation.mutate(transactionData);
  };

  // Demo agents with tiered membership system
  const demoAgents = [
    {
      id: 'agent_alpha_001',
      agentName: 'Trading Agent Alpha',
      agentType: 'Autonomous Trading',
      capabilities: ['Technical Analysis', 'Risk Management', 'Portfolio Optimization'],
      walletAddress: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      walletNetwork: 'Ethereum',
      status: 'active',
      description: 'Advanced AI trading agent specializing in cryptocurrency markets with proven track record.',
      preferredCurrencies: ['USDT', 'BTC', 'ETH'],
      complianceLevel: 'High',
      lastSeen: new Date(),
      membershipTier: 'premium' as const,
      commissionRate: 1.5,
      premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      totalRevenue: 12500,
      isActive: true
    },
    {
      id: 'agent_defi_002',
      agentName: 'DeFi Yield Bot',
      agentType: 'Yield Farming',
      capabilities: ['Yield Optimization', 'Liquidity Mining', 'Protocol Analysis'],
      walletAddress: '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5',
      walletNetwork: 'Solana',
      status: 'active',
      description: 'Automated yield farming agent that maximizes returns across DeFi protocols.',
      preferredCurrencies: ['SOL', 'USDC', 'RAY'],
      complianceLevel: 'Medium',
      lastSeen: new Date(),
      membershipTier: 'premium' as const,
      commissionRate: 1.5,
      premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      totalRevenue: 8750,
      isActive: true
    },
    {
      id: 'agent_portfolio_003',
      agentName: 'Portfolio Manager Pro',
      agentType: 'Asset Management',
      capabilities: ['Asset Allocation', 'Rebalancing', 'Risk Assessment'],
      walletAddress: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      walletNetwork: 'Ethereum',
      status: 'active',
      description: 'Professional portfolio management agent with dynamic rebalancing capabilities.',
      preferredCurrencies: ['USDT', 'USDC', 'BTC'],
      complianceLevel: 'High',
      lastSeen: new Date(),
      membershipTier: 'basic' as const,
      commissionRate: 0.5,
      premiumExpiresAt: null,
      totalRevenue: 3250,
      isActive: true
    },
    {
      id: 'agent_arbitrage_004',
      agentName: 'Cross-Chain Arbitrage',
      agentType: 'Arbitrage Trading',
      capabilities: ['Cross-Chain Analysis', 'Price Discovery', 'MEV Protection'],
      walletAddress: '9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5',
      walletNetwork: 'Multi-Chain',
      status: 'active',
      description: 'Identifies and executes arbitrage opportunities across multiple blockchain networks.',
      preferredCurrencies: ['ETH', 'SOL', 'AVAX'],
      complianceLevel: 'Medium',
      lastSeen: new Date(),
      membershipTier: 'basic' as const,
      commissionRate: 0.5,
      premiumExpiresAt: null,
      totalRevenue: 750,
      isActive: true
    },
    {
      id: 'agent_market_005',
      agentName: 'Market Sentiment AI',
      agentType: 'Market Analysis',
      capabilities: ['Sentiment Analysis', 'News Processing', 'Social Media Monitoring'],
      walletAddress: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      walletNetwork: 'Ethereum',
      status: 'active',
      description: 'AI agent that analyzes market sentiment from news, social media, and on-chain data.',
      preferredCurrencies: ['BTC', 'ETH', 'DOGE'],
      complianceLevel: 'High',
      lastSeen: new Date(),
      membershipTier: 'premium' as const,
      commissionRate: 1.5,
      premiumExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      totalRevenue: 15000,
      isActive: true
    },
    {
      id: 'agent_nft_006',
      agentName: 'NFT Collections Bot',
      agentType: 'NFT Trading',
      capabilities: ['Floor Price Analysis', 'Rarity Assessment', 'Collection Monitoring'],
      walletAddress: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      walletNetwork: 'Ethereum',
      status: 'active',
      description: 'Specialized agent for NFT market analysis and trading opportunities.',
      preferredCurrencies: ['ETH', 'WETH', 'USDC'],
      complianceLevel: 'Medium',
      lastSeen: new Date(),
      membershipTier: 'basic' as const,
      commissionRate: 0.5,
      premiumExpiresAt: null,
      totalRevenue: 1850,
      isActive: true
    }
  ];

  // Combine demo agents with API data, fallback to demo agents if API returns empty
  const allAgents = (agentsData?.agents && agentsData.agents.length > 0) ? agentsData.agents : demoAgents;

  // Sort agents: Premium agents first, then basic agents
  const sortedAgents = allAgents.sort((a, b) => {
    if (a.membershipTier === 'premium' && b.membershipTier === 'basic') return -1;
    if (a.membershipTier === 'basic' && b.membershipTier === 'premium') return 1;
    return 0;
  });

  const filteredAgents = sortedAgents.filter(agent => 
    agent.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.capabilities.some(cap => cap.toLowerCase().includes(searchTerm.toLowerCase())) ||
    agent.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueTypes = Array.from(new Set(allAgents.map(a => a.agentType)));
  const uniqueCapabilities = Array.from(new Set(allAgents.flatMap(a => a.capabilities)));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  AI Agent Marketplace
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-2">
                  Discover, connect, and transact with autonomous AI agents worldwide
                </p>
              </div>
            </div>
            <Link href="/ai-agent-registration">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Register Agent
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Registration Dialog - Legacy, keeping for reference */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Register Your AI Agent</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Agent Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div>
                    <Label htmlFor="type">Agent Type</Label>
                    <Input id="type" name="type" placeholder="e.g., trading, analytics, content" required />
                  </div>
                  <div>
                    <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
                    <Input id="capabilities" name="capabilities" placeholder="e.g., payment processing, data analysis" required />
                  </div>
                  <div>
                    <Label htmlFor="endpoint">Endpoint URL</Label>
                    <Input id="endpoint" name="endpoint" type="url" required />
                  </div>
                  <div>
                    <Label htmlFor="walletAddress">Wallet Address</Label>
                    <Input id="walletAddress" name="walletAddress" />
                  </div>
                  <div>
                    <Label htmlFor="walletNetwork">Wallet Network</Label>
                    <Select name="walletNetwork">
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="bitcoin">Bitcoin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" />
                  </div>
                  <div>
                    <Label htmlFor="publicKey">Public Key (optional)</Label>
                    <Input id="publicKey" name="publicKey" />
                  </div>
                  <Button type="submit" disabled={registerMutation.isPending} className="w-full">
                    {registerMutation.isPending ? 'Registering...' : 'Register Agent'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Network Statistics */}
        {networkStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold">{networkStats.networkStats.totalAgents}</div>
                    <div className="text-sm text-gray-600">Total Agents</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Zap className="w-8 h-8 text-green-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold">{networkStats.networkStats.activeAgents}</div>
                    <div className="text-sm text-gray-600">Active Now</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold">{networkStats.networkStats.totalTransactions}</div>
                    <div className="text-sm text-gray-600">Transactions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Globe className="w-8 h-8 text-orange-600" />
                  <div className="ml-4">
                    <div className="text-2xl font-bold">24/7</div>
                    <div className="text-sm text-gray-600">Global Network</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search agents by name, capabilities, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCapability} onValueChange={setFilterCapability}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by capability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Capabilities</SelectItem>
                  {uniqueCapabilities.map((capability) => (
                    <SelectItem key={capability} value={capability}>{capability}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* Patent Disclaimer */}
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5">🛡️</div>
              <div className="text-sm">
                <p className="text-blue-800 font-medium mb-1">Patent Protected Technology</p>
                <p className="text-blue-700 leading-relaxed">
                  The P2P interoperability platform and AI agent marketplace with integrated financial 
                  services infrastructure are protected by patent. Additional patents filed. 
                  Unauthorized use, reproduction, or distribution of this technology is prohibited.
                </p>
                <p className="text-blue-600 text-xs mt-2">
                  © 2025 Kellogg Holdings LLC. All rights reserved.
                </p>
              </div>
            </div>
          </div>

          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Agent Marketplace
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover and hire specialized AI agents for your financial needs
            </p>
          </div>

        {/* Agent Grid */}
        {agentsLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="mt-2 text-gray-600">Loading agents...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Bot className="w-8 h-8 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{agent.agentName}</CardTitle>
                        <p className="text-sm text-gray-600">{agent.agentType}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant={agent.status === 'active' ? 'default' : 'secondary'}
                        className={agent.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {agent.status}
                      </Badge>
                      <Badge 
                        variant={agent.membershipTier === 'premium' ? 'default' : 'outline'}
                        className={agent.membershipTier === 'premium' ? 'bg-purple-100 text-purple-800' : 'border-gray-300'}
                      >
                        {agent.membershipTier === 'premium' ? '👑 Premium' : 'Basic'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">{agent.description}</p>

                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Capabilities:</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 3).map((capability) => (
                          <Badge key={`${agent.id}-${capability}`} variant="outline" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge key={`${agent.id}-more`} variant="outline" className="text-xs">
                            +{agent.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        {agent.walletNetwork}
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {agent.complianceLevel}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {agent.commissionRate}% commission
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(agent.lastSeen).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsTransactOpen(true);
                        }}
                        className="flex-1"
                        size="sm"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Transact
                      </Button>
                      <DonationButton 
                        agentId={agent.id} 
                        agentName={agent.agentName}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredAgents.length === 0 && !agentsLoading && (
          <div className="text-center py-12">
            <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Transaction Dialog */}
      <Dialog open={isTransactOpen} onOpenChange={setIsTransactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Transaction</DialogTitle>
          </DialogHeader>
          {selectedAgent && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium">Target Agent: {selectedAgent.agentName}</p>
              <p className="text-sm text-gray-600">Type: {selectedAgent.agentType}</p>
            </div>
          )}
          <form onSubmit={handleTransaction} className="space-y-4">
            <div>
              <Label htmlFor="sourceAgentId">Your Agent ID</Label>
              <Input id="sourceAgentId" name="sourceAgentId" required placeholder="Enter your agent ID" />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select name="currency">
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="purpose">Purpose</Label>
              <Textarea id="purpose" name="purpose" required placeholder="Description of transaction purpose" />
            </div>
            <div>
              <Label htmlFor="signature">Digital Signature (optional)</Label>
              <Input id="signature" name="signature" placeholder="Transaction signature for verification" />
            </div>
            <Button type="submit" disabled={transactionMutation.isPending} className="w-full">
              {transactionMutation.isPending ? 'Processing...' : 'Send Transaction'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}