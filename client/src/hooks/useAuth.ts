import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    throwOnError: false
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!(user as any)?.success,
  };
}