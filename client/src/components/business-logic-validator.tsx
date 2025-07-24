import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Info } from "@/lib/icons";

interface BusinessLogicValidatorProps {
  amount: number;
  transactionType: 'p2p' | 'marketplace' | 'crypto';
  paymentMethod?: string;
  onValidationChange?: (isValid: boolean, message?: string) => void;
}

interface BusinessLogicConstants {
  minimumAmounts: {
    standard: number;
    usdc: number;
    xrp: number;
  };
  maximumAmounts: {
    [key: string]: number;
  };
  fees: {
    usdc: { platformRate: number; minimumFee: number };
    standard: { platformRate: number; minimumFee: number };
    xrp: { platformRate: number; minimumFee: number; referralBuffer: number };
  };
}

export function BusinessLogicValidator({ 
  amount, 
  transactionType, 
  paymentMethod = 'credit-card',
  onValidationChange 
}: BusinessLogicValidatorProps) {
  const [businessLogic, setBusinessLogic] = useState<BusinessLogicConstants | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    message: string;
    type: 'error' | 'warning' | 'success' | 'info';
  }>({
    isValid: true,
    message: '',
    type: 'info'
  });

  // Fetch business logic constants
  useEffect(() => {
    fetch('/api/p2p/business-logic')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBusinessLogic(data.businessLogic);
        }
      })
      .catch(console.error);
  }, []);

  // Validate transaction amount
  useEffect(() => {
    if (!businessLogic || !amount) {
      setValidation({
        isValid: true,
        message: '',
        type: 'info'
      });
      onValidationChange?.(true);
      return;
    }

    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      const result = {
        isValid: false,
        message: 'Please enter a valid transaction amount',
        type: 'error' as const
      };
      setValidation(result);
      onValidationChange?.(false, result.message);
      return;
    }

    // Check minimum amounts
    let minimumRequired = businessLogic.minimumAmounts.standard;
    
    if (transactionType === 'marketplace') {
      minimumRequired = 25; // AI marketplace minimum
    } else if (paymentMethod === 'usdc') {
      minimumRequired = businessLogic.minimumAmounts.usdc;
    } else if (paymentMethod === 'xrp') {
      minimumRequired = businessLogic.minimumAmounts.xrp;
    }

    if (parsedAmount < minimumRequired) {
      const result = {
        isValid: false,
        message: transactionType === 'marketplace' 
          ? `Minimum order amount is $${minimumRequired} to ensure profitable operations and quality service delivery`
          : `Minimum transfer amount is $${minimumRequired} to ensure profitable operations`,
        type: 'error' as const
      };
      setValidation(result);
      onValidationChange?.(false, result.message);
      return;
    }

    // Check maximum amounts
    const maxAmount = businessLogic.maximumAmounts[paymentMethod] || 10000;
    
    if (parsedAmount > maxAmount) {
      const result = {
        isValid: false,
        message: `Maximum ${transactionType} amount for ${paymentMethod} is $${maxAmount.toLocaleString()} for AML compliance`,
        type: 'error' as const
      };
      setValidation(result);
      onValidationChange?.(false, result.message);
      return;
    }

    // Calculate fees and show savings for USDC/XRP
    let feeInfo = '';
    if (paymentMethod === 'usdc') {
      const fee = Math.max(parsedAmount * businessLogic.fees.usdc.platformRate, businessLogic.fees.usdc.minimumFee);
      const standardFee = Math.max(parsedAmount * businessLogic.fees.standard.platformRate, businessLogic.fees.standard.minimumFee);
      const savings = ((standardFee - fee) / standardFee * 100).toFixed(0);
      feeInfo = ` • ${savings}% savings with USDC ($${fee.toFixed(2)} vs $${standardFee.toFixed(2)})`;
    } else if (paymentMethod === 'xrp') {
      const effectiveRate = businessLogic.fees.xrp.platformRate + businessLogic.fees.xrp.referralBuffer;
      const fee = Math.max(parsedAmount * effectiveRate, businessLogic.fees.xrp.minimumFee);
      feeInfo = ` • Ultra-low XRP fee: $${fee.toFixed(2)} (${(effectiveRate * 100).toFixed(1)}%)`;
    }

    // Transaction is valid
    const result = {
      isValid: true,
      message: `✓ Transaction validated${feeInfo}`,
      type: 'success' as const
    };
    setValidation(result);
    onValidationChange?.(true);

  }, [amount, transactionType, paymentMethod, businessLogic, onValidationChange]);

  if (!validation.message) {
    return null;
  }

  const getIcon = () => {
    switch (validation.type) {
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (validation.type) {
      case 'error': return 'destructive';
      case 'success': return 'default';
      default: return 'default';
    }
  };

  return (
    <Alert variant={getVariant()} className="mt-3">
      {getIcon()}
      <AlertDescription className="ml-2">
        {validation.message}
      </AlertDescription>
    </Alert>
  );
}

// Business Logic Summary Component
export function BusinessLogicSummary() {
  const [businessLogic, setBusinessLogic] = useState<BusinessLogicConstants | null>(null);

  useEffect(() => {
    fetch('/api/p2p/business-logic')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setBusinessLogic(data.businessLogic);
        }
      })
      .catch(console.error);
  }, []);

  if (!businessLogic) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Info className="h-5 w-5" />
          Transaction Limits & Fees
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-2">Minimum Amounts</h4>
            <div className="space-y-1">
              <Badge variant="outline">P2P Transfers: ${businessLogic.minimumAmounts.standard}</Badge>
              <Badge variant="outline">AI Marketplace: $25</Badge>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-2">USDC Benefits</h4>
            <div className="space-y-1">
              <Badge variant="secondary">72% fee savings</Badge>
              <Badge variant="secondary">3-5 second settlement</Badge>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-sm text-gray-600 dark:text-gray-400 mb-2">XRP Benefits</h4>
            <div className="space-y-1">
              <Badge variant="secondary">0.7% total fee</Badge>
              <Badge variant="secondary">Global reach</Badge>
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400 border-t pt-3">
          Business Logic Version 2.0.0 • Minimums ensure profitable operations and quality service delivery
        </div>
      </CardContent>
    </Card>
  );
}