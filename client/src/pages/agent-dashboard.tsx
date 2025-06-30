import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DollarSign, 
  Star, 
  Users, 
  MessageSquare, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Order {
  id: string;
  customerName: string;
  service: string;
  amount: number;
  status: string;
  deadline: string;
  createdAt: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  method: string;
  date: string;
}

export default function AgentDashboard() {
  const [agentData, setAgentData] = useState(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate agent data loading
    setTimeout(() => {
      setAgentData({
        name: 'Sarah AI Analytics',
        rating: 4.8,
        completedOrders: 127,
        totalEarnings: 15420,
        pendingEarnings: 850,
        status: 'verified'
      });

      setOrders([
        {
          id: 'ORD_001',
          customerName: 'TechCorp Inc',
          service: 'Sales Data Analysis',
          amount: 150,
          status: 'in_progress',
          deadline: '2025-07-05',
          createdAt: '2025-06-28'
        },
        {
          id: 'ORD_002',
          customerName: 'StartupXYZ',
          service: 'Market Research',
          amount: 250,
          status: 'pending_delivery',
          deadline: '2025-07-02',
          createdAt: '2025-06-25'
        },
        {
          id: 'ORD_003',
          customerName: 'E-commerce Plus',
          service: 'Customer Segmentation',
          amount: 300,
          status: 'completed',
          deadline: '2025-06-30',
          createdAt: '2025-06-20'
        }
      ]);

      setPayouts([
        {
          id: 'PAY_001',
          amount: 225,
          status: 'completed',
          method: 'PayPal',
          date: '2025-06-29'
        },
        {
          id: 'PAY_002',
          amount: 112.50,
          status: 'processing',
          method: 'PayPal',
          date: '2025-06-30'
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'pending_delivery': return 'bg-yellow-500';
      case 'processing': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'pending_delivery': return 'Ready to Deliver';
      case 'completed': return 'Completed';
      case 'processing': return 'Processing';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Agent Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Welcome back, {agentData?.name}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              {agentData?.status}
            </Badge>
            <Avatar>
              <AvatarFallback className="bg-blue-600 text-white">
                {agentData?.name?.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${agentData?.totalEarnings.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${agentData?.pendingEarnings}</div>
              <p className="text-xs text-muted-foreground">
                From 2 active orders
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{agentData?.completedOrders}</div>
              <p className="text-xs text-muted-foreground">
                +5 this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center">
                {agentData?.rating}
                <Star className="h-5 w-5 text-yellow-400 ml-1 fill-current" />
              </div>
              <p className="text-xs text-muted-foreground">
                Based on 89 reviews
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">Active Orders</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Orders</CardTitle>
                <CardDescription>
                  Manage your active service orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{order.service}</h3>
                          <Badge variant="outline" className={getStatusColor(order.status)}>
                            {getStatusText(order.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Customer: {order.customerName} • Deadline: {order.deadline}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">${order.amount}</div>
                        <Button size="sm" variant="outline" className="mt-2">
                          {order.status === 'pending_delivery' ? 'Upload Delivery' : 'View Details'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payouts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payout History</CardTitle>
                <CardDescription>
                  Track your payment history and pending payouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {payouts.map((payout) => (
                    <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(payout.status)}`}></div>
                        <div>
                          <p className="font-medium">${payout.amount}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {payout.method} • {payout.date}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {getStatusText(payout.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>
                  Customer communications and order updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <MessageSquare className="h-8 w-8 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">New message from TechCorp Inc</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        "Can you provide an update on the analysis progress?"
                      </p>
                    </div>
                    <Button size="sm">Reply</Button>
                  </div>
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <AlertCircle className="h-8 w-8 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-medium">Order deadline reminder</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        StartupXYZ order due in 2 days
                      </p>
                    </div>
                    <Button size="sm" variant="outline">View</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Order Completion Rate</span>
                      <span>96%</span>
                    </div>
                    <Progress value={96} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Customer Satisfaction</span>
                      <span>4.8/5</span>
                    </div>
                    <Progress value={96} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>On-time Delivery</span>
                      <span>94%</span>
                    </div>
                    <Progress value={94} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Earnings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">June 2025</span>
                      <span className="font-medium">$2,150</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">May 2025</span>
                      <span className="font-medium">$1,890</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">April 2025</span>
                      <span className="font-medium">$2,340</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}