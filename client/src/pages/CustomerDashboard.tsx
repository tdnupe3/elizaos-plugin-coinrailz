/**
 * CUSTOMER DASHBOARD - $2K-$200K Enterprise License Management
 * Self-service portal for SDK customers
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Download, 
  CreditCard, 
  BarChart3, 
  Key, 
  Settings, 
  DollarSign, 
  TrendingUp,
  Activity,
  Users,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface LicenseInfo {
  id: number;
  licenseKey: string;
  companyName: string;
  tier: string;
  status: string;
  billingCycle: string;
  expiresAt: string;
  monthlyVolumeLimit: number;
  monthlyVolumeUsed: number;
  featuresEnabled: string[];
  price: string;
}

interface UsageMetrics {
  payments: {
    totalVolume: number;
    monthlyVolume: number;
    transactionCount: number;
    successRate: number;
  };
  agents: {
    totalAgents: number;
    activeAgents: number;
    totalCalls: number;
  };
  compliance: {
    totalChecks: number;
    flaggedTransactions: number;
    complianceScore: number;
  };
}

export default function CustomerDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch customer license info
  const { data: licenseInfo, isLoading: licenseLoading } = useQuery<{ license: LicenseInfo }>({
    queryKey: ['/api/sdk/customer/license'],
    enabled: true
  });

  // Fetch usage metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<{ metrics: UsageMetrics }>({
    queryKey: ['/api/sdk/customer/metrics'],
    enabled: true
  });

  const license = licenseInfo?.license as LicenseInfo | undefined;
  const usage = metrics?.metrics as UsageMetrics | undefined;

  if (licenseLoading || !license) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const volumeUsagePercentage = (license.monthlyVolumeUsed / license.monthlyVolumeLimit) * 100;
  const daysUntilRenewal = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SDK Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your CoinRailz AI Payments SDK license
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge 
                variant={license.status === 'active' ? 'default' : 'destructive'}
                className="text-sm"
                data-testid="status-badge"
              >
                {license.status.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-sm" data-testid="tier-badge">
                {license.tier} Tier
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Volume</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="monthly-volume">
                    {formatCurrency(license.monthlyVolumeUsed)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="success-rate">
                    {usage?.payments.successRate || 100}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Agents</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="active-agents">
                    {usage?.agents.activeAgents || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Days to Renewal</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="days-renewal">
                    {daysUntilRenewal}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Volume Usage Alert */}
        {volumeUsagePercentage > 80 && (
          <Card className="mb-8 border-orange-200 bg-orange-50 dark:bg-orange-900/20">
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mr-3" />
                <div>
                  <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                    Volume Limit Warning
                  </h3>
                  <p className="text-orange-700 dark:text-orange-300">
                    You've used {volumeUsagePercentage.toFixed(1)}% of your monthly volume limit. 
                    Consider upgrading your plan to avoid service interruption.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="usage" data-testid="tab-usage">Usage</TabsTrigger>
            <TabsTrigger value="downloads" data-testid="tab-downloads">Downloads</TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">Billing</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* License Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Key className="h-5 w-5 mr-2" />
                    License Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">License Key</label>
                    <div className="mt-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-md font-mono text-sm">
                      {license.licenseKey}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{license.companyName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Billing</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(parseFloat(license.price))} / {license.billingCycle}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Volume Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="h-5 w-5 mr-2" />
                    Volume Usage
                  </CardTitle>
                  <CardDescription>
                    Monthly payment processing volume
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>{formatCurrency(license.monthlyVolumeUsed)} used</span>
                      <span>{formatCurrency(license.monthlyVolumeLimit)} limit</span>
                    </div>
                    <Progress value={volumeUsagePercentage} className="h-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(100 - volumeUsagePercentage).toFixed(1)}% remaining this month
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Enabled Features</CardTitle>
                <CardDescription>
                  Features available in your {license.tier} tier license
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {license.featuresEnabled.map((feature) => (
                    <Badge key={feature} variant="secondary" className="justify-center p-2">
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Volume</span>
                    <span className="font-semibold">{formatCurrency(usage?.payments.totalVolume || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Transactions</span>
                    <span className="font-semibold">{usage?.payments.transactionCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
                    <span className="font-semibold">{usage?.payments.successRate || 100}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Agent Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Agents</span>
                    <span className="font-semibold">{usage?.agents.totalAgents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Active Agents</span>
                    <span className="font-semibold">{usage?.agents.activeAgents || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Calls</span>
                    <span className="font-semibold">{usage?.agents.totalCalls || 0}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Compliance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Checks</span>
                    <span className="font-semibold">{usage?.compliance.totalChecks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Flagged</span>
                    <span className="font-semibold">{usage?.compliance.flaggedTransactions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Compliance Score</span>
                    <span className="font-semibold">{usage?.compliance.complianceScore || 95}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Downloads Tab */}
          <TabsContent value="downloads" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  SDK Downloads
                </CardTitle>
                <CardDescription>
                  Download SDK packages and documentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    className="h-auto p-4 justify-start" 
                    variant="outline"
                    data-testid="download-typescript-sdk"
                  >
                    <div className="text-left">
                      <div className="font-semibold">TypeScript SDK</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">npm package with full typing</div>
                    </div>
                  </Button>
                  
                  <Button 
                    className="h-auto p-4 justify-start" 
                    variant="outline"
                    data-testid="download-python-sdk"
                  >
                    <div className="text-left">
                      <div className="font-semibold">Python SDK</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">pip package for Python apps</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-auto p-4 justify-start" 
                    variant="outline"
                    data-testid="download-documentation"
                  >
                    <div className="text-left">
                      <div className="font-semibold">API Documentation</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Complete API reference</div>
                    </div>
                  </Button>

                  <Button 
                    className="h-auto p-4 justify-start" 
                    variant="outline"
                    data-testid="download-examples"
                  >
                    <div className="text-left">
                      <div className="font-semibold">Code Examples</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Integration examples & tutorials</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Billing Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">Current Plan</h3>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="font-semibold text-blue-900 dark:text-blue-100">{license.tier} Tier</div>
                      <div className="text-blue-700 dark:text-blue-300">
                        {formatCurrency(parseFloat(license.price))} / {license.billingCycle}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Next Billing Date</h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="font-semibold">{new Date(license.expiresAt).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {daysUntilRenewal} days remaining
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button data-testid="button-upgrade-plan">Upgrade Plan</Button>
                  <Button variant="outline" data-testid="button-payment-methods">Manage Payment Methods</Button>
                  <Button variant="outline" data-testid="button-billing-history">Billing History</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2">API Settings</h3>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" data-testid="button-regenerate-key">
                        Regenerate License Key
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-webhook-settings">
                        Webhook Settings
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Account Management</h3>
                    <div className="space-y-2">
                      <Button variant="outline" size="sm" data-testid="button-update-company">
                        Update Company Info
                      </Button>
                      <Button variant="outline" size="sm" data-testid="button-team-management">
                        Team Management
                      </Button>
                    </div>
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