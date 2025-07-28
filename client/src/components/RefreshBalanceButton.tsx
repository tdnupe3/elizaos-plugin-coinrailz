import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from '@/lib/minimal-icons-clean';
import { apiRequest } from '@/lib/queryClient';

interface RefreshBalanceButtonProps {
  userEmail: string;
  onBalanceUpdate?: (newBalance: string) => void;
}

export const RefreshBalanceButton: React.FC<RefreshBalanceButtonProps> = ({ 
  userEmail, 
  onBalanceUpdate 
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    
    try {
      // Check current balance first
      const balanceResponse = await fetch(`/api/balance-check/${encodeURIComponent(userEmail)}`);
      const balanceData = await balanceResponse.json();
      
      if (!balanceData.success) {
        throw new Error('Failed to check current balance');
      }

      toast({
        title: "Balance Refreshed",
        description: `Current USDC balance: $${balanceData.balance}`,
      });

      if (onBalanceUpdate) {
        onBalanceUpdate(balanceData.balance);
      }

    } catch (error) {
      console.error('Balance refresh error:', error);
      toast({
        title: "Refresh Failed", 
        description: "Unable to refresh balance. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Button
      onClick={handleRefreshBalance}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh Balance'}
    </Button>
  );
};