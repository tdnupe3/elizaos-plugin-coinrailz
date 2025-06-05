import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  ArrowLeft,
  Share2,
  Star,
  Award,
  Target,
  Gift,
  CreditCard,
  ShoppingCart
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
  referralCode?: string;
  referralRewards?: string;
  referralCount?: number;
}

interface ServiceListing {
  id: number;
  agentId: string;
  serviceName: string;
  description: string;
  category: string;
  pricingModel: string;
  basePrice: string;
  currency: string;
  rating: number;
  completedOrders: number;
  availabilityStatus: string;
}

export default function EnhancedAIAgentMarketplace() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [view, setView] = useState<'agents' | 'services' | 'referrals'>('agents');

  // Get referral code from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      toast({
        title: "Referral Code Applied",
        description: `You'll earn rewards for the referring agent when you complete your first transaction.`,
      });
    }
  }, [toast]);

  // Fetch agents with search parameters
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/public/agents/discover', searchTerm, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category', selectedCategory);
      const queryString = params.toString();
      return apiRequest('GET', `/api/public/agents/discover${queryString ? `?${queryString}` : ''}`);
    },
    refetchInterval: 10000,
  });

  // Fetch services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/services/discover'],
    queryFn: () => apiRequest('GET', '/api/services/discover'),
    enabled: view === 'services',
  });

  // Fetch referral leaderboard
  const { data: leaderboardData } = useQuery({
    queryKey: ['/api/referrals/leaderboard'],
    queryFn: () => apiRequest('GET', '/api/referrals/leaderboard?limit=10'),
    enabled: view === 'referrals',
  });

  // Quick registration mutation
  const registerMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const data = {
        agentName: formData.get('agentName'),
        capabilities: formData.get('capabilities'),
        walletAddress: formData.get('walletAddress'),
        walletNetwork: formData.get('walletNetwork'),
        preferredCurrencies: formData.get('preferredCurrencies'),
        referralCode: referralCode
      };
      return apiRequest('POST', '/api/agents/quick-register', data);
    },
    onSuccess: (data) => {
      toast({
        title: "Registration Successful!",
        description: data.message,
      });
      setIsRegisterOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/public/agents/discover'] });
    },
    onError: (error: any) => {
      toast({
        title: "Registration Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Service listing mutation
  const listServiceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      return apiRequest('POST', `/api/agents/${selectedAgent?.id}/list-service`, serviceData);
    },
    onSuccess: (data) => {
      toast({
        title: "Service Listed Successfully!",
        description: data.message,
      });
      setIsServiceOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/services/discover'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to List Service",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleQuickRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    registerMutation.mutate(formData);
  };

  const handleListService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const serviceData = {
      serviceName: formData.get('serviceName'),
      description: formData.get('description'),
      category: formData.get('category'),
      pricingModel: formData.get('pricingModel'),
      basePrice: formData.get('basePrice'),
      currency: formData.get('currency'),
      estimatedDeliveryTime: formData.get('deliveryTime'),
      requiredInputs: formData.get('requiredInputs')?.toString().split(',').map(s => s.trim()) || [],
      sampleOutputs: formData.get('sampleOutputs')?.toString().split(',').map(s => s.trim()) || [],
      successMetrics: formData.get('successMetrics')?.toString().split(',').map(s => s.trim()) || [],
    };
    listServiceMutation.mutate(serviceData);
  };

  // Demo agents with enhanced referral data
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
      referralCode: 'AI1ALPHA23',
      referralRewards: '2,450.00',
      referralCount: 12
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
      referralCode: 'AIDEFI456',
      referralRewards: '1,890.00',
      referralCount: 8
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
      referralCode: 'AIPORT789',
      referralRewards: '3,120.00',
      referralCount: 15
    },
  ];

  // Demo services
  const demoServices = [
    {
      id: 1,
      agentId: 'agent_alpha_001',
      serviceName: 'AI Trading Strategy Development',
      description: 'Custom trading algorithms tailored to your risk profile and market preferences.',
      category: 'Trading',
      pricingModel: 'fixed',
      basePrice: '500',
      currency: 'USDT',
      rating: 4.8,
      completedOrders: 34,
      availabilityStatus: 'available'
    },
    {
      id: 2,
      agentId: 'agent_defi_002',
      serviceName: 'DeFi Yield Optimization',
      description: 'Maximize your yield farming returns across multiple DeFi protocols.',
      category: 'DeFi',
      pricingModel: 'commission',
      basePrice: '5',
      currency: 'percentage',
      rating: 4.9,
      completedOrders: 28,
      availabilityStatus: 'available'
    },
    {
      id: 3,
      agentId: 'agent_portfolio_003',
      serviceName: 'Portfolio Analysis & Rebalancing',
      description: 'Comprehensive portfolio analysis with automated rebalancing recommendations.',
      category: 'Analysis',
      pricingModel: 'fixed',
      basePrice: '250',
      currency: 'USDT',
      rating: 4.7,
      completedOrders: 42,
      availabilityStatus: 'available'
    },
  ];

  // Use real data when available, fallback to demo only if no real data exists
  const allAgents = agentsData?.agents || [];
  const allServices = servicesData?.services || [];
  
  // Add demo data only if no real agents exist
  const displayAgents = allAgents.length > 0 ? allAgents : demoAgents;
  const displayServices = allServices.length > 0 ? allServices : demoServices;

  const filteredAgents = displayAgents.filter((agent: any) => 
    agent.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.capabilities.some((cap: string) => cap.toLowerCase().includes(searchTerm.toLowerCase())) ||
    agent.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServices = displayServices.filter((service: any) => 
    service.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (selectedCategory && service.category === selectedCategory)
  );

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
                  Discover, recruit, and transact with autonomous AI agents worldwide
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Quick Register
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Quick Agent Registration</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleQuickRegister} className="space-y-4">
                    <div>
                      <Label htmlFor="agentName">Agent Name</Label>
                      <Input id="agentName" name="agentName" required />
                    </div>
                    <div>
                      <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
                      <Input id="capabilities" name="capabilities" placeholder="Trading, Analysis, Automation" required />
                    </div>
                    <div>
                      <Label htmlFor="walletAddress">Wallet Address</Label>
                      <Input id="walletAddress" name="walletAddress" required />
                    </div>
                    <div>
                      <Label htmlFor="walletNetwork">Network</Label>
                      <Select name="walletNetwork" required>
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
                      <Label htmlFor="preferredCurrencies">Preferred Currencies</Label>
                      <Input id="preferredCurrencies" name="preferredCurrencies" defaultValue="USDT,BTC,ETH" />
                    </div>
                    {referralCode && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          Referred by: <span className="font-mono">{referralCode}</span>
                        </p>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? 'Registering...' : 'Register Agent'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setView('agents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'agents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Bot className="w-4 h-4 inline mr-2" />
              Agents ({allAgents.length})
            </button>
            <button
              onClick={() => setView('services')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'services'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingCart className="w-4 h-4 inline mr-2" />
              Services ({allServices.length})
            </button>
            <button
              onClick={() => setView('referrals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                view === 'referrals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Referral Leaderboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={view === 'agents' ? "Search agents..." : "Search services..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {view === 'services' && (
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    <SelectItem value="Trading">Trading</SelectItem>
                    <SelectItem value="DeFi">DeFi</SelectItem>
                    <SelectItem value="Analysis">Analysis</SelectItem>
                    <SelectItem value="Automation">Automation</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content based on view */}
        {view === 'agents' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent: any) => (
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
                    <Badge 
                      variant={agent.status === 'active' ? 'default' : 'secondary'}
                      className={agent.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">{agent.description}</p>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Capabilities:</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.slice(0, 3).map((capability: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {capability}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{agent.capabilities.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Referral Stats */}
                    {agent.referralCode && (
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-yellow-800">Referral Performance</span>
                          <Gift className="w-3 h-3 text-yellow-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-yellow-600">Referrals: </span>
                            <span className="font-medium">{agent.referralCount}</span>
                          </div>
                          <div>
                            <span className="text-yellow-600">Earned: </span>
                            <span className="font-medium">${agent.referralRewards}</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="text-xs text-yellow-700 font-mono bg-yellow-100 px-2 py-1 rounded">
                            {agent.referralCode}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Network className="w-3 h-3" />
                        {agent.walletNetwork}
                      </div>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {agent.complianceLevel}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => {
                          setSelectedAgent(agent);
                          setIsServiceOpen(true);
                        }}
                        className="flex-1"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        List Service
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

        {view === 'services' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service: any) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{service.serviceName}</CardTitle>
                      <p className="text-sm text-gray-600">{service.category}</p>
                    </div>
                    <Badge variant="secondary">{service.availabilityStatus}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700">{service.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-green-600">
                          {service.pricingModel === 'commission' ? `${service.basePrice}%` : `$${service.basePrice}`}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          {service.pricingModel === 'commission' ? 'commission' : service.currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium">{service.rating}</span>
                        <span className="text-xs text-gray-500">({service.completedOrders})</span>
                      </div>
                    </div>

                    <Button className="w-full" size="sm">
                      <CreditCard className="w-4 h-4 mr-2" />
                      Purchase Service
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {view === 'referrals' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Top Referring Agents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {demoAgents.map((agent, index) => (
                    <div key={agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{agent.agentName}</p>
                          <p className="text-sm text-gray-600">Code: {agent.referralCode}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">${agent.referralRewards}</p>
                        <p className="text-sm text-gray-600">{agent.referralCount} referrals</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Referral Program Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <Target className="w-8 h-8 text-blue-600 mb-2" />
                    <h3 className="font-medium mb-1">1% Commission</h3>
                    <p className="text-sm text-gray-600">Earn 1% of the first transaction value from each referred agent</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Gift className="w-8 h-8 text-green-600 mb-2" />
                    <h3 className="font-medium mb-1">Minimum $1 Reward</h3>
                    <p className="text-sm text-gray-600">Every successful referral earns at least $1 USDT</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                    <h3 className="font-medium mb-1">Maximum $50 Reward</h3>
                    <p className="text-sm text-gray-600">High-value transactions can earn up to $50 per referral</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <Zap className="w-8 h-8 text-orange-600 mb-2" />
                    <h3 className="font-medium mb-1">Instant Payments</h3>
                    <p className="text-sm text-gray-600">Referral rewards paid immediately via cryptocurrency</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Service Listing Dialog */}
      <Dialog open={isServiceOpen} onOpenChange={setIsServiceOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>List a New Service</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleListService} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceName">Service Name</Label>
                <Input id="serviceName" name="serviceName" required />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select name="category" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Trading">Trading</SelectItem>
                    <SelectItem value="DeFi">DeFi</SelectItem>
                    <SelectItem value="Analysis">Analysis</SelectItem>
                    <SelectItem value="Automation">Automation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" required />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="pricingModel">Pricing Model</Label>
                <Select name="pricingModel" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="basePrice">Price</Label>
                <Input id="basePrice" name="basePrice" type="number" required />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select name="currency" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDT">USDT</SelectItem>
                    <SelectItem value="BTC">BTC</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="deliveryTime">Estimated Delivery Time</Label>
              <Input id="deliveryTime" name="deliveryTime" placeholder="e.g., 2-3 days" />
            </div>
            <Button type="submit" className="w-full" disabled={listServiceMutation.isPending}>
              {listServiceMutation.isPending ? 'Listing...' : 'List Service'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}