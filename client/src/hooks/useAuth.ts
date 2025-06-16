import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@shared/schema";
import { handleAuthError, getStoredUser, storeUser, clearStoredUser } from "@/lib/authUtils";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    initialData: () => getStoredUser(),
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
        });
        
        // Handle 401 as expected behavior, not an error
        if (res.status === 401) {
          clearStoredUser();
          return null;
        }
        
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status}: ${text}`);
        }
        
        const data = await res.json();
        const userData = data.success ? data.user : null;
        if (userData) {
          storeUser(userData);
        }
        return userData;
      } catch (error) {
        // Handle network errors gracefully - don't throw, return null
        console.warn('Auth check failed:', error);
        clearStoredUser();
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    authError: error,
  };
}
