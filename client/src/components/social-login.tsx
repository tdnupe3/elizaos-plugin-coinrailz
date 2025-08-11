import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Chrome, 
  Github, 
  Mail, 
  Phone, 
  Shield, 
  Users, 
  Zap,
  CheckCircle,
  AlertCircle,
  Settings
} from "@/lib/icons";

interface SocialProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'active' | 'inactive' | 'pending';
  users: number;
  conversionRate: number;
}

export default function SocialLoginPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const socialProviders: SocialProvider[] = [
    {
      id: 'google',
      name: 'Google',
      icon: <Chrome className="w-5 h-5" />,
      status: 'inactive',
      users: 0,
      conversionRate: 0
    },
    {
      id: 'github',
      name: 'GitHub', 
      icon: <Github className="w-5 h-5" />,
      status: 'active',
      users: 892,
      conversionRate: 65.2
    },
    {
      id: 'email',
      name: 'Email/Password',
      icon: <Mail className="w-5 h-5" />,
      status: 'active',
      users: 2156,
      conversionRate: 45.8
    },
    {
      id: 'phone',
      name: 'Phone/SMS',
      icon: <Phone className="w-5 h-5" />,
      status: 'pending',
      users: 0,
      conversionRate: 0
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'inactive':
        return <Badge className="bg-red-100 text-red-800">Inactive</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const totalUsers = socialProviders.reduce((sum, provider) => sum + provider.users, 0);
  const avgConversionRate = socialProviders
    .filter(p => p.users > 0)
    .reduce((sum, provider) => sum + provider.conversionRate, 0) / 
    socialProviders.filter(p => p.users > 0).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Social Authentication</h1>
              <p className="text-gray-600">Manage social login providers and user authentication flow</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-800">
                <Users className="w-4 h-4 mr-1" />
                {totalUsers} Total Users
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Configure
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Sign-ups</p>
                      <p className="text-2xl font-bold text-blue-600">{totalUsers.toLocaleString()}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Avg. Conversion</p>
                      <p className="text-2xl font-bold text-green-600">{avgConversionRate.toFixed(1)}%</p>
                    </div>
                    <Zap className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Providers</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {socialProviders.filter(p => p.status === 'active').length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Security Score</p>
                      <p className="text-2xl font-bold text-orange-600">98.5%</p>
                    </div>
                    <Shield className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Provider Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Authentication Providers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {socialProviders.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {provider.icon}
                        </div>
                        <div>
                          <h3 className="font-medium">{provider.name}</h3>
                          <p className="text-sm text-gray-600">{provider.users.toLocaleString()} users</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{provider.conversionRate}%</p>
                          <p className="text-xs text-gray-500">conversion rate</p>
                        </div>
                        {getStatusBadge(provider.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Providers Tab */}
          <TabsContent value="providers" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {socialProviders.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          {provider.icon}
                        </div>
                        <CardTitle>{provider.name}</CardTitle>
                      </div>
                      {getStatusBadge(provider.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Users</p>
                        <p className="text-xl font-bold">{provider.users.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Conversion</p>
                        <p className="text-xl font-bold">{provider.conversionRate}%</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        variant={provider.status === 'active' ? 'outline' : 'default'} 
                        className="w-full"
                        disabled={provider.status === 'pending'}
                      >
                        {provider.status === 'active' ? 'Configure' : 
                         provider.status === 'pending' ? 'Setting Up...' : 'Enable'}
                      </Button>
                      
                      {provider.status === 'active' && (
                        <Button variant="outline" className="w-full" size="sm">
                          View Analytics
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sign-up Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-16 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Sign-up trend chart would be rendered here</p>
                      <p className="text-sm text-gray-500">Shows daily/weekly sign-up patterns by provider</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="font-medium">Started Sign-up</span>
                      <Badge className="bg-blue-100 text-blue-800">100%</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="font-medium">Completed Auth</span>
                      <Badge className="bg-green-100 text-green-800">87.2%</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <span className="font-medium">Verified Account</span>
                      <Badge className="bg-yellow-100 text-yellow-800">72.8%</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <span className="font-medium">First Transaction</span>
                      <Badge className="bg-purple-100 text-purple-800">61.5%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium">Two-Factor Authentication</h3>
                    <p className="text-sm text-gray-600">Require 2FA for all social logins</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium">Email Verification</h3>
                    <p className="text-sm text-gray-600">Require email verification for new accounts</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Required</Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h3 className="font-medium">Rate Limiting</h3>
                    <p className="text-sm text-gray-600">Limit login attempts per IP address</p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">5 attempts/hour</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provider Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Chrome className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <h3 className="font-medium">Configure Google</h3>
                      <p className="text-sm text-gray-600">OAuth 2.0 settings</p>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Github className="w-8 h-8 mx-auto mb-2 text-gray-800" />
                      <h3 className="font-medium">Configure GitHub</h3>
                      <p className="text-sm text-gray-600">App credentials</p>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Mail className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-medium">Email Settings</h3>
                      <p className="text-sm text-gray-600">SMTP configuration</p>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="p-6 h-auto">
                    <div className="text-center">
                      <Phone className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-medium">SMS Provider</h3>
                      <p className="text-sm text-gray-600">Twilio integration</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}