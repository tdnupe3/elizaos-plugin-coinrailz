import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Simple error throwing helper
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
}

// Simple query function
export const getQueryFn: <T>(options: {
  on401: "returnNull" | "throw";
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal,
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Don't throw unhandled promises - always handle errors
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Query failed: ${String(error)}`);
    }
  };

// Simplified query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Reduced retries
      retryDelay: 1000,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      throwOnError: false, // Prevent unhandled promise rejections
    },
    mutations: {
      retry: 0, // No retries for mutations
      throwOnError: false, // Prevent unhandled promise rejections
    },
  },
});

// Simple API request function
export const apiRequest = async (url: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export { queryClient };