import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Users, Target, Mail, Phone, Globe, Building, TrendingUp, 
  Send, CheckCircle, Clock, AlertCircle, DollarSign,
  Search, Filter, Download, ArrowRight, Zap, Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OutreachCampaign {
  id: string;
  name: string;
  targetMarket: 'ai_companies' | 'fintech_startups' | 'payment_processors' | 'enterprise_saas';
  status: 'draft' | 'active' | 'paused' | 'completed';
  targetCount: number;
  contacted: number;
  responses: number;
  qualified: number;
  conversions: number;
  revenue: number;
  createdAt: string;
  lastActivity: string;
}

interface OutreachTarget {
  id: string;
  companyName: string;
  domain: string;
  industry: string;
  employeeCount: string;
  revenue: string;
  contactEmail: string;
  contactName: string;
  contactTitle: string;
  linkedinUrl?: string;
  phoneNumber?: string;
  companyDescription: string;
  useCase: string;
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'converted';
  lastContactDate?: string;
  nextFollowUp?: string;
  notes: string;
}

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  targetMarket: z.enum(['ai_companies', 'fintech_startups', 'payment_processors', 'enterprise_saas']),
  targetCount: z.number().min(10, 'Minimum 10 targets required'),
  emailTemplate: z.string().min(50, 'Email template must be at least 50 characters'),
  followUpTemplate: z.string().min(30, 'Follow-up template must be at least 30 characters'),
  targetCriteria: z.object({
    minEmployees: z.number().optional(),
    maxEmployees: z.number().optional(),
    minRevenue: z.number().optional(),
    industries: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
  }),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

