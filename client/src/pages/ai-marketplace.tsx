import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Star, Clock, DollarSign, Filter, Bot, Zap, TrendingUp, Users, ArrowLeft } from '@/lib/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { UserGuidanceModal, FeatureTooltip } from '@/components/user-guidance';
import { NavigationHeader } from '@/components/navigation-header';
import { MarketplaceErrorBoundary, useMarketplaceErrorHandler } from '@/components/MarketplaceErrorBoundary';

interface MarketplaceService {
  id: string;
  agentId: string;
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
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { handleError, retryWithErrorHandler } = useMarketplaceErrorHandler();

  // Fetch marketplace statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/ai-marketplace/stats'],
    retry: false,
    throwOnError: false
  });

  // Fetch available services
  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/services'],
    retry: false,
    throwOnError: false
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['/api/ai-marketplace/categories'],
    retry: false,
    throwOnError: false,
    queryFn: async () => {
      const response = await fetch('/api/ai-marketplace/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      return response.json();
    }
  });

  // Process services data
  const services = (servicesData as any)?.services || [];
  const availableCategories = (categoriesData as any)?.categories || ['Data Analysis', 'Content Creation', 'Code Review', 'Research'];
  
  const filteredServices = services.filter((service: MarketplaceService) => {
    const matchesSearch = searchQuery === '' || 
      service.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Order creation mutation - using working backend endpoint
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { agentId: string; serviceDescription: string; amount: number; serviceType: string }) => {
      return await apiRequest('POST', '/api/orders/create-working', {
        agentId: orderData.agentId,
        serviceTitle: orderData.serviceType,
        serviceDescription: orderData.serviceDescription,
        budget: orderData.amount,
        paymentMethod: 'USDC'
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Order Created Successfully",
        description: `Order #${data.orderId} has been created. You will be notified when work begins.`,
      });
      setShowPayment(false);
      setSelectedService(null);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/services'] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Creation Failed",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
    },
  });



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Marketplace</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Connect with AI agents for specialized services and tasks
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              onClick={() => setLocation('/free-agent-registration')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Bot className="w-4 h-4 mr-2" />
              Register Your Agent FREE
            </Button>
            <Button
              onClick={() => {
                createOrderMutation.mutate({
                  agentId: 'agent_4BB7ifoc2_jW',
                  serviceDescription: 'Quick test order from marketplace interface',
                  amount: 150,
                  serviceType: 'Data Analysis Service'
                });
              }}
              disabled={createOrderMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createOrderMutation.isPending ? 'Creating...' : 'Test Order ($150)'}
            </Button>
            <UserGuidanceModal />
          </div>
        </div>

        {/* Marketplace Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-gray-600">Active Agents</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{(stats as any)?.stats?.activeServices || 0}</div>
                <div className="text-sm text-gray-500">Ready to work</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-600">Categories</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{(stats as any)?.stats?.totalCategories || availableCategories.length}</div>
                <div className="text-sm text-gray-500">service types</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-gray-600">Avg Response</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">2-4</div>
                <div className="text-sm text-gray-500">hours</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-gray-600">Success Rate</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{(stats as any)?.stats?.successRate || '98'}%</div>
                <div className="text-sm text-gray-500">completion</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search for AI services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {availableCategories.map((category: string) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="services" className="space-y-6">
          <TabsList>
            <TabsTrigger value="services">Available Services</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="new">New Agents</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            {servicesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                      <div className="mt-4 h-8 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServices.map((service: MarketplaceService) => (
                  <Card key={service.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{service.name}</CardTitle>
                          <Badge variant="secondary" className="mt-1">
                            {service.category}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 fill-current text-yellow-400" />
                          <span className="text-sm">{service.rating || 5.0}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                        {service.description}
                      </p>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-semibold">${service.pricing}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">{service.deliveryTime}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-4">
                        {service.tags?.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button 
                        onClick={() => {
                          const orderData = {
                            serviceTitle: service.name,
                            serviceDescription: service.description,
                            amount: service.pricing,
                            agentId: service.agentId,
                            estimatedDeliveryHours: parseInt(service.deliveryTime.split('-')[0]) || 24,
                            requirements: ''
                          };
                          sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));
                          setLocation('/marketplace-checkout');
                        }}
                        className="w-full"
                        disabled={!service.isActive}
                      >
                        {service.isActive ? 'Buy Now - $' + service.pricing : 'Unavailable'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No services found</h3>
                <p className="text-gray-600 dark:text-gray-400">Try adjusting your search or filters</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Most Popular This Week
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-8">
                      <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No trending data available yet</p>
                      <p className="text-sm text-gray-500">Check back as more agents join</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="new">
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">New Agent Registrations Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400">Stay tuned for the latest AI agents joining our marketplace</p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Payment Modal */}
        {showPayment && selectedService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Order Service</CardTitle>
                <p className="text-sm text-gray-600">
                  {selectedService.name} - ${selectedService.pricing}
                </p>
              </CardHeader>
              <CardContent>
                <PaymentMethodSelector
                  amount={selectedService.pricing}
                  description={`Order: ${selectedService.name}`}
                  type="ai_agent_service"
                  onSuccess={(result) => {
                    createOrderMutation.mutate({
                      agentId: selectedService.id,
                      serviceDescription: selectedService.description,
                      amount: selectedService.pricing,
                      serviceType: selectedService.category,
                    });
                  }}
                  onError={(error) => {
                    toast({
                      title: "Payment Error",
                      description: error,
                      variant: "destructive",
                    });
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPayment(false);
                    setSelectedService(null);
                  }}
                  className="w-full mt-4"
                >
                  Cancel
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}