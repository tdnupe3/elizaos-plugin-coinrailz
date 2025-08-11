import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: response, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: 1,
    throwOnError: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  const authData = response as any;

  // Auto-refresh auth status periodically to maintain session
  useEffect(() => {
    const interval = setInterval(() => {
      if (authData?.success) {
        // Silently refetch to keep session alive
        queryClient.invalidateQueries({ 
          queryKey: ["/api/auth/user"],
          refetchType: 'none' // Don't trigger UI loading state
        });
      }
    }, 10 * 60 * 1000); // Every 10 minutes

    return () => clearInterval(interval);
  }, [authData?.success, queryClient]);

  // Handle session restoration from storage
  useEffect(() => {
    // Try to restore session on app startup
    if (!authData && !isLoading && !error) {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  }, [authData, isLoading, error, queryClient]);

  return {
    user: authData?.user || null,
    isLoading,
    isAuthenticated: authData?.success || false,
    kycVerified: authData?.kycVerified || false,
    kycLevel: authData?.kycLevel || 'none',
    authProvider: authData?.authProvider || 'unknown',
    features: authData?.features || {
      highLimitTransactions: false,
      internationalTransfers: false,
      advancedTrading: false,
      institutionalFeatures: false
    },
    // Add session refresh method
    refreshSession: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  };
}