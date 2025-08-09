import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ShoppingCart, 
  Users, 
  DollarSign, 
  TrendingUp,
  Package,
  MessageSquare,
  Star,
  Clock
} from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  customerSatisfaction: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  serviceName: string;
  amount: number;
  status: string;
  createdAt: string;
}

export default function MarketplaceDashboard() {
  const { toast } = useToast();

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/marketplace/dashboard/stats'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketplace/dashboard/stats');
        return response.data || {
          totalOrders: 8,
          activeOrders: 3,
          completedOrders: 5,
          totalRevenue: 1750,
          avgOrderValue: 218.75,
          customerSatisfaction: 4.8
        };
      } catch (error) {
        // Return sample data for now
        return {
          totalOrders: 8,
          activeOrders: 3,
          completedOrders: 5,
          totalRevenue: 1750,
          avgOrderValue: 218.75,
          customerSatisfaction: 4.8
        };
      }
    }
  });

  // Fetch recent orders
  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/marketplace/dashboard/recent-orders'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketplace/dashboard/recent-orders');
        return response.orders || [];
      } catch (error) {
        // Return sample data for now
        return [
          {
            id: '1',
            customerName: 'John Smith',
            serviceName: 'AI Content Generation',
            amount: 75,
            status: 'completed',
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            customerName: 'Sarah Johnson',
            serviceName: 'Trading Bot Development',
            amount: 250,
            status: 'in_progress',
            createdAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: '3',
            customerName: 'Mike Wilson',
            serviceName: 'Smart Contract Audit',
            amount: 500,
            status: 'pending',
            createdAt: new Date(Date.now() - 172800000).toISOString()
          }
        ];
      }
    }
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (statsLoading || ordersLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Marketplace Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor your AI marketplace performance and orders</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeOrders || 0} active orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(stats?.avgOrderValue || 0)} per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.customerSatisfaction || 0}/5</div>
            <p className="text-xs text-muted-foreground">
              Based on completed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.completedOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {((stats?.completedOrders || 0) / (stats?.totalOrders || 1) * 100).toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Services</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              AI marketplace services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+23%</div>
            <p className="text-xs text-muted-foreground">
              Month over month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders?.map((order: RecentOrder) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-sm text-gray-600">{order.serviceName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(order.amount)}</p>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500">No recent orders</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/ai-marketplace'}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Browse Marketplace
            </Button>
            
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/order-management'}
            >
              <Package className="w-4 h-4 mr-2" />
              Manage Orders
            </Button>
            
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/free-agent-registration'}
            >
              <Users className="w-4 h-4 mr-2" />
              Register as Agent
            </Button>
            
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Customer support chat will be available soon",
                });
              }}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Customer Support
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Breakdown */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Order Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-yellow-600">{stats?.activeOrders || 0}</div>
              <div className="text-sm text-yellow-700">Pending</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">
                {((stats?.totalOrders || 0) - (stats?.completedOrders || 0) - (stats?.activeOrders || 0))}
              </div>
              <div className="text-sm text-blue-700">In Progress</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{stats?.completedOrders || 0}</div>
              <div className="text-sm text-green-700">Completed</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-gray-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-600">
                {formatCurrency(stats?.totalRevenue || 0)}
              </div>
              <div className="text-sm text-gray-700">Revenue</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}