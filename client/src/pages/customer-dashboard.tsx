import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  MessageSquare,
  Star,
  Search,
  Filter,
  Download,
  AlertTriangle
} from '@/lib/icons';

interface Order {
  id: string;
  agentName: string;
  service: string;
  amount: number;
  status: string;
  deadline: string;
  progress: number;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  hourlyRate: number;
  availability: string;
  completedOrders: number;
}

export default function CustomerDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setOrders([
        {
          id: 'ORD_001',
          agentName: 'Sarah AI Analytics',
          service: 'Sales Data Analysis',
          amount: 150,
          status: 'in_progress',
          deadline: '2025-07-05',
          progress: 65,
          createdAt: '2025-06-28'
        },
        {
          id: 'ORD_002',
          agentName: 'Marcus ML Expert',
          service: 'Predictive Modeling',
          amount: 350,
          status: 'delivered',
          deadline: '2025-07-02',
          progress: 100,
          createdAt: '2025-06-25'
        },
        {
          id: 'ORD_003',
          agentName: 'Lisa Content Pro',
          service: 'Content Strategy',
          amount: 200,
          status: 'completed',
          deadline: '2025-06-30',
          progress: 100,
          createdAt: '2025-06-20'
        }
      ]);

      setFeaturedAgents([
        {
          id: 'agent_001',
          name: 'David Automation',
          specialization: 'Process Automation',
          rating: 4.9,
          hourlyRate: 85,
          availability: 'Available',
          completedOrders: 156
        },
        {
          id: 'agent_002',
          name: 'Emma Finance AI',
          specialization: 'Financial Analysis',
          rating: 4.8,
          hourlyRate: 95,
          availability: 'Busy',
          completedOrders: 89
        },
        {
          id: 'agent_003',
          name: 'Alex Code Review',
          specialization: 'Code Analysis',
          rating: 4.7,
          hourlyRate: 75,
          availability: 'Available',
          completedOrders: 203
        }
      ]);

      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'delivered': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'pending': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'delivered': return 'Ready for Review';
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const filteredAgents = featuredAgents.filter(agent =>
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-64"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
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
              Customer Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your orders and discover AI agents
            </p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Browse Services
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === 'in_progress').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {orders.filter(o => o.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully delivered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${orders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all orders
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders">My Orders</TabsTrigger>
            <TabsTrigger value="agents">Find Agents</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>
                  Track your service orders and their progress
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
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Agent: {order.agentName} • Due: {order.deadline}
                        </p>
                        {order.status === 'in_progress' && (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${order.progress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">${order.amount}</div>
                        <div className="flex gap-2 mt-2">
                          {order.status === 'delivered' && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              Review & Accept
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Message
                          </Button>
                          {order.status === 'completed' && (
                            <Button size="sm" variant="outline">
                              <Download className="w-4 h-4 mr-1" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Find AI Agents</CardTitle>
                <CardDescription>
                  Discover skilled professionals for your projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search agents by name or specialization..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    Filters
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAgents.map((agent) => (
                    <Card key={agent.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar>
                            <AvatarFallback className="bg-blue-600 text-white">
                              {agent.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold">{agent.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {agent.specialization}
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span>Rating</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-400 fill-current" />
                              <span>{agent.rating}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Rate</span>
                            <span>${agent.hourlyRate}/hour</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Completed</span>
                            <span>{agent.completedOrders} orders</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Status</span>
                            <Badge 
                              variant="outline" 
                              className={agent.availability === 'Available' ? 'text-green-600 border-green-600' : 'text-orange-600 border-orange-600'}
                            >
                              {agent.availability}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1">
                            Hire Agent
                          </Button>
                          <Button size="sm" variant="outline">
                            View Profile
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
                <CardDescription>
                  Communication with your agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Avatar>
                      <AvatarFallback className="bg-blue-600 text-white">SA</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">Sarah AI Analytics</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        "I've completed 65% of your sales analysis. The initial trends look very promising..."
                      </p>
                      <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
                    </div>
                    <Button size="sm">Reply</Button>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 border rounded-lg">
                    <Avatar>
                      <AvatarFallback className="bg-green-600 text-white">MM</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">Marcus ML Expert</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        "Your predictive model is ready for review. I've included detailed documentation..."
                      </p>
                      <p className="text-xs text-gray-500 mt-1">1 day ago</p>
                    </div>
                    <Button size="sm">Reply</Button>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                    <div className="flex-1">
                      <p className="font-medium">System Notification</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Order ORD_001 deadline is approaching (3 days remaining)
                      </p>
                      <p className="text-xs text-gray-500 mt-1">6 hours ago</p>
                    </div>
                    <Button size="sm" variant="outline">View Order</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}