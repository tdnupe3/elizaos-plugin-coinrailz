import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Bot, 
  Search, 
  Plus, 
  DollarSign, 
  Clock, 
  Users, 
  TrendingUp,
  ShoppingCart,
  MessageSquare,
  Star,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  FileText,
  Package
} from '@/lib/icons';
import { Link } from 'wouter';

interface Agent {
  id: string;
  name: string;
  specialties: string[];
  rating: number;
  completedProjects: number;
  hourlyRate: number;
  availability: string;
  responseTime: string;
  skills: string[];
  verified: boolean;
  description: string;
}

interface Order {
  id: string;
  serviceTitle: string;
  budget: string;
  status: string;
  agentId: string;
  customerId: string;
  createdAt: string;
  deadline?: string;
  platformFee?: string;
  agentAmount?: string;
}

interface Chat {
  id: string;
  chatName: string;
  participants: string[];
  lastMessage?: {
    content: string;
    timestamp: string;
    senderId: string;
  };
  updatedAt: string;
  isActive: boolean;
  orderId?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function MarketplaceDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [activeTab, setActiveTab] = useState('discover');
  
  // Form states
  const [orderForm, setOrderForm] = useState({
    serviceTitle: '',
    serviceDescription: '',
    budget: '',
    deadline: '',
    requirements: '',
    paymentMethod: 'USDC'
  });

  const [agentForm, setAgentForm] = useState({
    agentName: '',
    description: '',
    category: '',
    capabilities: [] as string[],
    walletAddress: '',
    walletNetwork: 'ethereum',
    contactEmail: ''
  });

  // Data fetching
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
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

  const { data: ordersData } = useQuery({
    queryKey: ['/api/orders/my-orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders/my-orders');
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    }
  });

  const { data: chatsData } = useQuery({
    queryKey: ['/api/messaging/chats'],
    queryFn: async () => {
      const response = await fetch('/api/messaging/chats');
      if (!response.ok) throw new Error('Failed to fetch chats');
      return response.json();
    }
  });

  // Process data
  const agents: Agent[] = agentsData?.data?.agents || [];
  const categories: Category[] = categoriesData?.data || [];
  const orders: Order[] = ordersData?.orders || [];
  const chats: Chat[] = chatsData?.chats || [];

  // Filter agents
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = !searchTerm || 
      agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.specialties?.some(specialty => specialty.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      agent.specialties?.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  // Mutations
  const registerAgentMutation = useMutation({
    mutationFn: async (data: typeof agentForm) => {
      const response = await apiRequest('POST', '/api/free-agent-registration', data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Agent Registered Successfully",
        description: `Agent ${data.agent?.name} has been registered`,
      });
      setShowAgentForm(false);
      setAgentForm({
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
    onError: () => {
      toast({
        title: "Registration Failed",
        description: "Failed to register agent. Please try again.",
        variant: "destructive"
      });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my-orders'] });
    }
  });

  const handleCapabilityToggle = (capability: string) => {
    setAgentForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }));
  };

  const handleAgentRegistration = () => {
    if (!agentForm.agentName || !agentForm.description || !agentForm.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    registerAgentMutation.mutate(agentForm);
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
      agentWallet: selectedAgent.walletAddress || ''
    };
    
    createOrderMutation.mutate(orderData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                ←
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                  <Bot className="h-8 w-8 text-blue-600" />
                  AI Marketplace Dashboard
                </h1>
                <p className="text-slate-600 dark:text-slate-400">Complete marketplace management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Dialog open={showAgentForm} onOpenChange={setShowAgentForm}>
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
                          value={agentForm.agentName}
                          onChange={(e) => setAgentForm(prev => ({ ...prev, agentName: e.target.value }))}
                          placeholder="My AI Assistant"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Select value={agentForm.category} onValueChange={(value) => setAgentForm(prev => ({ ...prev, category: value }))}>
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
                        value={agentForm.description}
                        onChange={(e) => setAgentForm(prev => ({ ...prev, description: e.target.value }))}
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
                            variant={agentForm.capabilities.includes(capability) ? "default" : "outline"}
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
                          value={agentForm.walletAddress}
                          onChange={(e) => setAgentForm(prev => ({ ...prev, walletAddress: e.target.value }))}
                          placeholder="0x..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactEmail">Contact Email</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          value={agentForm.contactEmail}
                          onChange={(e) => setAgentForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                          placeholder="agent@example.com"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowAgentForm(false)}>
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="discover">Discover Agents</TabsTrigger>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-6">
            {/* Search and Filters */}
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

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                    <ShoppingCart className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">My Orders</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{orders.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <MessageSquare className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Active Chats</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{chats.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-yellow-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Categories</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{categories.length}</p>
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
                  <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <Bot className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{agent.name}</CardTitle>
                            {agent.verified && (
                              <Badge variant="secondary" className="mt-1">
                                Verified
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{agent.rating}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                        {agent.description}
                      </p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Rate:</span>
                          <span className="font-medium">${agent.hourlyRate}/hour</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Completed:</span>
                          <span className="font-medium">{agent.completedProjects} projects</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Response:</span>
                          <span className="font-medium">{agent.responseTime}</span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {agent.specialties.slice(0, 3).map((specialty, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {specialty.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-2">
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
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">My Orders</h2>
              <Button onClick={() => setActiveTab('discover')}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Order
              </Button>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No orders yet</h3>
                <p className="text-slate-600 dark:text-slate-400">Start by hiring an AI agent from the discover tab</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{order.serviceTitle}</CardTitle>
                          <p className="text-slate-600 dark:text-slate-400">Order #{order.id}</p>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Budget</p>
                          <p className="font-medium">${order.budget}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Agent ID</p>
                          <p className="font-medium">{order.agentId.slice(-8)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Created</p>
                          <p className="font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Deadline</p>
                          <p className="font-medium">{order.deadline ? new Date(order.deadline).toLocaleDateString() : 'Not set'}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Chat
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Messages</h2>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
            </div>

            {chats.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No conversations yet</h3>
                <p className="text-slate-600 dark:text-slate-400">Start chatting with agents after hiring them</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {chats.map((chat) => (
                  <Card key={chat.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-medium text-slate-900 dark:text-white">{chat.chatName}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Participants: {chat.participants.length}
                          </p>
                          {chat.lastMessage && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              Last: {chat.lastMessage.content.slice(0, 50)}...
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">
                            {new Date(chat.updatedAt).toLocaleDateString()}
                          </p>
                          <Badge variant={chat.isActive ? "default" : "secondary"} className="mt-1">
                            {chat.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Total Spent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    ${orders.reduce((sum, order) => sum + parseFloat(order.budget || '0'), 0)}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Across {orders.length} orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    Avg Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">2.3h</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Average agent response</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">94%</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Projects completed successfully</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Order Form Modal */}
      <Dialog open={showOrderForm} onOpenChange={setShowOrderForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hire {selectedAgent?.name}</DialogTitle>
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