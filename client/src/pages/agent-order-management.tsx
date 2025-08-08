import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Clock, 
  DollarSign, 
  Upload, 
  MessageSquare, 
  CheckCircle, 
  XCircle,
  Eye,
  FileText,
  Send
} from '@/lib/icons';
import { useAuth } from '@/hooks/useAuth';

interface Order {
  id: string;
  orderId: string;
  serviceTitle: string;
  serviceDescription: string;
  amount: number;
  status: string;
  customerId: string;
  createdAt: string;
  deadline?: string;
  requirements?: string;
  escrowStatus: string;
  messages: any[];
}

export default function AgentOrderManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // Fetch agent orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/agent-orders'],
    enabled: isAuthenticated,
    retry: false,
    throwOnError: false
  });

  const orders = (ordersData as any)?.orders || [];

  // Submit delivery mutation
  const submitDeliveryMutation = useMutation({
    mutationFn: async (deliveryData: { orderId: string; message: string; files?: File[] }) => {
      const formData = new FormData();
      formData.append('orderId', deliveryData.orderId);
      formData.append('message', deliveryData.message);
      
      if (deliveryData.files) {
        deliveryData.files.forEach((file, index) => {
          formData.append(`files`, file);
        });
      }

      const response = await fetch('/api/ai-marketplace/submit-delivery', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to submit delivery');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Delivery Submitted",
        description: "Your work has been submitted for customer review.",
      });
      setSelectedOrder(null);
      setDeliveryMessage('');
      setUploadedFiles([]);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/agent-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit delivery. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { orderId: string; message: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/chat/send', messageData);
    },
    onSuccess: () => {
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/agent-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Message Failed",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setUploadedFiles(Array.from(files));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'submitted': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-4">Please log in to access your agent dashboard.</p>
            <Button onClick={() => window.location.href = '/auth'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Order Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your active orders and deliveries</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order: Order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{order.serviceTitle}</CardTitle>
                      <p className="text-sm text-gray-500">Order #{order.orderId.slice(-8)}</p>
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                    {order.serviceDescription}
                  </p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="font-semibold">${order.amount}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Order Details - #{order.orderId.slice(-8)}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="font-semibold">Service Title:</Label>
                            <p>{order.serviceTitle}</p>
                          </div>
                          <div>
                            <Label className="font-semibold">Description:</Label>
                            <p>{order.serviceDescription}</p>
                          </div>
                          {order.requirements && (
                            <div>
                              <Label className="font-semibold">Requirements:</Label>
                              <p>{order.requirements}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="font-semibold">Amount:</Label>
                              <p>${order.amount}</p>
                            </div>
                            <div>
                              <Label className="font-semibold">Escrow Status:</Label>
                              <Badge>{order.escrowStatus}</Badge>
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {order.status === 'pending' || order.status === 'active' ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="w-full">
                            <Upload className="w-4 h-4 mr-2" />
                            Submit Delivery
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Submit Work Delivery</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="delivery-message">Delivery Message</Label>
                              <Textarea
                                id="delivery-message"
                                placeholder="Describe the work you've completed..."
                                value={deliveryMessage}
                                onChange={(e) => setDeliveryMessage(e.target.value)}
                                rows={4}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="file-upload">Upload Files (Optional)</Label>
                              <Input
                                id="file-upload"
                                type="file"
                                multiple
                                onChange={handleFileUpload}
                                className="mt-1"
                              />
                              {uploadedFiles.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-sm text-gray-600">Selected files:</p>
                                  <ul className="text-sm">
                                    {uploadedFiles.map((file, index) => (
                                      <li key={index} className="flex items-center space-x-2">
                                        <FileText className="w-4 h-4" />
                                        <span>{file.name}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            <Button 
                              onClick={() => submitDeliveryMutation.mutate({ 
                                orderId: order.orderId, 
                                message: deliveryMessage,
                                files: uploadedFiles 
                              })}
                              disabled={!deliveryMessage.trim() || submitDeliveryMutation.isPending}
                              className="w-full"
                            >
                              {submitDeliveryMutation.isPending ? 'Submitting...' : 'Submit Delivery'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {order.status === 'completed' ? 'Completed' : 'Submitted'}
                      </Button>
                    )}

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Chat with Customer
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Customer Chat - Order #{order.orderId.slice(-8)}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="max-h-64 overflow-y-auto border rounded p-4">
                            {order.messages && order.messages.length > 0 ? (
                              order.messages.map((msg: any, index: number) => (
                                <div key={index} className="mb-2">
                                  <div className="text-sm text-gray-500">{msg.sender}</div>
                                  <div className="text-sm">{msg.message}</div>
                                </div>
                              ))
                            ) : (
                              <p className="text-gray-500 text-center">No messages yet</p>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <Input
                              placeholder="Type your message..."
                              value={chatMessage}
                              onChange={(e) => setChatMessage(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && chatMessage.trim()) {
                                  sendMessageMutation.mutate({ 
                                    orderId: order.orderId, 
                                    message: chatMessage 
                                  });
                                }
                              }}
                            />
                            <Button 
                              onClick={() => sendMessageMutation.mutate({ 
                                orderId: order.orderId, 
                                message: chatMessage 
                              })}
                              disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No active orders</h3>
            <p className="text-gray-600 dark:text-gray-400">Orders will appear here once customers place them</p>
          </div>
        )}
      </div>
    </div>
  );
}