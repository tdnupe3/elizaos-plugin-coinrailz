import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface KYCProgress {
  currentStage: string;
  nextStage: string;
  completionPercentage: number;
  availableIncentives: {
    feeDiscount: number;
    premiumFeatures: string[];
  };
  requiredDocuments: string[];
}

interface KYCIncentives {
  feeDiscount: number;
  premiumFeatures: string[];
  totalSavings: number;
}

interface CostMetrics {
  totalCosts: number;
  averageCostPerUser: number;
  costPerApproval: number;
  monthlyStorageCosts: number;
  processingEfficiency: number;
}

export default function KYCIncentivesDashboard() {
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const queryClient = useQueryClient();

  // Fetch KYC progress
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['/api/circle/kyc/progress'],
    queryFn: () => apiRequest('/api/circle/kyc/progress')
  });

  // Fetch incentive calculations
  const { data: incentiveData, isLoading: incentiveLoading } = useQuery({
    queryKey: ['/api/circle/kyc/calculate-incentives', selectedAmount],
    queryFn: () => apiRequest('/api/circle/kyc/calculate-incentives', {
      method: 'POST',
      body: { transactionAmount: selectedAmount }
    })
  });

  // Fetch cost metrics
  const { data: costData, isLoading: costLoading } = useQuery({
    queryKey: ['/api/circle/kyc/cost-metrics'],
    queryFn: () => apiRequest('/api/circle/kyc/cost-metrics')
  });

  // Apply bonus mutation
  const applyBonusMutation = useMutation({
    mutationFn: () => apiRequest('/api/circle/kyc/apply-bonus', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/circle/kyc/progress'] });
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'not_started': return 'bg-gray-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'basic_complete': return 'bg-blue-500';
      case 'enhanced_complete': return 'bg-green-500';
      case 'institutional_complete': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'basic_complete': return 'Basic Complete';
      case 'enhanced_complete': return 'Enhanced Complete';
      case 'institutional_complete': return 'Institutional Complete';
      default: return 'Unknown';
    }
  };

  if (progressLoading || incentiveLoading || costLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading KYC dashboard...</p>
        </div>
      </div>
    );
  }

  const progress = progressData?.progress;
  const incentives = incentiveData;
  const metrics = costData?.metrics;
  const recommendations = costData?.recommendations;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">KYC Incentives Dashboard</h1>
        <p className="text-gray-600">Track your verification progress and unlock exclusive benefits</p>
      </div>

      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="progress">Progress & Incentives</TabsTrigger>
          <TabsTrigger value="calculator">Fee Calculator</TabsTrigger>
          <TabsTrigger value="metrics">Cost Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-6">
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>KYC Progress</span>
                <Badge className={getStageColor(progress?.currentStage)}>
                  {getStageLabel(progress?.currentStage)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm text-gray-600">{progress?.completionPercentage}%</span>
                  </div>
                  <Progress value={progress?.completionPercentage} className="h-2" />
                </div>
                
                {progress?.nextStage !== 'complete' && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Next: {progress?.nextStage}</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      Complete your {progress?.nextStage} verification to unlock additional benefits
                    </p>
                    {progress?.requiredDocuments?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-blue-900 mb-2">Required Documents:</p>
                        <div className="flex flex-wrap gap-2">
                          {progress.requiredDocuments.map((doc: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {doc.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Current Incentives */}
          <Card>
            <CardHeader>
              <CardTitle>Your Current Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {(progress?.availableIncentives?.feeDiscount * 100).toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-700">Fee Discount</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {progress?.availableIncentives?.premiumFeatures?.length || 0}
                  </div>
                  <div className="text-sm text-purple-700">Premium Features</div>
                </div>
              </div>

              {progress?.availableIncentives?.premiumFeatures?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Available Premium Features:</h4>
                  <div className="flex flex-wrap gap-2">
                    {progress.availableIncentives.premiumFeatures.map((feature: string, index: number) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}


            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fee Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Transaction Amount</label>
                  <select 
                    value={selectedAmount} 
                    onChange={(e) => setSelectedAmount(Number(e.target.value))}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value={500}>$500</option>
                    <option value={1000}>$1,000</option>
                    <option value={5000}>$5,000</option>
                    <option value={10000}>$10,000</option>
                    <option value={25000}>$25,000</option>
                  </select>
                </div>

                {incentives && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-lg">
                      <div className="text-lg font-semibold text-red-600">
                        {formatCurrency(incentives.originalFee)}
                      </div>
                      <div className="text-sm text-red-700">Original Fee</div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold text-green-600">
                        {formatCurrency(incentives.discountedFee)}
                      </div>
                      <div className="text-sm text-green-700">Your Fee</div>
                    </div>
                  </div>
                )}

                {incentives && incentives.savings > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>You save {formatCurrency(incentives.savings)}</strong> ({incentives.discountPercentage.toFixed(1)}% discount) 
                      with your current KYC verification level!
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Cost Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency(metrics?.totalCosts || 0)}
                  </div>
                  <div className="text-sm text-blue-700">Total Costs</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(metrics?.averageCostPerUser || 0)}
                  </div>
                  <div className="text-sm text-green-700">Cost per User</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-lg font-semibold text-purple-600">
                    {(metrics?.processingEfficiency || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-purple-700">Processing Efficiency</div>
                </div>
              </div>

              {recommendations && recommendations.recommendations?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Cost Optimization Recommendations</h4>
                  <div className="space-y-2">
                    {recommendations.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                  
                  {recommendations.potentialSavings > 0 && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        Potential Savings: {formatCurrency(recommendations.potentialSavings)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}