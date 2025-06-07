import { QueryClient } from "@tanstack/react-query";

// Production-ready query client with comprehensive error handling
export const productionQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchInterval: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      throwOnError: false,
      queryFn: async ({ queryKey, signal }) => {
        const url = queryKey[0] as string;
        
        try {
          const response = await fetch(url, {
            signal,
            credentials: 'include',
            headers: { 
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
            error.status = response.status;
            error.statusText = response.statusText;
            throw error;
          }
          
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          }
          
          return await response.text();
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          
          // Log error for monitoring but don't expose details
          console.error('Query error:', { url, error: error instanceof Error ? error.message : 'Unknown error' });
          throw error;
        }
      }
    },
    mutations: {
      retry: false,
      throwOnError: false,
      onError: (error, variables, context) => {
        console.error('Mutation error:', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }
});

// Production error boundary for query client
productionQueryClient.setMutationDefaults(['default'], {
  mutationFn: async (variables: any) => {
    throw new Error('Mutation function not implemented');
  },
  onError: (error) => {
    console.error('Default mutation error:', error);
  }
});

export { productionQueryClient as queryClient };