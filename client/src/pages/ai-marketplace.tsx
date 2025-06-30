import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Star, Clock, DollarSign, Filter, Bot, Zap, TrendingUp } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface MarketplaceService {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing: number;
  deliveryTime: string;
  tags: string[];
  isActive: boolean;
  rating?: number;
  completedOrders?: number;
}

export default function AIMarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedService, setSelectedService] = useState<MarketplaceService | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Order creation mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { agentId: string; serviceDescription: string; amount: number; serviceType: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/create-order', orderData);
    },
    onSuccess: (data) => {
      toast({
        title: "Order Created Successfully",
        description: `Order ID: ${data.orderId}. The agent will be notified.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ai-agents/search'] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Creation Failed",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
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

  const { data: paymentMethods } = useQuery({
    queryKey: ['/api/ai-marketplace/payment-methods'],
    queryFn: async () => {
      const response = await fetch('/api/ai-marketplace/payment-methods');
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      return response.json();
    }
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/ai-marketplace/stats'],
    queryFn: async () => {
      return {
        totalAgents: mockServices.length,
        activeOrders: 156,
        averageRating: 4.8,
        totalRevenue: 125000
      };
    }
  });

  // Mock services for demonstration - in production this would fetch from actual agent registry
  const mockServices: MarketplaceService[] = [
    {
      id: 'data-analyst-pro',
      name: 'Data Analysis Pro',
      description: 'Advanced AI agent specializing in data processing, visualization, and statistical analysis',
      category: 'data-analysis',
      pricing: 75,
      deliveryTime: '24 hours',
      tags: ['machine learning', 'data visualization', 'statistics'],
      isActive: true,
      rating: 4.8,
      completedOrders: 142
    },
    {
      id: 'content-creator-ai',
      name: 'Content Creator AI',
      description: 'Professional content generation for marketing, blogs, and social media',
      category: 'content-creation',
      pricing: 50,
      deliveryTime: '12 hours',
      tags: ['copywriting', 'marketing', 'SEO'],
      isActive: true,
      rating: 4.9,
      completedOrders: 289
    },
    {
      id: 'automation-expert',
      name: 'Automation Expert',
      description: 'Process automation and workflow optimization specialist',
      category: 'automation',
      pricing: 100,
      deliveryTime: '48 hours',
      tags: ['workflow automation', 'process optimization', 'integration'],
      isActive: true,
      rating: 4.7,
      completedOrders: 98
    },
    {
      id: 'strategy-consultant',
      name: 'Strategy Consultant',
      description: 'Expert business strategy and planning consultation',
      category: 'consultation',
      pricing: 125,
      deliveryTime: '72 hours',
      tags: ['business strategy', 'market analysis', 'planning'],
      isActive: true,
      rating: 4.9,
      completedOrders: 67
    }
  ];

  const filteredServices = mockServices.filter(service => {
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const availableCategories = categoriesData?.categories || [];
  const isLoading = false;

  const handleServicePurchase = (service: MarketplaceService) => {
    setSelectedService(service);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    if (selectedService) {
      // Create order in marketplace system
      createOrderMutation.mutate({
        agentId: selectedService.id,
        serviceDescription: selectedService.description,
        amount: selectedService.pricing,
        serviceType: selectedService.category
      });
    }
    setShowPayment(false);
    setSelectedService(null);
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Payment Failed",
      description: error,
      variant: "destructive",
    });
  };

  if (showPayment && selectedService) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Button 
              variant="ghost" 
              onClick={() => setShowPayment(false)}
              className="mb-4"
            >
              ← Back to Marketplace
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Complete Purchase</h1>
            <p className="text-gray-600 mt-2">Purchasing: {selectedService.name}</p>
          </div>

          <PaymentMethodSelector
            amount={selectedService.pricing}
            currency="USD"
            description={selectedService.name}
            type="ai_agent_service"
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Bot className="w-8 h-8 text-purple-600" />
                AI Agent Marketplace
              </h1>
              <p className="text-gray-600 mt-2">
                Discover and purchase AI-powered services from our premium agent network
              </p>
            </div>
            
            {stats?.stats && (
              <div className="flex gap-4 text-sm text-gray-600">
                <div className="text-center">
                  <div className="font-bold text-lg text-gray-900">{stats.stats.activeServices}</div>
                  <div>Active Services</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-lg text-gray-900">{stats.stats.totalCategories}</div>
                  <div>Categories</div>
                </div>
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search AI services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="services" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="services">Browse Services</TabsTrigger>
            <TabsTrigger value="trending">Trending & Popular</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            {servicesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="h-64 animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-4"></div>
                      <div className="h-3 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-4"></div>
                      <div className="h-8 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServices.map((agent: any) => (
                  <Card key={agent.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-gray-900 mb-2">
                            {agent.name}
                          </CardTitle>
                          <Badge variant="secondary" className="mb-3">
                            {agent.category}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            ${agent.basePrice || agent.pricing || 99}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {agent.description || agent.capabilities?.join(', ') || 'Professional AI agent service'}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {agent.deliveryTime || '24-48 hours'}
                        </div>
                        {agent.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            {agent.rating}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-4">
                        {(agent.capabilities || agent.skills || []).slice(0, 3).map((skill: string, index: number) => (
                          <Badge key={`${agent.id}-${index}`} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      
                      <Button 
                        onClick={() => handleServicePurchase({
                          id: agent.id,
                          name: agent.name,
                          description: agent.description || agent.capabilities?.join(', ') || 'Professional AI agent service',
                          category: agent.category,
                          pricing: agent.basePrice || agent.pricing || 99,
                          deliveryTime: agent.deliveryTime || '24-48 hours',
                          tags: agent.capabilities || agent.skills || [],
                          isActive: agent.status === 'active',
                          rating: agent.rating,
                          completedOrders: agent.completedOrders
                        })}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Purchase Service
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {!servicesLoading && filteredServices.length === 0 && (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
                <p className="text-gray-600">Try adjusting your search or filters</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Popular Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.stats?.popularCategories?.map((cat: any, index: number) => (
                    <div key={cat.category} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="font-medium">{cat.category}</span>
                      </div>
                      <Badge variant="secondary">{cat.count} services</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-600" />
                    Platform Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">3.5% platform fee structure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Premium agents get 1.5% commission rates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Dual payment processing (Stripe + PayPal)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Integrated referral reward system</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Light Security & Privacy Disclaimers */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Privacy Protected</h4>
              <p>Your data is encrypted and never shared with third parties. We follow industry-standard security practices.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Secure Payments</h4>
              <p>All transactions use encrypted payment processing. Your financial information is protected by bank-level security.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Quality Assurance</h4>
              <p>All AI agents are verified and monitored. We maintain service quality standards and dispute resolution.</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-500">
            By using our marketplace, you agree to our Terms of Service and Privacy Policy. 
            Services are provided "as-is" with performance guarantees. 
            Platform fees apply to all transactions. For support, contact our team.
          </div>
        </div>
      </div>
    </div>
  );
}