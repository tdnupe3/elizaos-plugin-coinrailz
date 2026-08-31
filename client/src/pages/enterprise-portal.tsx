import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, TrendingUp, Shield, Globe, 
  Users, DollarSign, BarChart3, Settings,
  FileText, Download, Upload, ChevronRight,
  Lock, CheckCircle, AlertCircle, Clock
} from "@/lib/icons";

interface EnterpriseStats {
  totalVolume: number;
  monthlyVolume: number;
  totalTransactions: number;
  activeUsers: number;
  averageTransactionSize: number;
  feesSaved: number;
  complianceScore: number;
}

export default function EnterprisePortal() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: enterpriseStats, isLoading: statsLoading } = useQuery<EnterpriseStats>({
    queryKey: ['/api/enterprise/stats'],
    enabled: isAuthenticated,
  });

  const stats: EnterpriseStats = enterpriseStats || {
    totalVolume: 0,
    monthlyVolume: 0,
    totalTransactions: 0,
    activeUsers: 0,
    averageTransactionSize: 0,
    feesSaved: 0,
    complianceScore: 95
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">Enterprise Access Required</h2>
            <p className="text-gray-600 mb-4">
              Please sign in with your enterprise account to access the portal.
            </p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Enterprise Portal</h1>
              <p className="text-gray-600">Advanced financial infrastructure for institutional clients</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-800">
                Enterprise Client
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="api">API Access</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Volume</p>
                      <p className="text-2xl font-bold text-blue-600">${stats.totalVolume.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Monthly Volume</p>
                      <p className="text-2xl font-bold text-green-600">${stats.monthlyVolume.toLocaleString()}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-purple-600">{stats.activeUsers.toLocaleString()}</p>
                    </div>
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Fees Saved</p>
                      <p className="text-2xl font-bold text-orange-600">${stats.feesSaved.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enterprise Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Global Payment Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Cross-border payments</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Multi-currency support</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Real-time settlement</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">FX rate optimization</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <Button className="w-full">
                    Configure Payment Routes
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Compliance & Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">AML/KYC automation</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Transaction monitoring</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Regulatory reporting</span>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Risk assessment</span>
                      <Badge className="bg-green-100 text-green-800">{stats.complianceScore}%</Badge>
                    </div>
                  </div>
                  <Button className="w-full" variant="outline">
                    View Compliance Dashboard
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto p-4 justify-between">
                    <div className="text-left">
                      <p className="font-medium">Bulk Payments</p>
                      <p className="text-xs text-gray-600">Process multiple payments</p>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  
                  <Button variant="outline" className="h-auto p-4 justify-between">
                    <div className="text-left">
                      <p className="font-medium">API Keys</p>
                      <p className="text-xs text-gray-600">Manage integrations</p>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  
                  <Button variant="outline" className="h-auto p-4 justify-between">
                    <div className="text-left">
                      <p className="font-medium">Reports</p>
                      <p className="text-xs text-gray-600">Download analytics</p>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-medium text-blue-900">Average Transaction Size</h3>
                      <p className="text-2xl font-bold text-blue-600">${stats.averageTransactionSize.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-medium text-green-900">Success Rate</h3>
                      <p className="text-2xl font-bold text-green-600">99.7%</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-medium text-purple-900">Settlement Time</h3>
                      <p className="text-2xl font-bold text-purple-600">2.3s</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center py-16 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Advanced analytics charts would be rendered here</p>
                      <p className="text-sm text-gray-500">Real-time transaction volume, geographic distribution, and trend analysis</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Compliance Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">AML Compliance</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">KYC Verification</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">FATF Travel Rule</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">Monitoring</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">PCI DSS</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Certified</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance Reports</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Monthly AML Report</p>
                        <p className="text-sm text-gray-600">December 2024</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Transaction Monitoring</p>
                        <p className="text-sm text-gray-600">Last 30 days</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Risk Assessment</p>
                        <p className="text-sm text-gray-600">Quarterly report</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                  
                  <Button className="w-full" variant="outline">
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Compliance Document
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* API Access Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  API Keys & Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-medium text-yellow-800">Secure API Access</h3>
                  </div>
                  <p className="text-sm text-yellow-700">
                    API keys provide access to your enterprise account. Keep them secure and rotate them regularly.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Production API Key</h3>
                    <div className="p-3 bg-gray-100 rounded-lg font-mono text-sm">
                      pk_live_••••••••••••••••••••••••••••
                    </div>
                    <Button size="sm" variant="outline">Regenerate Key</Button>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-medium">Sandbox API Key</h3>
                    <div className="p-3 bg-gray-100 rounded-lg font-mono text-sm">
                      pk_test_••••••••••••••••••••••••••••
                    </div>
                    <Button size="sm" variant="outline">Regenerate Key</Button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">API Documentation</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" className="h-auto p-4 justify-between">
                      <div className="text-left">
                        <p className="font-medium">Payment API</p>
                        <p className="text-xs text-gray-600">Process payments</p>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    
                    <Button variant="outline" className="h-auto p-4 justify-between">
                      <div className="text-left">
                        <p className="font-medium">Wallet API</p>
                        <p className="text-xs text-gray-600">Manage wallets</p>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    
                    <Button variant="outline" className="h-auto p-4 justify-between">
                      <div className="text-left">
                        <p className="font-medium">Webhooks</p>
                        <p className="text-xs text-gray-600">Event notifications</p>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Enterprise Support</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">24/7 priority support</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Dedicated account manager</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Integration assistance</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">Custom development</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-3">Emergency Support Hotline:</p>
                    <p className="font-mono text-lg">+1 (555) 123-COIN</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact Support</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" placeholder="Brief description of your issue" />
                    </div>
                    
                    <div>
                      <Label htmlFor="priority">Priority Level</Label>
                      <select className="w-full p-2 border border-gray-300 rounded-md">
                        <option>Low - General inquiry</option>
                        <option>Medium - Integration support</option>
                        <option>High - Service disruption</option>
                        <option>Critical - Emergency</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea 
                        id="message" 
                        placeholder="Describe your issue in detail..."
                        rows={4}
                      />
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    Submit Support Request
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}