import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

interface KYCStatusIndicatorProps {
  status: 'pending' | 'verified' | 'rejected' | 'basic';
  complianceLevel?: 'basic' | 'enhanced' | 'institutional';
  onUpgrade?: () => void;
  showUpgradePrompt?: boolean;
}

export function KYCStatusIndicator({ 
  status, 
  complianceLevel = 'basic', 
  onUpgrade, 
  showUpgradePrompt = false 
}: KYCStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          label: 'Verified',
          description: 'Full platform access enabled'
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          label: 'Pending Review',
          description: 'Verification in progress'
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50',
          label: 'Rejected',
          description: 'Additional documentation required'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          label: 'Basic Account',
          description: 'Referral features available'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={`border-l-4 border-l-${config.color} ${config.bgColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.color} text-white`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.textColor}>
                  {config.label}
                </Badge>
                {complianceLevel !== 'basic' && (
                  <Badge variant="secondary">
                    {complianceLevel.charAt(0).toUpperCase() + complianceLevel.slice(1)}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {config.description}
              </p>
            </div>
          </div>
          
          {showUpgradePrompt && status !== 'verified' && onUpgrade && (
            <Button 
              onClick={onUpgrade}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {status === 'rejected' ? 'Resubmit' : 'Verify Account'}
            </Button>
          )}
        </div>
        
        {status === 'basic' && showUpgradePrompt && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Unlock More Features:</strong> Complete KYC verification to access:
            </p>
            <ul className="text-xs text-blue-700 mt-1 ml-4">
              <li>• Send/receive payments up to $50,000</li>
              <li>• Crypto trading and DEX access</li>
              <li>• AI Agent marketplace transactions</li>
              <li>• Commission withdrawals</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}