import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  FileText,
  MessageSquare,
  Download
} from 'lucide-react';

interface Order {
  id: string;
  user_id: string;
  agent_id: string;
  service_type: string;
  amount: number;
  platform_fee: number;
  status: string;
  description: string;
  created_at: string;
  completed_at?: string;
}

export default function OrderManagement() {
  const { toast } = useToast();

  // Fetch user orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/orders'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/ai-marketplace/orders');
      return response.orders || [];
    }
  });

  // Update order status mutation
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return await apiRequest('PUT', `/api/ai-marketplace/orders/${orderId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/orders'] });
      toast({
        title: "Order Updated",
        description: "Order status has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'paid':
      case 'in_progress':
        return <Package className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Order Management</h1>
        <p className="text-gray-600 mt-2">Track and manage your marketplace orders</p>
      </div>

      {!orders || orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Yet</h3>
            <p className="text-gray-600 mb-4">
              You haven't placed any orders in the AI marketplace yet.
            </p>
            <Button onClick={() => window.location.href = '/ai-marketplace'}>
              Browse Marketplace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order: Order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(order.status)}
                    <div>
                      <CardTitle className="text-lg">
                        Order #{order.id.slice(-8)}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Service Type</label>
                    <p className="text-sm">{order.service_type || 'General Service'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Agent ID</label>
                    <p className="text-sm font-mono">{order.agent_id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-green-600 mr-1" />
                      <span className="font-medium">${order.amount}</span>
                    </div>
                  </div>
                </div>

                {order.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm mt-1">{order.description}</p>
                  </div>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {order.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => updateOrderMutation.mutate({ 
                        orderId: order.id, 
                        status: 'cancelled' 
                      })}
                      variant="outline"
                      disabled={updateOrderMutation.isPending}
                    >
                      Cancel Order
                    </Button>
                  )}
                  
                  {order.status === 'paid' && (
                    <Button
                      size="sm"
                      onClick={() => updateOrderMutation.mutate({ 
                        orderId: order.id, 
                        status: 'in_progress' 
                      })}
                      disabled={updateOrderMutation.isPending}
                    >
                      Start Work
                    </Button>
                  )}

                  {order.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => updateOrderMutation.mutate({ 
                        orderId: order.id, 
                        status: 'completed' 
                      })}
                      disabled={updateOrderMutation.isPending}
                    >
                      Mark Complete
                    </Button>
                  )}

                  <Button size="sm" variant="outline">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Agent
                  </Button>

                  {order.status === 'completed' && (
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download Deliverables
                    </Button>
                  )}

                  <Button size="sm" variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                </div>

                {order.completed_at && (
                  <div className="text-sm text-gray-600">
                    <strong>Completed:</strong> {formatDate(order.completed_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Order Statistics */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Order Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {orders?.filter((o: Order) => o.status === 'pending').length || 0}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {orders?.filter((o: Order) => o.status === 'completed').length || 0}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {orders?.filter((o: Order) => o.status === 'in_progress').length || 0}
              </div>
              <div className="text-sm text-gray-600">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                ${orders?.reduce((sum: number, o: Order) => sum + Number(o.amount), 0).toFixed(2) || '0.00'}
              </div>
              <div className="text-sm text-gray-600">Total Spent</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}