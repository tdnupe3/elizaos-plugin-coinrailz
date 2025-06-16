import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, Bitcoin, DollarSign, AlertCircle, CheckCircle } from '@/lib/icons';

interface FeeBreakdown {
  subtotal: number;
  fees: Array<{ name: string; amount: number; description: string }>;
  total: number;
}

interface FeeCalculation {
  originalAmount: number;
  processingFee: number;
  convenienceFee: number;
  platformFee: number;
  totalFee: number;
  totalAmount: number;
  netAmount: number;
  paymentMethod: string;
}

interface Props {
  onCalculationComplete?: (calculation: FeeCalculation, breakdown: FeeBreakdown) => void;
  defaultAmount?: number;
  defaultPaymentMethod?: string;
  transactionType?: 'p2p' | 'marketplace';
  showCalculateButton?: boolean;
}

export default function FeeCalculator({ 
  onCalculationComplete, 
  defaultAmount = 0,
  defaultPaymentMethod = 'stripe',
  transactionType = 'p2p',
  showCalculateButton = true
}: Props) {
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod);
  const [calculation, setCalculation] = useState<FeeCalculation | null>(null);
  const [breakdown, setBreakdown] = useState<FeeBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ valid: boolean; message?: string } | null>(null);

  const paymentMethods = [
    { value: 'stripe', label: 'Credit/Debit Card', icon: CreditCard },
    { value: 'paypal', label: 'PayPal', icon: DollarSign },
    { value: 'crypto', label: 'Cryptocurrency', icon: Bitcoin }
  ];

  // Auto-calculate when amount or payment method changes
  useEffect(() => {
    if (amount && parseFloat(amount) > 0 && paymentMethod) {
      const timer = setTimeout(() => {
        calculateFees();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timer);
    }
  }, [amount, paymentMethod]);

  const calculateFees = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate amount first
      const validationResponse = await apiRequest('POST', '/api/fees/validate', {
        amount: parseFloat(amount),
        paymentMethod
      });

      setValidation(validationResponse);

      if (!validationResponse.valid) {
        setCalculation(null);
        setBreakdown(null);
        setLoading(false);
        return;
      }

      // Calculate fees
      const response = await apiRequest('POST', '/api/fees/calculate', {
        amount: parseFloat(amount),
        paymentMethod,
        transactionType
      });

      setCalculation(response.calculation);
      setBreakdown(response.breakdown);
      
      if (onCalculationComplete) {
        onCalculationComplete(response.calculation, response.breakdown);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to calculate fees');
      setCalculation(null);
      setBreakdown(null);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    const methodConfig = paymentMethods.find(m => m.value === method);
    const Icon = methodConfig?.icon || DollarSign;
    return <Icon className="h-4 w-4" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fee Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Transaction Amount</Label>
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.01"
            min="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-method">Payment Method</Label>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentMethods.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  <div className="flex items-center gap-2">
                    <method.icon className="h-4 w-4" />
                    {method.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showCalculateButton && (
          <Button 
            onClick={calculateFees} 
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full"
          >
            {loading ? 'Calculating...' : 'Calculate Fees'}
          </Button>
        )}

        {validation && !validation.valid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validation.message}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {breakdown && calculation && validation?.valid && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle className="h-4 w-4" />
              Fee Breakdown
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(breakdown.subtotal)}</span>
              </div>

              {breakdown.fees.map((fee, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <div className="flex flex-col">
                    <span>{fee.name}</span>
                    <span className="text-xs text-muted-foreground">{fee.description}</span>
                  </div>
                  <span>{formatCurrency(fee.amount)}</span>
                </div>
              ))}

              <Separator />

              <div className="flex justify-between font-medium">
                <span>Total Amount</span>
                <span>{formatCurrency(breakdown.total)}</span>
              </div>

              {paymentMethod === 'stripe' || paymentMethod === 'paypal' ? (
                <div className="text-xs text-muted-foreground mt-2">
                  <div className="flex items-center gap-1">
                    {getPaymentMethodIcon(paymentMethod)}
                    Convenience fee covers credit card processing costs (2.9% + $0.30)
                  </div>
                </div>
              ) : (
                <div className="text-xs text-green-600 mt-2">
                  <div className="flex items-center gap-1">
                    {getPaymentMethodIcon(paymentMethod)}
                    No convenience fees for cryptocurrency transactions!
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {transactionType === 'marketplace' && (
          <div className="text-xs text-muted-foreground">
            Marketplace transactions include additional 2% commission fee
          </div>
        )}
      </CardContent>
    </Card>
  );
}