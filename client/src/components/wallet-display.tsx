import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wallet, 
  Copy, 
  QrCode, 
  DollarSign,
  CheckCircle,
  ArrowRight,
  Info
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function WalletDisplay() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);
  
  // For demo purposes, show the test account balance
  // In production, this would use authenticated user data
  const testEmail = 'a1digitalllc@gmail.com';
  
  const { data: balanceData, isLoading } = useQuery({
    queryKey: ['/api/balance-check', testEmail],
    enabled: true, // Always enabled for demo
    retry: false,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0,
    throwOnError: false
  });

  const walletAddress = (balanceData as any)?.walletAddress;
  const balance = parseFloat((balanceData as any)?.balance || '0');
  const hasWallet = !!(balanceData && (balanceData as any)?.success && walletAddress);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({
        title: "Address Copied!",
        description: "Your wallet address has been copied to clipboard",
      });
    }
  };

  // Always show for demo purposes
  // if (!user) {
  //   return null;
  // }

  if (!hasWallet) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Setting up your USDC wallet... This usually takes a few seconds.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="w-5 h-5 text-blue-500" />
          Your USDC Wallet
          <Badge variant="outline" className="bg-green-100 text-green-800 ml-auto">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${balance.toFixed(2)} <span className="text-lg text-gray-600">USDC</span>
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* Wallet Address */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Wallet Address</p>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <code className="flex-1 text-sm font-mono text-gray-800 break-all">
              {walletAddress}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={copyAddress}
              className="flex-shrink-0"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="sm" className="w-full">
            <QrCode className="w-4 h-4 mr-2" />
            Show QR
          </Button>
          <Button variant="outline" size="sm" className="w-full">
            <ArrowRight className="w-4 h-4 mr-2" />
            Send Money
          </Button>
        </div>

        {/* Deposit Instructions */}
        {balance === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Ready to get started?</strong><br />
              Send USDC from Coinbase, another exchange, or bank account to your wallet address above. 
              Deposits are instant and you can start sending money immediately.
            </AlertDescription>
          </Alert>
        )}

        {/* Supported Networks */}
        <div className="text-xs text-gray-500 text-center">
          Supports: Ethereum • Polygon • Base • Arbitrum • BNB Chain • Avalanche
        </div>
      </CardContent>
    </Card>
  );
}