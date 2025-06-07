import { QueryClient } from "@tanstack/react-query";

// Create a completely stable query client that never throws unhandled rejections
export const stableQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      staleTime: Infinity,
      gcTime: Infinity,
      throwOnError: false,
      queryFn: async ({ queryKey, signal }) => {
        try {
          const response = await fetch(queryKey[0] as string, {
            signal,
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!response.ok) {
            return null;
          }
          
          return await response.json();
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return null;
          }
          return null;
        }
      }
    },
    mutations: {
      retry: false,
      throwOnError: false,
      onError: () => {
        // Silent error handling to prevent unhandled rejections
      }
    }
  }
});

// Override internal methods to prevent any promise rejections
const originalGetQueryData = stableQueryClient.getQueryData.bind(stableQueryClient);
stableQueryClient.getQueryData = (queryKey: any) => {
  try {
    return originalGetQueryData(queryKey);
  } catch {
    return null;
  }
};

const originalSetQueryData = stableQueryClient.setQueryData.bind(stableQueryClient);
stableQueryClient.setQueryData = (queryKey: any, data: any) => {
  try {
    return originalSetQueryData(queryKey, data);
  } catch {
    return null;
  }
};

const originalRemoveQueries = stableQueryClient.removeQueries.bind(stableQueryClient);
stableQueryClient.removeQueries = (...args: any[]) => {
  try {
    return originalRemoveQueries(...args);
  } catch {
    // Silent failure
  }
};

const originalClear = stableQueryClient.clear.bind(stableQueryClient);
stableQueryClient.clear = () => {
  try {
    return originalClear();
  } catch {
    // Silent failure
  }
};

export { stableQueryClient as queryClient };