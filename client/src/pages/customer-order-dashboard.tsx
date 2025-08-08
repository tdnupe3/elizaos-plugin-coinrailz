import { useState } from 'react';
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
  Download, 
  MessageSquare, 
  CheckCircle, 
  XCircle,
  Star,
  FileText,
  Send
} from '@/lib/icons';
import { ArrowUp, ArrowDown } from '@/lib/icons';
import { useAuth } from '@/hooks/useAuth';

interface Order {
  id: string;
  orderId: string;
  serviceTitle: string;
  serviceDescription: string;
  amount: number;
  status: string;
  agentId: string;
  createdAt: string;
  deadline?: string;
  requirements?: string;
  escrowStatus: string;
  messages: any[];
  deliveries?: any[];
}

export default function CustomerOrderDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Fetch customer orders
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['/api/ai-marketplace/customer-orders'],
    enabled: isAuthenticated,
    retry: false,
    throwOnError: false
  });

  const orders = (ordersData as any)?.orders || [];

  // Send chat message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { orderId: string; message: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/chat/send', messageData);
    },
    onSuccess: () => {
      setChatMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/customer-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Message Failed",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  // Approve delivery mutation
  const approveDeliveryMutation = useMutation({
    mutationFn: async (approvalData: { orderId: string; rating: number; review: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/approve-delivery', approvalData);
    },
    onSuccess: () => {
      toast({
        title: "Delivery Approved",
        description: "Payment has been released to the agent. Thank you for your review!",
      });
      setSelectedOrder(null);
      setReviewRating(5);
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/customer-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve delivery.",
        variant: "destructive",
      });
    },
  });

  // Reject delivery mutation
  const rejectDeliveryMutation = useMutation({
    mutationFn: async (rejectionData: { orderId: string; reason: string }) => {
      return await apiRequest('POST', '/api/ai-marketplace/reject-delivery', rejectionData);
    },
    onSuccess: () => {
      toast({
        title: "Delivery Rejected",
        description: "The agent has been notified to revise their work.",
      });
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ['/api/ai-marketplace/customer-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject delivery.",
        variant: "destructive",
      });
    },
  });

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
            <p className="text-gray-600 mb-4">Please log in to access your order dashboard.</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Orders</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your AI service orders and communicate with agents</p>
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
                    {/* Chat Button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Chat with Agent
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Agent Chat - Order #{order.orderId.slice(-8)}</DialogTitle>
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

                    {/* Delivery Review - Show if work is submitted */}
                    {order.status === 'submitted' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button className="w-full">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Review Delivery
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Review Work Delivery</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {order.deliveries && order.deliveries.length > 0 && (
                              <div>
                                <Label className="font-semibold">Delivered Work:</Label>
                                {order.deliveries.map((delivery: any, index: number) => (
                                  <div key={index} className="border rounded p-4 mt-2">
                                    <p className="text-sm mb-2">{delivery.message}</p>
                                    {delivery.files && delivery.files.length > 0 && (
                                      <div className="space-y-1">
                                        <Label className="text-xs">Attached Files:</Label>
                                        {delivery.files.map((file: any, fileIndex: number) => (
                                          <div key={fileIndex} className="flex items-center space-x-2">
                                            <FileText className="w-4 h-4" />
                                            <span className="text-sm">{file.filename}</span>
                                            <Button size="sm" variant="outline">
                                              <Download className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <div>
                              <Label className="font-semibold">Rate the Work (1-5 stars):</Label>
                              <div className="flex space-x-1 mt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setReviewRating(star)}
                                    className="p-0 border-none bg-transparent"
                                  >
                                    <Star
                                      className={`w-6 h-6 cursor-pointer ${
                                        star <= reviewRating ? 'fill-current text-yellow-400' : 'text-gray-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <Label htmlFor="review-comment">Review Comment:</Label>
                              <Textarea
                                id="review-comment"
                                placeholder="Share your feedback about the work..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                rows={3}
                              />
                            </div>

                            <div className="flex space-x-3">
                              <Button 
                                onClick={() => approveDeliveryMutation.mutate({ 
                                  orderId: order.orderId, 
                                  rating: reviewRating,
                                  review: reviewComment 
                                })}
                                disabled={approveDeliveryMutation.isPending}
                                className="flex-1"
                              >
                                <ArrowUp className="w-4 h-4 mr-2" />
                                Approve & Release Payment
                              </Button>
                              <Button 
                                variant="outline"
                                onClick={() => rejectDeliveryMutation.mutate({ 
                                  orderId: order.orderId, 
                                  reason: reviewComment || 'Work needs revision'
                                })}
                                disabled={rejectDeliveryMutation.isPending}
                                className="flex-1"
                              >
                                <ArrowDown className="w-4 h-4 mr-2" />
                                Request Revision
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Order Status Display */}
                    {order.status === 'completed' && (
                      <Button variant="outline" className="w-full" disabled>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Order Completed
                      </Button>
                    )}

                    {(order.status === 'pending' || order.status === 'active') && (
                      <Button variant="outline" className="w-full" disabled>
                        <Clock className="w-4 h-4 mr-2" />
                        Agent Working
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No orders yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Browse our AI services to get started</p>
            <Button onClick={() => window.location.href = '/ai-marketplace'}>
              Browse Services
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}