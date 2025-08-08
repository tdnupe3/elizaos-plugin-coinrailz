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
  ShoppingCart,
  MessageSquare,
  FileText,
  CheckCircle
} from '@/lib/icons';
import { Link } from 'wouter';

interface Agent {
  id: string;
  name: string;
  agentName?: string;
  agentType?: string;
  category?: string;
  specialties?: string[];
  capabilities?: string[];
  walletAddress?: string;
  walletNetwork?: string;
  status: string;
  description: string;
  rating?: number;
  completedProjects?: number;
  hourlyRate?: number;
  availability?: string;
  responseTime?: string;
  skills?: string[];
  verified?: boolean;
  portfolio?: any[];
  isActive?: boolean;
  registeredAt?: string;
  lastSeen?: string;
}

interface Category {
  id: string;
  name: string;
  count: number;
}

interface OrderFormData {
  serviceTitle: string;
  serviceDescription: string;
  budget: string;
  deadline: string;
  requirements: string;
  paymentMethod: string;
}

export default function AIMarketplaceComplete() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAgentRegistration, setShowAgentRegistration] = useState(false);
  
  // Order form state
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    serviceTitle: '',
    serviceDescription: '',
    budget: '',
    deadline: '',
    requirements: '',
    paymentMethod: 'USDC'
  });

  // Agent registration form state
  const [registrationForm, setRegistrationForm] = useState({
    agentName: '',
    description: '',
    category: '',
    capabilities: [] as string[],
    walletAddress: '',
    walletNetwork: 'ethereum',
    contactEmail: ''
  });

  // Fetch marketplace data using working endpoints
  const { data: globalAgentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/global-ai-agents/search'],
    queryFn: async () => {
      const response = await fetch('/api/global-ai-agents/search');
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    }
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['/api/ai-marketplace/categories'],
    queryFn: async () => {
      const response = await fetch('/api/ai-marketplace/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });

  // Process data from API responses
  const agents: Agent[] = globalAgentsData?.data?.agents || [];
  const categories: Category[] = categoriesData?.categories || [];

  // Filter agents based on search and category
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !searchTerm || 
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.agentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.specialties?.some(specialty => specialty.toLowerCase().includes(searchTerm.toLowerCase())) ||
      agent.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      agent.agentType === selectedCategory ||
      agent.category === selectedCategory ||
      agent.specialties?.includes(selectedCategory);
    
    return matchesSearch && matchesCategory && agent.status === 'active';
  });

  // Agent registration mutation
  const registerAgentMutation = useMutation({
    mutationFn: async (data: typeof registrationForm) => {
      const response = await apiRequest('POST', '/api/free-agent-registration', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Agent Registered Successfully",
        description: `Agent ${data.agent?.name} has been registered with ID: ${data.agentId}`,
      });
      setShowAgentRegistration(false);
      setRegistrationForm({
        agentName: '',
        description: '',
        category: '',
        capabilities: [],
        walletAddress: '',
        walletNetwork: 'ethereum',
        contactEmail: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/global-ai-agents/search'] });
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: "Failed to register agent. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Order creation mutation (placeholder for future implementation)
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // This will connect to the order management system
      const response = await apiRequest('POST', '/api/orders/create', orderData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Created",
        description: "Your service request has been submitted successfully.",
      });
      setShowOrderForm(false);
      setSelectedAgent(null);
    }
  });

  const handleCapabilityToggle = (capability: string) => {
    setRegistrationForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  const handleAgentRegistration = () => {
    if (!registrationForm.agentName || !registrationForm.description || !registrationForm.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    registerAgentMutation.mutate(registrationForm);
  };

  const handleOrderSubmit = () => {
    if (!selectedAgent || !orderForm.serviceTitle || !orderForm.budget) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    const orderData = {
      agentId: selectedAgent.id,
      ...orderForm,
      agentWallet: selectedAgent.walletAddress
    };
    
    createOrderMutation.mutate(orderData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <Bot className="h-8 w-8 text-blue-600" />
                  AI Agent Marketplace
                </h1>
                <p className="text-slate-600 dark:text-slate-400">Discover and hire AI agents for your projects</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Dialog open={showAgentRegistration} onOpenChange={setShowAgentRegistration}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Register Agent
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Register Your AI Agent</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="agentName">Agent Name *</Label>
                        <Input
                          id="agentName"
                          value={registrationForm.agentName}
                          onChange={(e) => setRegistrationForm(prev => ({ ...prev, agentName: e.target.value }))}
                          placeholder="My AI Assistant"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Select value={registrationForm.category} onValueChange={(value) => setRegistrationForm(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="data_analysis">Data Analysis</SelectItem>
                            <SelectItem value="content_creation">Content Creation</SelectItem>
                            <SelectItem value="automation">Automation</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="trading">Trading</SelectItem>
                            <SelectItem value="customer_service">Customer Service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={registrationForm.description}
                        onChange={(e) => setRegistrationForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe your agent's capabilities and services..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label>Capabilities</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['data_analysis', 'content_creation', 'automation', 'research', 'api_integration', 'visualization', 'reporting', 'trading', 'customer_support'].map(capability => (
                          <Button
                            key={capability}
                            variant={registrationForm.capabilities.includes(capability) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleCapabilityToggle(capability)}
                            className="text-xs"
                          >
                            {capability.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="walletAddress">Wallet Address</Label>
                        <Input
                          id="walletAddress"
                          value={registrationForm.walletAddress}
                          onChange={(e) => setRegistrationForm(prev => ({ ...prev, walletAddress: e.target.value }))}
                          placeholder="0x..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactEmail">Contact Email</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={registrationForm.contactEmail}
                          onChange={(e) => setRegistrationForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                          placeholder="agent@example.com"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowAgentRegistration(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAgentRegistration}
                      disabled={registerAgentMutation.isPending}
                    >
                      {registerAgentMutation.isPending ? 'Registering...' : 'Register Agent'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search agents by name, skills, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Agents</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{agents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Agents</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{filteredAgents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Award className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categories</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{categories.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Rating</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">4.8</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Grid */}
        {agentsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No agents found</h3>
            <p className="text-slate-600 dark:text-slate-400">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <Card key={agent.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Bot className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{agent.name || agent.agentName}</CardTitle>
                        {agent.verified && (
                          <Badge variant="secondary" className="mt-1">
                            <Shield className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      <span className="text-sm font-medium">{agent.rating || 4.8}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                    {agent.description}
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                      <span className="font-medium">${agent.hourlyRate || 75}/hour</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Completed:</span>
                      <span className="font-medium">{agent.completedProjects || 0} projects</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Response:</span>
                      <span className="font-medium">{agent.responseTime || '2 hours'}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap gap-1">
                      {(agent.specialties || agent.skills || agent.capabilities || []).slice(0, 3).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowOrderForm(true);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Hire
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Order Form Modal */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hire {selectedAgent?.name || selectedAgent?.agentName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="serviceTitle">Service Title *</Label>
              <Input
                id="serviceTitle"
                value={orderForm.serviceTitle}
                onChange={(e) => setOrderForm(prev => ({ ...prev, serviceTitle: e.target.value }))}
                placeholder="What do you need help with?"
              />
            </div>
            
            <div>
              <Label htmlFor="serviceDescription">Description *</Label>
              <Textarea
                id="serviceDescription"
                value={orderForm.serviceDescription}
                onChange={(e) => setOrderForm(prev => ({ ...prev, serviceDescription: e.target.value }))}
                placeholder="Describe your project requirements..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="budget">Budget (USD) *</Label>
                <Input
                  id="budget"
                  type="number"
                  value={orderForm.budget}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, budget: e.target.value }))}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={orderForm.deadline}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="requirements">Special Requirements</Label>
              <Textarea
                id="requirements"
                value={orderForm.requirements}
                onChange={(e) => setOrderForm(prev => ({ ...prev, requirements: e.target.value }))}
                placeholder="Any specific requirements or preferences..."
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={orderForm.paymentMethod} onValueChange={(value) => setOrderForm(prev => ({ ...prev, paymentMethod: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="USDT">USDT</SelectItem>
                  <SelectItem value="DAI">DAI</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowOrderForm(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleOrderSubmit}
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? 'Creating Order...' : 'Create Order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}