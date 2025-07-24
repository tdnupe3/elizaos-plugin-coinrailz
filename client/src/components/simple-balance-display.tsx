import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "@/lib/minimal-icons";
import { Badge } from "@/components/ui/badge";

interface SimpleBalanceDisplayProps {
  userEmail: string;
  title?: string;
}

interface BalanceResponse {
  success: boolean;
  email: string;
  balance?: string;
  usdBalance?: string;
  walletAddress: string;
  error?: string;
}

export function SimpleBalanceDisplay({ userEmail, title = "USDC Balance" }: SimpleBalanceDisplayProps) {
  const { data: balanceData, isLoading, error } = useQuery({
    queryKey: [`balance-check`, userEmail],
    queryFn: async () => {
      const response = await fetch(`/api/balance-check/${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!userEmail,
    refetchInterval: 5000, // Refresh every 5 seconds for beta testing
    retry: 3,
    staleTime: 0, // Always consider data stale for beta testing
    cacheTime: 0 // Don't cache for beta testing
  });

  if (isLoading) {
    return (
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <DollarSign className="h-5 w-5" />
            {title}
            <Badge variant="outline" className="bg-blue-100 text-blue-800">
              Loading...
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-gray-400 animate-pulse">
            $0.00
          </div>
          <p className="text-sm text-gray-500 mt-2">Checking balance...</p>
        </CardContent>
      </Card>
    );
  }

  console.log('Balance Debug:', { userEmail, balanceData, isLoading, error });
  
  const balance = balanceData as BalanceResponse;
  if (error || !balance?.success) {
    return (
      <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <DollarSign className="h-5 w-5" />
            {title}
            <Badge variant="outline" className="bg-red-100 text-red-800">
              Error
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            $0.00
          </div>
          <p className="text-sm text-red-500 mt-2">
            Unable to load balance for {userEmail}
          </p>
        </CardContent>
      </Card>
    );
  }

  const balanceAmount = parseFloat(balance.balance || balance.usdBalance || "0");
  console.log('Balance Parsing:', { 
    rawBalance: balance.balance, 
    usdBalance: balance.usdBalance, 
    parsedAmount: balanceAmount 
  });
  
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(balanceAmount);

  return (
    <Card className="border-green-200 bg-gradient-to-r from-green-50 to-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <DollarSign className="h-5 w-5" />
          {title}
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div>
          <div className="text-4xl font-bold text-green-600">
            {formattedBalance}
          </div>
          <p className="text-sm text-gray-600 mt-1">Available USDC Balance</p>
        </div>

        {/* Account Info */}
        <div className="border-t pt-4 space-y-2">
          <div>
            <p className="text-xs text-gray-500">Account Email</p>
            <p className="font-medium text-sm">{balance.email}</p>
          </div>
          
          {balance.walletAddress && (
            <div>
              <p className="text-xs text-gray-500">Wallet Address</p>
              <p className="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">
                {balance.walletAddress}
              </p>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Real-time balance</span>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
            Circle USDC
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}