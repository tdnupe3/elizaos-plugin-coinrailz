import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: response, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    throwOnError: false
  });

  const authData = response as any;

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
    }
  };
}