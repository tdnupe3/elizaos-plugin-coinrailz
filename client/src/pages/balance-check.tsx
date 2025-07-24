import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  DollarSign, 
  Wallet, 
  CheckCircle, 
  Search,
  Copy,
  Info
} from "@/lib/minimal-icons";
import { useToast } from "@/hooks/use-toast";

export default function BalanceCheck() {
  const [email, setEmail] = useState("a1digitalllc@gmail.com");
  const [searchEmail, setSearchEmail] = useState("");
  const { toast } = useToast();

  // Query balance data
  const { data: balanceData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/balance-check', searchEmail],
    enabled: !!searchEmail,
    retry: 1,
    staleTime: 10000
  });

  const handleSearch = () => {
    if (email.trim()) {
      setSearchEmail(email.trim());
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied!",
      description: "Wallet address copied to clipboard",
    });
  };

  const copyBalance = (balance: string) => {
    navigator.clipboard.writeText(balance);
    toast({
      title: "Balance Copied!",
      description: "USDC balance copied to clipboard",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 text-center">USDC Balance Checker</h1>
        <p className="text-gray-600 text-center">
          Check your Coin Railz USDC balance using your email address
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Enter Email Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? "Checking..." : "Check Balance"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {error && (
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {(error as any)?.message || "User not found or balance unavailable"}
          </AlertDescription>
        </Alert>
      )}

      {balanceData && (balanceData as any).success && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Balance Found!
              <Badge variant="outline" className="bg-green-100 text-green-800">
                Active Wallet
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Account Email</p>
              <p className="font-medium">{(balanceData as any).email}</p>
            </div>

            {/* Balance Display */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 mb-1">USDC Balance</p>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-6 w-6 text-green-600" />
                    <span className="text-3xl font-bold text-green-700">
                      ${parseFloat((balanceData as any).balance || '0').toFixed(2)}
                    </span>
                    <span className="text-lg text-gray-600">USDC</span>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => copyBalance((balanceData as any).balance)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Instant Settlement
                  </Badge>
                  <p className="text-xs text-blue-600 mt-1">Circle Wallet</p>
                </div>
              </div>
            </div>

            {/* Wallet Address */}
            <div>
              <p className="text-sm text-gray-600 mb-1">Wallet Address</p>
              <div className="flex items-center gap-2 bg-gray-50 p-2 rounded font-mono text-sm">
                <Wallet className="h-4 w-4 text-gray-500" />
                <span className="flex-1">{(balanceData as any).walletAddress}</span>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => copyAddress((balanceData as any).walletAddress)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={() => window.location.href = '/p2p-transfer'}>
                Send Money
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                Refresh Balance
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Information Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About USDC Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Your USDC balance is stored in a secure Circle programmable wallet</p>
            <p>• Balances are automatically synced every 30 seconds from blockchain data</p>
            <p>• Use USDC for instant P2P transfers with ultra-low fees (1.25% vs 4.5% traditional)</p>
            <p>• Your wallet supports Ethereum, Polygon, Base, Arbitrum, and BNB Chain networks</p>
            <p>• All transactions are processed through Circle's enterprise-grade infrastructure</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}