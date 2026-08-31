import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Heart, QrCode, ExternalLink, Wallet, Copy } from "@/lib/icons";

interface DonationButtonProps {
  agentId: string;
  agentName: string;
}

interface DonationForm {
  amount: string;
  currency: string;
  donorMessage: string;
  targetWallet: 'ethereum' | 'solana';
}
interface CurrenciesResponse {
  currencies: string[];
}

export default function DonationButton({ agentId, agentName }: DonationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [donationForm, setDonationForm] = useState<DonationForm>({
    amount: '',
    currency: 'BTC',
    donorMessage: '',
    targetWallet: 'ethereum'
  });
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const { toast } = useToast();

  // Fetch available cryptocurrencies
  const { data: currenciesData } = useQuery<CurrenciesResponse>({
    queryKey: ['/api/nowpayments/currencies'],
    enabled: isOpen,
  });

  // Create donation mutation
  const createDonationMutation = useMutation({
    mutationFn: async (formData: DonationForm) => {
      return apiRequest('POST', `/api/agents/${agentId}/donate`, formData);
    },
    onSuccess: (data) => {
      if (data.success) {
        setPaymentResult(data.payment);
        toast({
          title: "Donation Created",
          description: "Your donation payment has been created successfully!",
        });
      } else {
        throw new Error(data.message);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Donation Failed",
        description: error.message || "Failed to create donation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donationForm.amount || !donationForm.currency) {
      toast({
        title: "Invalid Input",
        description: "Please enter amount and select currency",
        variant: "destructive",
      });
      return;
    }
    createDonationMutation.mutate(donationForm);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Payment information copied to clipboard",
    });
  };

  const popularCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL', 'DOGE', 'LTC'];
  const availableCurrencies = currenciesData?.currencies || popularCurrencies;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Heart className="w-4 h-4" />
          Donate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            Donate to {agentName}
          </DialogTitle>
        </DialogHeader>

        {!paymentResult ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Donation Details</CardTitle>
                <CardDescription>
                  Support this AI agent with cryptocurrency donations. Funds go directly to secure wallets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount (USD)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="1"
                      placeholder="10.00"
                      value={donationForm.amount}
                      onChange={(e) => setDonationForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Cryptocurrency</Label>
                    <Select 
                      value={donationForm.currency} 
                      onValueChange={(value) => setDonationForm(prev => ({ ...prev, currency: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select crypto" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <div className="text-sm font-medium text-gray-500 mb-2">Popular</div>
                          {popularCurrencies.map((currency) => (
                            <SelectItem key={currency} value={currency}>
                              {currency}
                            </SelectItem>
                          ))}
                        </div>
                        {availableCurrencies.length > popularCurrencies.length && (
                          <div className="p-2 border-t">
                            <div className="text-sm font-medium text-gray-500 mb-2">All Currencies</div>
                            {availableCurrencies
                              .filter(c => !popularCurrencies.includes(c))
                              .slice(0, 20)
                              .map((currency) => (
                                <SelectItem key={currency} value={currency}>
                                  {currency}
                                </SelectItem>
                              ))}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="targetWallet">Target Wallet Network</Label>
                  <Select 
                    value={donationForm.targetWallet} 
                    onValueChange={(value: 'ethereum' | 'solana') => setDonationForm(prev => ({ ...prev, targetWallet: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          Ethereum (0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91)
                        </div>
                      </SelectItem>
                      <SelectItem value="solana">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          Solana (9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Leave a message for the AI agent..."
                    value={donationForm.donorMessage}
                    onChange={(e) => setDonationForm(prev => ({ ...prev, donorMessage: e.target.value }))}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end space-x-3">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDonationMutation.isPending}>
                {createDonationMutation.isPending ? "Creating..." : "Create Donation"}
              </Button>
            </div>
          </form>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Payment Created
              </CardTitle>
              <CardDescription>
                Complete your donation using the payment link or QR code below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Payment Link</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      value={paymentResult.paymentUrl} 
                      readOnly 
                      className="text-sm"
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => copyToClipboard(paymentResult.paymentUrl)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center">
                  {paymentResult.qrCode && (
                    <div className="text-center">
                      <Label>QR Code</Label>
                      <div className="mt-2 p-4 bg-white rounded-lg border">
                        <div className="w-32 h-32 bg-gray-200 rounded flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button 
                  onClick={() => window.open(paymentResult.paymentUrl, '_blank')}
                  className="flex items-center gap-2 flex-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Complete Payment
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setPaymentResult(null);
                    setDonationForm({
                      amount: '',
                      currency: 'BTC',
                      donorMessage: '',
                      targetWallet: 'ethereum'
                    });
                  }}
                  className="flex-1"
                >
                  New Donation
                </Button>
              </div>

              <div className="text-center text-sm text-gray-500 pt-2">
                <Badge variant="outline" className="mb-2">
                  Powered by NOWPayments
                </Badge>
                <p>Secure cryptocurrency payments • Low fees • Instant processing</p>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}