export default function EnterpriseOutreach() {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { toast } = useToast();

  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      targetMarket: 'ai_companies',
      targetCount: 1000,
      targetCriteria: {
        minEmployees: 10,
        maxEmployees: 1000,
        minRevenue: 1000000,
        industries: ['AI/ML', 'Fintech', 'SaaS'],
        regions: ['North America', 'Europe']
      }
    }
  });

  useEffect(() => {
    fetchCampaigns();
    fetchTargets();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/enterprise-outreach/campaigns');
      const data = await response.json();
      if (data.success) {
        setCampaigns(data.campaigns);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  const fetchTargets = async () => {
    try {
      const response = await fetch('/api/enterprise-outreach/targets');
      const data = await response.json();
      if (data.success) {
        setTargets(data.targets);
      }
    } catch (error) {
      console.error('Failed to fetch targets:', error);
    }
  };

  const createCampaign = async (data: CampaignFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/enterprise-outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Campaign Created!',
          description: `Created outreach campaign targeting ${data.targetCount} ${data.targetMarket.replace('_', ' ')}`,
        });
        fetchCampaigns();
        form.reset();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create campaign',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startLeadGeneration = async (campaignId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/enterprise-outreach/campaigns/${campaignId}/generate-leads`, {
        method: 'POST',
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Lead Generation Started!',
          description: `Generating ${result.expectedTargets} potential customers from AI companies, fintech startups, and payment processors`,
        });
        fetchTargets();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start lead generation',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getMarketIcon = (market: string) => {
    switch (market) {
      case 'ai_companies': return <Zap className="h-4 w-4" />;
      case 'fintech_startups': return <TrendingUp className="h-4 w-4" />;
      case 'payment_processors': return <DollarSign className="h-4 w-4" />;
      case 'enterprise_saas': return <Building className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-main">
            Enterprise Outreach System
          </h1>
          <p className="text-gray-600 dark:text-gray-400" data-testid="text-description">
            Target the $50+ billion AI payments market with systematic enterprise outreach
          </p>
        </div>

        {/* Main Stats Dashboard */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="stat-total-targets">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Targets</p>
                  <p className="text-2xl font-bold">{targets.length.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="stat-active-campaigns">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Active Campaigns</p>
                  <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'active').length}</p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-response-rate">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Response Rate</p>
                  <p className="text-2xl font-bold">
                    {campaigns.length > 0 
                      ? ((campaigns.reduce((acc, c) => acc + c.responses, 0) / campaigns.reduce((acc, c) => acc + c.contacted, 0)) * 100).toFixed(1)
                      : '0.0'
                    }%
                  </p>
                </div>
                <Mail className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-potential-revenue">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Potential Revenue</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(campaigns.reduce((acc, c) => acc + c.revenue, 0))}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outreach Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-list">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="targets">Target Companies</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Active Campaigns */}
              <Card data-testid="card-active-campaigns">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="mr-2 h-5 w-5" />
                    Active Campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {campaigns.filter(c => c.status === 'active').length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No active campaigns</p>
                      <Button size="sm" className="mt-2" onClick={() => setActiveTab('campaigns')}>
                        Create Campaign
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.filter(c => c.status === 'active').slice(0, 3).map((campaign) => (
                        <div key={campaign.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getMarketIcon(campaign.targetMarket)}
                              <span className="font-semibold">{campaign.name}</span>
                            </div>
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Target: {campaign.targetMarket.replace('_', ' ')}
                          </div>
                          <Progress 
                            value={(campaign.contacted / campaign.targetCount) * 100} 
                            className="mb-2"
                          />
                          <div className="flex justify-between text-sm">
                            <span>{campaign.contacted}/{campaign.targetCount} contacted</span>
                            <span>{campaign.responses} responses</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card data-testid="card-quick-actions">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="mr-2 h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    className="w-full" 
                    onClick={() => setActiveTab('campaigns')}
                    data-testid="button-create-campaign"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Create New Campaign
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => startLeadGeneration('auto')}
                    disabled={isLoading}
                    data-testid="button-generate-leads"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    {isLoading ? 'Generating...' : 'Generate AI Company Leads'}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab('targets')}
                    data-testid="button-view-targets"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    View Target Companies
                  </Button>
                  
                  <Separator />
                  
                  <div className="text-center">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Target Market Size
                    </div>
                    <div className="text-2xl font-bold text-green-600">$50+ Billion</div>
                    <div className="text-xs text-gray-500">AI Payments Market</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Market Breakdown */}
            <Card data-testid="card-market-breakdown">
              <CardHeader>
                <CardTitle>Target Market Breakdown</CardTitle>
                <CardDescription>
                  Systematic outreach across high-value enterprise segments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold">AI Companies</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Model payments, API billing, usage-based pricing
                    </div>
                    <div className="text-lg font-bold text-blue-600">2,500+ targets</div>
                    <div className="text-xs text-blue-500">Avg. deal: $25K-$100K</div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="font-semibold">Fintech Startups</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      P2P transfers, crypto onramps, DeFi integrations
                    </div>
                    <div className="text-lg font-bold text-green-600">1,800+ targets</div>
                    <div className="text-xs text-green-500">Avg. deal: $8K-$50K</div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold">Payment Processors</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      White-label solutions, enterprise partnerships
                    </div>
                    <div className="text-lg font-bold text-purple-600">500+ targets</div>
                    <div className="text-xs text-purple-500">Avg. deal: $100K-$500K</div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building className="h-5 w-5 text-orange-600" />
                      <span className="font-semibold">Enterprise SaaS</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      B2B payments, invoicing, subscription billing
                    </div>
                    <div className="text-lg font-bold text-orange-600">3,200+ targets</div>
                    <div className="text-xs text-orange-500">Avg. deal: $15K-$75K</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Create Campaign Form */}
              <Card data-testid="card-create-campaign">
                <CardHeader>
                  <CardTitle>Create Outreach Campaign</CardTitle>
                  <CardDescription>
                    Target enterprise customers for SDK licensing deals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={form.handleSubmit(createCampaign)} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input
                        id="name"
                        {...form.register('name')}
                        placeholder="AI Companies Q1 2025"
                        data-testid="input-campaign-name"
                      />
                      {form.formState.errors.name && (
                        <p className="text-sm text-red-600">{form.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="targetMarket">Target Market</Label>
                      <Select 
                        value={form.watch('targetMarket')} 
                        onValueChange={(value) => form.setValue('targetMarket', value as any)}
                      >
                        <SelectTrigger data-testid="select-target-market">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai_companies">AI Companies</SelectItem>
                          <SelectItem value="fintech_startups">Fintech Startups</SelectItem>
                          <SelectItem value="payment_processors">Payment Processors</SelectItem>
                          <SelectItem value="enterprise_saas">Enterprise SaaS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="targetCount">Target Count</Label>
                      <Input
                        id="targetCount"
                        type="number"
                        {...form.register('targetCount', { valueAsNumber: true })}
                        placeholder="1000"
                        data-testid="input-target-count"
                      />
                    </div>

                    <div>
                      <Label htmlFor="emailTemplate">Email Template</Label>
                      <Textarea
                        id="emailTemplate"
                        {...form.register('emailTemplate')}
                        placeholder="Hi {{firstName}}, I noticed {{companyName}} is working on {{useCase}}. Our SDK offers 83% savings vs Stripe..."
                        rows={4}
                        data-testid="textarea-email-template"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-create-campaign-submit">
                      {isLoading ? 'Creating...' : 'Create Campaign'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Existing Campaigns */}
              <Card data-testid="card-existing-campaigns">
                <CardHeader>
                  <CardTitle>Existing Campaigns</CardTitle>
                  <CardDescription>
                    Manage your active enterprise outreach campaigns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-2">No campaigns yet</p>
                      <p className="text-sm text-gray-400">Create your first enterprise outreach campaign</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campaigns.map((campaign) => (
                        <div key={campaign.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getMarketIcon(campaign.targetMarket)}
                              <span className="font-semibold">{campaign.name}</span>
                            </div>
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Contacted:</span>
                              <span className="ml-1 font-medium">{campaign.contacted}/{campaign.targetCount}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Responses:</span>
                              <span className="ml-1 font-medium">{campaign.responses}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Qualified:</span>
                              <span className="ml-1 font-medium">{campaign.qualified}</span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">Revenue:</span>
                              <span className="ml-1 font-medium text-green-600">{formatCurrency(campaign.revenue)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-3">
                            <Button size="sm" variant="outline">
                              <Mail className="mr-1 h-3 w-3" />
                              Email
                            </Button>
                            <Button size="sm" variant="outline">
                              <Phone className="mr-1 h-3 w-3" />
                              Call
                            </Button>
                            <Button size="sm" variant="outline">
                              <Globe className="mr-1 h-3 w-3" />
                              LinkedIn
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Target Companies Tab */}
          <TabsContent value="targets" className="space-y-6">
            <Card data-testid="card-target-companies">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="mr-2 h-5 w-5" />
                    Target Companies ({targets.length.toLocaleString()})
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {targets.length === 0 ? (
                  <div className="text-center py-12">
                    <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Target Companies Yet</h3>
                    <p className="text-gray-500 mb-4">
                      Generate leads from AI companies, fintech startups, and payment processors
                    </p>
                    <Button onClick={() => startLeadGeneration('auto')} disabled={isLoading}>
                      <Search className="mr-2 h-4 w-4" />
                      {isLoading ? 'Generating...' : 'Generate Leads'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {targets.slice(0, 10).map((target) => (
                      <div key={target.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{target.companyName}</h4>
                              <Badge variant="outline">{target.industry}</Badge>
                              <Badge className={
                                target.priority === 'high' ? 'bg-red-100 text-red-800' :
                                target.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }>
                                {target.priority} priority
                              </Badge>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Contact:</span>
                                <span className="ml-1">{target.contactName} ({target.contactTitle})</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Size:</span>
                                <span className="ml-1">{target.employeeCount} employees</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Revenue:</span>
                                <span className="ml-1">{target.revenue}</span>
                              </div>
                              <div>
                                <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                <Badge className="ml-1" variant="outline">{target.status}</Badge>
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              <strong>Use Case:</strong> {target.useCase}
                            </p>
                          </div>
                          
                          <div className="flex flex-col gap-2 ml-4">
                            <Button size="sm">
                              <Mail className="mr-1 h-3 w-3" />
                              Contact
                            </Button>
                            <Button size="sm" variant="outline">
                              <Star className="mr-1 h-3 w-3" />
                              Priority
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {targets.length > 10 && (
                      <div className="text-center">
                        <Button variant="outline">
                          Load More ({targets.length - 10} remaining)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card data-testid="card-conversion-funnel">
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                  <CardDescription>
                    Track enterprise leads through the sales pipeline
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Total Targets</span>
                      <span className="font-semibold">{targets.length.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contacted</span>
                      <span className="font-semibold">
                        {campaigns.reduce((acc, c) => acc + c.contacted, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Responded</span>
                      <span className="font-semibold">
                        {campaigns.reduce((acc, c) => acc + c.responses, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Qualified</span>
                      <span className="font-semibold">
                        {campaigns.reduce((acc, c) => acc + c.qualified, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Converted</span>
                      <span className="font-semibold text-green-600">
                        {campaigns.reduce((acc, c) => acc + c.conversions, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-revenue-projections">
                <CardHeader>
                  <CardTitle>Revenue Projections</CardTitle>
                  <CardDescription>
                    Potential revenue from enterprise SDK licensing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Current Revenue</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(campaigns.reduce((acc, c) => acc + c.revenue, 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pipeline Value</span>
                      <span className="font-semibold">
                        {formatCurrency(targets.filter(t => t.status === 'qualified').length * 50000)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>12-Month Projection</span>
                      <span className="font-semibold text-blue-600">
                        {formatCurrency(1500000)} {/* Based on conversion rates */}
                      </span>
                    </div>
                    <Separator />
                    <div className="text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Target: $1M+ Emergency Funding
                      </div>
                      <Progress value={((campaigns.reduce((acc, c) => acc + c.revenue, 0) / 1000000) * 100)} className="mb-2" />
                      <div className="text-xs text-gray-500">
                        {((campaigns.reduce((acc, c) => acc + c.revenue, 0) / 1000000) * 100).toFixed(1)}% of goal
                      </div>
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