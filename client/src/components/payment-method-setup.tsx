import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Building2, DollarSign, Shield } from "@/lib/icons";
import { useToast } from "@/hooks/use-toast";

interface PaymentMethodSetupProps {
  method: 'credit-card' | 'paypal' | 'bank-transfer';
  onComplete: () => void;
  onCancel: () => void;
}

export function PaymentMethodSetup({ method, onComplete, onCancel }: PaymentMethodSetupProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    // Credit card fields
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    // Bank fields
    routingNumber: '',
    accountNumber: '',
    accountType: 'checking',
    // PayPal fields
    paypalEmail: '',
    // Address fields
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate adding payment method
    toast({
      title: "Payment Method Added",
      description: `Your ${method.replace('-', ' ')} has been securely added to your account.`,
    });
    
    onComplete();
  };

  const getMethodConfig = () => {
    switch (method) {
      case 'credit-card':
        return {
          title: 'Add Credit/Debit Card',
          icon: CreditCard,
          description: 'Securely add your card for instant payments'
        };
      case 'paypal':
        return {
          title: 'Connect PayPal Account',
          icon: DollarSign,
          description: 'Link your PayPal account for easy transfers'
        };
      case 'bank-transfer':
        return {
          title: 'Add Bank Account',
          icon: Building2,
          description: 'Connect your bank account for ACH transfers'
        };
    }
  };

  const config = getMethodConfig();
  const Icon = config.icon;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icon className="h-5 w-5 mr-2" />
          {config.title}
        </CardTitle>
        <p className="text-sm text-gray-600">{config.description}</p>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Your payment information is encrypted and secured with bank-level security.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {method === 'credit-card' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cardholderName">Cardholder Name</Label>
                <Input
                  id="cardholderName"
                  value={formData.cardholderName}
                  onChange={(e) => setFormData(prev => ({ ...prev, cardholderName: e.target.value }))}
                  placeholder="John Smith"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                    placeholder="MM/YY"
                    maxLength={5}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    value={formData.cvv}
                    onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value }))}
                    placeholder="123"
                    maxLength={4}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {method === 'paypal' && (
            <div className="space-y-2">
              <Label htmlFor="paypalEmail">PayPal Email</Label>
              <Input
                id="paypalEmail"
                type="email"
                value={formData.paypalEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, paypalEmail: e.target.value }))}
                placeholder="your.email@example.com"
                required
              />
            </div>
          )}

          {method === 'bank-transfer' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="routingNumber">Routing Number</Label>
                <Input
                  id="routingNumber"
                  value={formData.routingNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
                  placeholder="123456789"
                  maxLength={9}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="Account number"
                  required
                />
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Payment Method
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}