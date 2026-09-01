import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CreditCard, Building2, Copy, ExternalLink, Wallet, CheckCircle, Clock } from "@/lib/icons";
import { useLocation } from "wouter";

export default function USDCDepositWidget() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [copiedAddress, setCopiedAddress] = useState(false);

  const { data: circleWallet, isLoading } = useQuery<{ address: string; balance: number }>({
    queryKey: ["/api/user-circle/balance"],
  });

  const copyAddress = async () => {
    if (circleWallet?.address) {
      await navigator.clipboard.writeText(circleWallet.address);
      setCopiedAddress(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard",
      });
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const openEtherscan = () => {
    if (circleWallet?.address) {
      window.open(`https://etherscan.io/address/${circleWallet.address}`, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-500" />
            USDC Deposit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            Loading wallet information...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!circleWallet?.address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-500" />
            Get Your USDC Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="text-gray-600">
              You're just one step away from instant USDC payments!
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                ✨ Create Your Wallet & Start Saving
              </h3>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Ultra-low fees (0.1-0.5% vs 2.9% traditional)</li>
                <li>• Instant 2-5 second settlements</li>
                <li>• Multi-chain support (6 networks)</li>
                <li>• Non-custodial transaction signing</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button 
                onClick={() => setLocation('/auth')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Free Wallet
              </Button>
              <Button 
                onClick={() => setLocation('/auth')}
                variant="outline"
              >
                Sign In to Existing Wallet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-500" />
          Add USDC to Your Wallet
        </CardTitle>
        <CardDescription>
          Current Balance: <span className="font-semibold text-green-600">${circleWallet.balance} USDC</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposit">Deposit USDC</TabsTrigger>
            <TabsTrigger value="buy">Buy USDC</TabsTrigger>
            <TabsTrigger value="transfer">Transfer In</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deposit" className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Your USDC Deposit Address
              </h3>
              <div className="bg-white dark:bg-gray-800 p-3 rounded border break-all text-sm font-mono">
                {circleWallet.address}
              </div>
              <div className="flex gap-2 mt-2">
                <Button 
                  onClick={copyAddress} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copiedAddress ? 'Copied!' : 'Copy Address'}
                </Button>
                <Button 
                  onClick={openEtherscan} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Etherscan
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="secondary">1</Badge>
                Send USDC from any wallet or exchange to the address above
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="secondary">2</Badge>
                Make sure to use <strong>Ethereum network</strong> (not other chains)
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Badge variant="secondary">3</Badge>
                Your balance will update within 1-2 minutes after confirmation
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>⚠️ Important:</strong> Only send USDC tokens to this address. Do not send ETH or other tokens.
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="buy" className="space-y-4">
            <div className="text-center py-8">
              <CreditCard className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="font-semibold mb-2">Buy USDC with Credit/Debit Card</h3>
              <p className="text-sm text-gray-600 mb-4">
                Purchase USDC directly with your credit or debit card
              </p>
              <Button className="w-full" disabled>
                <CreditCard className="w-4 h-4 mr-2" />
                Coming Soon - Buy USDC
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="transfer" className="space-y-4">
            <div className="text-center py-8">
              <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="font-semibold mb-2">Bank Transfer</h3>
              <p className="text-sm text-gray-600 mb-4">
                Transfer USD from your bank account to buy USDC
              </p>
              <Button className="w-full" disabled>
                <Building2 className="w-4 h-4 mr-2" />
                Coming Soon - Bank Transfer
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-sm text-green-800 dark:text-green-200">
            <strong>💡 Pro Tip:</strong> USDC offers 72% savings on payments vs traditional methods and settles in 2-5 seconds instead of 3-5 business days!
          </div>
        </div>
      </CardContent>
    </Card>
  );
}