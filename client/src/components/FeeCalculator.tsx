import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingDown } from 'lucide-react';

interface FeeCalculation {
  originalAmount: number;
  processingFee: number;
  convenienceFee: number;
  platformFee: number;
  totalFee: number;
  totalAmount: number;
  netAmount: number;
  paymentMethod: string;
  feeBreakdown?: {
    networkFee: number;
    serviceFee: number;
    platformFee: number;
    description: string;
  };
  savings?: {
    vsWireTransfer: number;
    vsCompetitor: number;
    percentageSaved: number;
  };
}

interface FeeCalculatorProps {
  calculation?: FeeCalculation;
  amount?: number;
}

const FeeCalculator: React.FC<FeeCalculatorProps> = ({ calculation, amount = 0 }) => {
  // Default calculation for display when no calculation provided
  const defaultCalc: FeeCalculation = {
    originalAmount: amount,
    processingFee: amount * 0.001, // 0.1%
    convenienceFee: 0,
    platformFee: amount * 0.0075, // 0.75%
    totalFee: amount * 0.0085, // 0.85% total
    totalAmount: amount * 1.0085,
    netAmount: amount,
    paymentMethod: 'crypto',
    feeBreakdown: {
      networkFee: amount * 0.001,
      serviceFee: amount * 0.0025,
      platformFee: amount * 0.005,
      description: 'Competitive trading fees'
    }
  };

  const calc = calculation || defaultCalc;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="w-4 h-4 text-blue-600" />
          Fee Breakdown
          <Badge variant="secondary" className="ml-auto">
            ${calc.totalFee.toFixed(2)} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Trading Amount</span>
            <span className="font-medium">${calc.originalAmount.toFixed(2)}</span>
          </div>
          
          {calc.feeBreakdown && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Network Fee</span>
                <span>${calc.feeBreakdown.networkFee.toFixed(4)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Platform Fee</span>
                <span>${calc.feeBreakdown.platformFee.toFixed(2)}</span>
              </div>
            </>
          )}
          
          <div className="border-t pt-2 flex justify-between font-medium">
            <span>Total with Fees</span>
            <span className="text-blue-600">${calc.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {calc.savings && calc.savings.percentageSaved > 0 && (
          <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
            <div className="flex items-center gap-1 text-sm text-green-700">
              <TrendingDown className="w-3 h-3" />
              <span className="font-medium">
                Save {calc.savings.percentageSaved}% vs competitors
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FeeCalculator;