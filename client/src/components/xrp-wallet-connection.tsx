import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  Wallet, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  QrCode,
  ExternalLink,
  RefreshCw
} from "@/lib/icons";

interface XRPWalletInfo {
  address: string;
  balance: number;
  isConnected: boolean;
  lastUpdated: string;
}

export function XRPWalletConnection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletAddress, setWalletAddress] = useState("");
  const [importMethod, setImportMethod] = useState<'address' | 'qr' | 'connect'>('connect');

  // Get user's XRP wallet info
  const { data: walletInfo, refetch: refetchWallet } = useQuery({
    queryKey: ['/api/wallets/xrp', user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/wallets/xrp');
      return response.json();
    },
    enabled: !!user
  });

  // Connect wallet mutation
  const connectWalletMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await apiRequest('POST', '/api/wallets/xrp/connect', {
        walletAddress: address
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Wallet Connected",
        description: "XRP wallet successfully connected to your account"
      });
      setWalletAddress("");
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/xrp'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet",
        variant: "destructive"
      });
    }
  });

  // Disconnect wallet mutation
  const disconnectWalletMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallets/xrp/disconnect');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Wallet Disconnected",
        description: "XRP wallet has been disconnected from your account"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/xrp'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    }
  });

  // Refresh balance mutation
  const refreshBalanceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallets/xrp/refresh');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Balance Updated",
        description: "Wallet balance has been refreshed"
      });
      refetchWallet();
    }
  });

  const handleConnectWallet = () => {
    if (!walletAddress.trim()) {
      toast({
        title: "Invalid Address",
        description: "Please enter a valid XRP wallet address",
        variant: "destructive"
      });
      return;
    }

    if (!walletAddress.startsWith('r') || walletAddress.length < 25) {
      toast({
        title: "Invalid Format",
        description: "XRP addresses start with 'r' and are typically 25-34 characters long",
        variant: "destructive"
      });
      return;
    }

    connectWalletMutation.mutate(walletAddress);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  if (walletInfo?.isConnected) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-blue-600" />
              <span>XRP Wallet Connected</span>
            </CardTitle>
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 rounded-lg border">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-gray-600">Wallet Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-sm bg-white px-2 py-1 rounded border flex-1">
                    {walletInfo.address}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyAddress(walletInfo.address)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Available Balance</Label>
                  <div className="text-lg font-semibold text-blue-800">
                    {walletInfo.balance?.toFixed(6) || '0.000000'} XRP
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">USD Equivalent</Label>
                  <div className="text-lg font-semibold text-emerald-700">
                    ${(walletInfo.balance * 0.50 || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={() => refreshBalanceMutation.mutate()}
              disabled={refreshBalanceMutation.isPending}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshBalanceMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Balance
            </Button>
            <Button
              onClick={() => disconnectWalletMutation.mutate()}
              disabled={disconnectWalletMutation.isPending}
              variant="outline"
              className="flex-1"
            >
              Disconnect
            </Button>
          </div>

          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              Ensure your wallet has sufficient XRP balance for transactions. Minimum 20 XRP reserve required by XRP Ledger.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Wallet className="w-5 h-5 text-blue-600" />
          <span>Connect XRP Wallet</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={importMethod} onValueChange={(value: any) => setImportMethod(value)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connect">Manual Entry</TabsTrigger>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="address">Import Only</TabsTrigger>
          </TabsList>

          <TabsContent value="connect" className="space-y-4">
            <div>
              <Label htmlFor="walletAddress">XRP Wallet Address</Label>
              <Input
                id="walletAddress"
                placeholder="rPVMhWBsfF9iMXYj3aAzJVkPDTFNSyWdKy"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your XRP wallet address (starts with 'r')
              </p>
            </div>

            <Button
              onClick={handleConnectWallet}
              disabled={connectWalletMutation.isPending || !walletAddress.trim()}
              className="w-full"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {connectWalletMutation.isPending ? "Connecting..." : "Connect Wallet"}
            </Button>
          </TabsContent>

          <TabsContent value="qr" className="space-y-4">
            <div className="text-center py-8">
              <QrCode className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">QR Code scanning will be available soon</p>
              <p className="text-sm text-gray-500">Use manual entry for now</p>
            </div>
          </TabsContent>

          <TabsContent value="address" className="space-y-4">
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Import mode allows you to add wallet addresses for receiving payments only. 
                You'll need to manually manage transactions from your external wallet.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="importAddress">XRP Address to Import</Label>
              <Input
                id="importAddress"
                placeholder="rPVMhWBsfF9iMXYj3aAzJVkPDTFNSyWdKy"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className="font-mono"
              />
            </div>

            <Button
              onClick={handleConnectWallet}
              disabled={connectWalletMutation.isPending || !walletAddress.trim()}
              className="w-full"
              variant="outline"
            >
              Import Address
            </Button>
          </TabsContent>
        </Tabs>

        <div className="mt-6 space-y-3">
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Popular XRP Wallets:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-3 h-3" />
                <span>XUMM Wallet</span>
              </div>
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-3 h-3" />
                <span>Crossmark</span>
              </div>
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-3 h-3" />
                <span>Ledger Live</span>
              </div>
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-3 h-3" />
                <span>Trust Wallet</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}