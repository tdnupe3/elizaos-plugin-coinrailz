import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@shared/schema";
import { handleAuthError, getStoredUser, storeUser, clearStoredUser } from "@/lib/authUtils";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
    initialData: () => getStoredUser(),
  });

  // Handle authentication state changes
  if (user && !error) {
    storeUser(user);
  } else if (error && handleAuthError(error as Error)) {
    clearStoredUser();
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    authError: error,
  };
}
