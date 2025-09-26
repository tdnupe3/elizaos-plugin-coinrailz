import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Shield, Upload, CheckCircle, AlertTriangle, FileText, Download, CreditCard, Wallet, DollarSign } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';

interface AuditSubmission {
  projectName: string;
  contractType: string;
  blockchain: string;
  contractAddress?: string;
  contractCode?: string;
}

interface AuditResult {
  id: string;
  projectName: string;
  grade: 'A' | 'B' | 'F';
  score: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  auditReport?: any;
  vulnerabilities?: any[];
  recommendations?: any[];
  gasOptimizations?: any[];
  certificateUrl?: string;
  auditCompletedAt?: string;
  submittedAt: string;
}

export default function SmartContractAudit() {
  const [activeTab, setActiveTab] = useState('submit');
  const [auditInProgress, setAuditInProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<AuditSubmission>({
    defaultValues: {
      projectName: '',
      contractType: 'token',
      blockchain: 'ethereum',
      contractAddress: '',
      contractCode: ''
    }
  });

  // Get pricing information
  const { data: pricingData } = useQuery({
    queryKey: ['/api/audits/pricing'],
    enabled: true,
  });

  // Get user's audit history
  const { data: userAudits, refetch: refetchAudits } = useQuery<{ audits: AuditResult[] }>({
    queryKey: ['/api/audits/my-audits'],
    enabled: true,
  });

  // Submit audit mutation
  const submitAuditMutation = useMutation({
    mutationFn: (data: AuditSubmission) => 
      apiRequest('/api/audits/submit', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (data) => {
      toast({
        title: 'Audit Submitted Successfully!',
        description: `Your audit request ${data.audit.certificateId} has been submitted. Please proceed with payment.`,
      });
      setAuditInProgress(data.audit.id);
      setActiveTab('payment');
      queryClient.invalidateQueries({ queryKey: ['/api/audits/my-audits'] });
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: 'Failed to submit audit request. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: (data: { auditId: string; paymentMethod: string }) => 
      apiRequest('/api/audits/confirm-payment', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      toast({
        title: 'Payment Confirmed!',
        description: 'Your audit is now being processed. You will be notified when complete.',
      });
      setActiveTab('status');
      refetchAudits();
    }
  });

  const onSubmitAudit = (data: AuditSubmission) => {
    submitAuditMutation.mutate(data);
  };

  const handlePayment = (paymentMethod: string) => {
    if (!auditInProgress) return;
    
    // In a real implementation, this would integrate with actual payment processors
    confirmPaymentMutation.mutate({
      auditId: auditInProgress,
      paymentMethod
    });
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-yellow-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'pending': return 0;
      case 'in_progress': return 50;
      case 'completed': return 100;
      default: return 0;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold">Smart Contract Audit</h1>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Professional AI-powered smart contract security analysis
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center justify-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <strong>$1,000</strong> per audit
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                <strong>24-hour</strong> delivery
              </span>
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <strong>Professional</strong> certificates
              </span>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="submit">Submit Audit</TabsTrigger>
            <TabsTrigger value="payment" disabled={!auditInProgress}>Payment</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Submit Audit Tab */}
          <TabsContent value="submit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Submit Contract for Audit
                </CardTitle>
                <CardDescription>
                  Upload your smart contract code or provide the contract address for comprehensive security analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmitAudit)} className="space-y-6">
                  {/* Project Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="projectName">Project Name</Label>
                      <Input
                        id="projectName"
                        {...register('projectName', { required: 'Project name is required' })}
                        placeholder="My DeFi Protocol"
                        data-testid="input-project-name"
                      />
                      {errors.projectName && (
                        <p className="text-red-500 text-sm mt-1">{errors.projectName.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="contractType">Contract Type</Label>
                      <Select onValueChange={(value) => setValue('contractType', value)} defaultValue="token">
                        <SelectTrigger data-testid="select-contract-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="token">Token Contract</SelectItem>
                          <SelectItem value="dapp">DApp Contract</SelectItem>
                          <SelectItem value="nft">NFT Contract</SelectItem>
                          <SelectItem value="defi">DeFi Protocol</SelectItem>
                          <SelectItem value="game">Gaming Contract</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="blockchain">Blockchain</Label>
                      <Select onValueChange={(value) => setValue('blockchain', value)} defaultValue="ethereum">
                        <SelectTrigger data-testid="select-blockchain">
                          <SelectValue placeholder="Select blockchain" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ethereum">Ethereum</SelectItem>
                          <SelectItem value="base">Base</SelectItem>
                          <SelectItem value="polygon">Polygon</SelectItem>
                          <SelectItem value="bsc">BSC</SelectItem>
                          <SelectItem value="arbitrum">Arbitrum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Contract Input Options */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Contract Information</Label>
                    <Tabs defaultValue="address" className="w-full">
                      <TabsList>
                        <TabsTrigger value="address">Contract Address</TabsTrigger>
                        <TabsTrigger value="code">Paste Code</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="address">
                        <div>
                          <Label htmlFor="contractAddress">Contract Address</Label>
                          <Input
                            id="contractAddress"
                            {...register('contractAddress')}
                            placeholder="0x..."
                            data-testid="input-contract-address"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Enter the deployed contract address for on-chain analysis
                          </p>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="code">
                        <div>
                          <Label htmlFor="contractCode">Contract Source Code</Label>
                          <Textarea
                            id="contractCode"
                            {...register('contractCode')}
                            placeholder="pragma solidity ^0.8.0;..."
                            className="min-h-[200px] font-mono text-sm"
                            data-testid="textarea-contract-code"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Paste your complete Solidity contract code for analysis
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg"
                    disabled={submitAuditMutation.isPending}
                    data-testid="button-submit-audit"
                  >
                    {submitAuditMutation.isPending ? 'Submitting...' : 'Submit for Audit - $1,000'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Grading System Info */}
            <Card>
              <CardHeader>
                <CardTitle>Grading System</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-500 text-white">A</Badge>
                    <div>
                      <p className="font-semibold">80-100%</p>
                      <p className="text-sm text-gray-600">Excellent - Ready for production</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-yellow-500 text-white">B</Badge>
                    <div>
                      <p className="font-semibold">70-79%</p>
                      <p className="text-sm text-gray-600">Good - Needs remediation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-red-500 text-white">F</Badge>
                    <div>
                      <p className="font-semibold">&lt;70%</p>
                      <p className="text-sm text-gray-600">Failing - Major improvements required</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Options
                </CardTitle>
                <CardDescription>
                  Choose your preferred payment method to start the audit process.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handlePayment('stripe')}
                    disabled={confirmPaymentMutation.isPending}
                    data-testid="button-payment-stripe"
                  >
                    <CreditCard className="h-6 w-6" />
                    Credit/Debit Card
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handlePayment('paypal')}
                    disabled={confirmPaymentMutation.isPending}
                    data-testid="button-payment-paypal"
                  >
                    <DollarSign className="h-6 w-6" />
                    PayPal
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handlePayment('circle_usdc')}
                    disabled={confirmPaymentMutation.isPending}
                    data-testid="button-payment-usdc"
                  >
                    <Wallet className="h-6 w-6" />
                    USDC
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    onClick={() => handlePayment('crypto')}
                    disabled={confirmPaymentMutation.isPending}
                    data-testid="button-payment-crypto"
                  >
                    <Shield className="h-6 w-6" />
                    Cryptocurrency
                  </Button>
                </div>
                
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-center">
                    <strong>Secure Payment:</strong> All payments are processed securely. 
                    Your audit will begin immediately after payment confirmation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Status</CardTitle>
                <CardDescription>
                  Track the progress of your current audit request.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userAudits?.audits && userAudits.audits.length > 0 ? (
                  <div className="space-y-4">
                    {userAudits.audits.slice(0, 1).map((audit: AuditResult) => (
                      <div key={audit.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold">{audit.projectName}</h3>
                          <Badge 
                            variant={audit.status === 'completed' ? 'default' : 'secondary'}
                            data-testid={`status-${audit.status}`}
                          >
                            {audit.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <Progress value={getStatusProgress(audit.status)} className="mb-4" />
                        
                        {audit.status === 'completed' && audit.grade && (
                          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold">Final Grade:</span>
                              <Badge className={getGradeColor(audit.grade)}>
                                {audit.grade} ({audit.score}%)
                              </Badge>
                            </div>
                            
                            {audit.certificateUrl && (
                              <Button variant="outline" size="sm" className="mt-2">
                                <Download className="h-4 w-4 mr-2" />
                                Download Certificate
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No audit requests found</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setActiveTab('submit')}
                    >
                      Submit Your First Audit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit History</CardTitle>
                <CardDescription>
                  View all your previous audit requests and results.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userAudits?.audits && userAudits.audits.length > 0 ? (
                  <div className="space-y-4">
                    {userAudits.audits.map((audit: AuditResult) => (
                      <div key={audit.id} className="border rounded-lg p-4" data-testid={`audit-${audit.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{audit.projectName}</h3>
                          <div className="flex items-center gap-2">
                            {audit.grade && (
                              <Badge className={getGradeColor(audit.grade)}>
                                {audit.grade} ({audit.score}%)
                              </Badge>
                            )}
                            <Badge variant="outline">{audit.status}</Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          Submitted: {new Date(audit.submittedAt).toLocaleDateString()}
                        </p>
                        
                        {audit.auditCompletedAt && (
                          <p className="text-sm text-gray-600 mb-2">
                            Completed: {new Date(audit.auditCompletedAt).toLocaleDateString()}
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-3">
                          {audit.status === 'completed' && (
                            <>
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-2" />
                                View Report
                              </Button>
                              {audit.certificateUrl && (
                                <Button variant="outline" size="sm">
                                  <Download className="h-4 w-4 mr-2" />
                                  Certificate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No audit history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}