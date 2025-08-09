import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import { 
  User, 
  DollarSign, 
  TrendingUp,
  Package,
  Star,
  Clock,
  CheckCircle,
  Settings,
  BarChart3
} from 'lucide-react';

interface AgentProfile {
  id: string;
  name: string;
  email: string;
  specialties: string[];
  experience: string;
  bio: string;
  skills: string[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  verificationStatus: string;
  statistics: {
    totalOrders: number;
    completedOrders: number;
    totalEarnings: number;
    avgOrderValue: number;
  };
}

export default function AgentDashboard() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: '',
    hourlyRate: 0,
    skills: [] as string[]
  });

  // Mock agent ID for demo - in production this would come from auth
  const agentId = 'demo_agent_001';

  // Fetch agent profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/agent', agentId, 'profile'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/agent/${agentId}/profile`);
        return response.agent;
      } catch (error) {
        // Return demo data if API not ready
        return {
          id: agentId,
          name: 'Demo AI Agent',
          email: 'demo@aiagent.com',
          specialties: ['AI Development', 'Machine Learning', 'Data Analysis'],
          experience: 'expert',
          bio: 'Expert AI consultant specializing in machine learning and data analysis solutions.',
          skills: ['Python', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision'],
          hourlyRate: 125,
          rating: 4.8,
          reviewCount: 24,
          isActive: true,
          verificationStatus: 'approved',
          statistics: {
            totalOrders: 15,
            completedOrders: 12,
            totalEarnings: 2850,
            avgOrderValue: 237.50
          }
        };
      }
    }
  });

  // Fetch agent earnings
  const { data: earnings } = useQuery({
    queryKey: ['/api/agent', agentId, 'earnings'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/agent/${agentId}/earnings`);
        return response.earnings;
      } catch (error) {
        return {
          totalEarnings: 2850,
          commissionRate: 0.85,
          transactions: [
            {
              orderId: '1',
              orderAmount: 250,
              agentCommission: 212.50,
              platformFee: 37.50,
              status: 'completed',
              serviceType: 'AI Content Generation',
              completedAt: new Date().toISOString()
            },
            {
              orderId: '2',
              orderAmount: 500,
              agentCommission: 425,
              platformFee: 75,
              status: 'completed',
              serviceType: 'Smart Contract Audit',
              completedAt: new Date(Date.now() - 86400000).toISOString()
            }
          ]
        };
      }
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updateData: any) => {
      return apiRequest('PUT', `/api/agent/${agentId}/profile`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent', agentId, 'profile'] });
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your agent profile has been updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleEditSubmit = () => {
    updateProfileMutation.mutate(editForm);
  };

  const getVerificationBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">✓ Verified</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">⏳ Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">✗ Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unverified</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (profileLoading) {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agent Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your AI marketplace presence and earnings</p>
          </div>
          {getVerificationBadge(profile?.verificationStatus || 'pending')}
        </div>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(profile?.statistics?.totalEarnings || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {earnings?.commissionRate * 100}% commission rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.statistics?.completedOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              {profile?.statistics?.totalOrders || 0} total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.rating || 0}/5</div>
            <p className="text-xs text-muted-foreground">
              {profile?.reviewCount || 0} reviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hourly Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(profile?.hourlyRate || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Per hour rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Agent Profile</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleEditSubmit();
                } else {
                  setEditForm({
                    bio: profile?.bio || '',
                    hourlyRate: profile?.hourlyRate || 0,
                    skills: profile?.skills || []
                  });
                  setIsEditing(true);
                }
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              {isEditing ? 'Save' : 'Edit'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <p className="text-sm text-gray-600">{profile?.name}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-sm text-gray-600">{profile?.email}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Specialties</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile?.specialties?.map((specialty: string) => (
                  <Badge key={specialty} variant="secondary">{specialty}</Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Bio</label>
              {isEditing ? (
                <Textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-gray-600 mt-1">{profile?.bio}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Hourly Rate</label>
              {isEditing ? (
                <Input
                  type="number"
                  value={editForm.hourlyRate}
                  onChange={(e) => setEditForm({ ...editForm, hourlyRate: parseFloat(e.target.value) })}
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-gray-600 mt-1">{formatCurrency(profile?.hourlyRate || 0)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Earnings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {earnings?.transactions?.map((transaction: any) => (
                <div key={transaction.orderId} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Order #{transaction.orderId}</p>
                    <p className="text-sm text-gray-600">{transaction.serviceType}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(transaction.completedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-600">
                      +{formatCurrency(transaction.agentCommission)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Order: {formatCurrency(transaction.orderAmount)}
                    </p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500">No recent earnings</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button 
              className="justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/ai-marketplace'}
            >
              <Package className="w-4 h-4 mr-2" />
              View Marketplace
            </Button>
            
            <Button 
              className="justify-start" 
              variant="outline"
              onClick={() => window.location.href = '/order-management'}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Manage Orders
            </Button>
            
            <Button 
              className="justify-start" 
              variant="outline"
              onClick={() => {
                toast({
                  title: "Coming Soon",
                  description: "Service creation will be available soon",
                });
              }}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Create Service
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}