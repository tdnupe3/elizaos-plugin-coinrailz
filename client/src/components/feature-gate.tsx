import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Shield, CreditCard } from "@/lib/icons";

interface FeatureGateProps {
  children: ReactNode;
  requiredKYCStatus: 'pending' | 'verified';
  userKYCStatus: 'pending' | 'verified' | 'rejected' | 'basic';
  feature: string;
  onUpgrade?: () => void;
  showPreview?: boolean;
}

export function FeatureGate({ 
  children, 
  requiredKYCStatus, 
  userKYCStatus, 
  feature, 
  onUpgrade,
  showPreview = true 
}: FeatureGateProps) {
  const hasAccess = () => {
    if (requiredKYCStatus === 'pending') {
      return ['pending', 'verified'].includes(userKYCStatus);
    }
    return userKYCStatus === 'verified';
  };

  const getRestrictionMessage = () => {
    switch (userKYCStatus) {
      case 'basic':
        return `Complete KYC verification to access ${feature}`;
      case 'pending':
        return requiredKYCStatus === 'verified' 
          ? `KYC approval required for ${feature}` 
          : `Your KYC is being reviewed`;
      case 'rejected':
        return `Resubmit KYC documents to access ${feature}`;
      default:
        return `Verification required for ${feature}`;
    }
  };

  if (hasAccess()) {
    return <>{children}</>;
  }

  return (
    <Card className="relative">
      {showPreview && (
        <div className="absolute inset-0 bg-gray-100/80 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center">
          <div className="text-center p-6">
            <div className="bg-white rounded-full p-4 inline-block mb-4 shadow-lg">
              <Lock className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              Feature Locked
            </h3>
            <p className="text-sm text-gray-600 mb-4 max-w-xs">
              {getRestrictionMessage()}
            </p>
            {onUpgrade && (
              <Button 
                onClick={onUpgrade}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Shield className="h-4 w-4 mr-2" />
                {userKYCStatus === 'rejected' ? 'Resubmit KYC' : 'Verify Account'}
              </Button>
            )}
          </div>
        </div>
      )}
      
      <div className={showPreview ? "opacity-30" : "hidden"}>
        {children}
      </div>
      
      {!showPreview && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {feature} - Verification Required
          </CardTitle>
        </CardHeader>
      )}
      
      {!showPreview && (
        <CardContent>
          <div className="text-center py-8">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {getRestrictionMessage()}
            </p>
            {onUpgrade && (
              <Button 
                onClick={onUpgrade}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Shield className="h-4 w-4 mr-2" />
                Start Verification
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}