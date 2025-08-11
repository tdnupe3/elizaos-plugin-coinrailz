import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle, AlertCircle, ExternalLink, CreditCard, Globe, TrendingUp, Building } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface KYCStatus {
  isVerified: boolean;
  level: 'none' | 'basic' | 'complete' | 'enhanced';
  provider: 'none' | 'coinbase' | 'circle' | 'internal';
  verifiedAt: string | null;
  features: {
    highLimitTransactions: boolean;
    internationalTransfers: boolean;
    advancedTrading: boolean;
    institutionalFeatures: boolean;
  };
  nextSteps?: Array<{
    method: string;
    title: string;
    description: string;
    recommended?: boolean;
    timeframe?: string;
  }>;
}

export function KYCStatusDisplay() {
  const { kycVerified, authProvider } = useAuth();
  
  const { data: kycStatus, isLoading } = useQuery({
    queryKey: ["/api/kyc/status"],
    retry: false,
    throwOnError: false
  }) as { data: KYCStatus, isLoading: boolean };

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-600">Checking verification status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const status = kycStatus || {
    isVerified: false,
    level: 'none' as const,
    provider: 'none' as const,
    verifiedAt: null,
    features: {
      highLimitTransactions: false,
      internationalTransfers: false,
      advancedTrading: false,
      institutionalFeatures: false
    }
  };

  const getStatusColor = () => {
    if (status.isVerified && status.level === 'complete') return 'bg-green-50 border-green-200';
    if (status.isVerified && status.level === 'basic') return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getStatusIcon = () => {
    if (status.isVerified && status.level === 'complete') {
      return <ShieldCheck className="w-6 h-6 text-green-600" />;
    }
    if (status.isVerified && status.level === 'basic') {
      return <AlertCircle className="w-6 h-6 text-yellow-600" />;
    }
    return <AlertCircle className="w-6 h-6 text-red-600" />;
  };

  const getStatusBadge = () => {
    if (status.isVerified && status.level === 'complete') {
      return <Badge className="bg-green-100 text-green-800">Fully Verified</Badge>;
    }
    if (status.isVerified && status.level === 'basic') {
      return <Badge className="bg-yellow-100 text-yellow-800">Basic Verification</Badge>;
    }
    return <Badge className="bg-red-100 text-red-800">Not Verified</Badge>;
  };

  const testProtectedFeature = async (feature: string) => {
    try {
      const response = await fetch(`/api/protected/${feature}`);
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ Access granted to ${feature.replace('-', ' ')}\n\n${data.message}`);
      } else {
        alert(`❌ Access denied: ${data.message}`);
      }
    } catch (error) {
      alert(`❌ Error testing feature: ${error}`);
    }
  };

  return (
    <Card className={getStatusColor()}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {getStatusIcon()}
          <span>Identity Verification Status</span>
          {getStatusBadge()}
        </CardTitle>
        {status.provider === 'coinbase' && (
          <p className="text-sm text-green-600 font-medium">
            ✨ Verified via Coinbase OAuth - Full access granted automatically
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Verification Level</h4>
            <p className="text-sm text-gray-600 capitalize">
              {status.level === 'none' ? 'Not verified' : `${status.level} verification`}
            </p>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-2">Provider</h4>
            <p className="text-sm text-gray-600 capitalize">
              {status.provider === 'coinbase' ? 'Coinbase OAuth' : status.provider}
            </p>
          </div>
        </div>

        {/* Available Features */}
        <div>
          <h4 className="font-medium text-sm mb-3">Available Features</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">High-Limit Transfers</span>
              </div>
              <div className="flex items-center gap-2">
                {status.features.highLimitTransactions ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testProtectedFeature('high-limit-transfers')}
                  className="text-xs"
                >
                  Test Access
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="text-sm">International Transfers</span>
              </div>
              <div className="flex items-center gap-2">
                {status.features.internationalTransfers ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testProtectedFeature('international-transfers')}
                  className="text-xs"
                >
                  Test Access
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Advanced Trading</span>
              </div>
              <div className="flex items-center gap-2">
                {status.features.advancedTrading ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testProtectedFeature('advanced-trading')}
                  className="text-xs"
                >
                  Test Access
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span className="text-sm">Institutional Features</span>
              </div>
              <div className="flex items-center gap-2">
                {status.features.institutionalFeatures ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span className="text-xs text-gray-500">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>

        {/* Next Steps for Unverified Users */}
        {!status.isVerified && status.nextSteps && (
          <div>
            <h4 className="font-medium text-sm mb-3">Get Verified</h4>
            <div className="space-y-2">
              {status.nextSteps.map((step, index) => (
                <div key={index} className={`p-3 rounded-lg border ${step.recommended ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-medium text-sm flex items-center gap-2">
                        {step.title}
                        {step.recommended && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                      </h5>
                      <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                      {step.timeframe && <p className="text-xs text-gray-500 mt-1">⏱️ {step.timeframe}</p>}
                    </div>
                    {step.method === 'coinbase_oauth' && (
                      <Button
                        size="sm"
                        onClick={() => window.location.href = '/auth/coinbase/login'}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Sign in
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}