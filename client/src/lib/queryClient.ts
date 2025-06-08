import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    // Convert all fetch errors to proper Error objects to prevent unhandled rejections
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Request failed: ${String(error)}`);
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal: AbortSignal.timeout(15000), // 15 second timeout for queries
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Handle network errors, timeouts, and other fetch failures
      if (error instanceof Error) {
        // Log error for debugging but don't expose sensitive info
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Network connection error - please check your connection');
        }
        throw error;
      }
      throw new Error(`Query failed: ${String(error)}`);
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchIntervalInBackground: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention
      retry: false,
      networkMode: 'online',
      throwOnError: false, // Prevent throwing errors to component level
    },
    mutations: {
      retry: false,
      networkMode: 'online',
      throwOnError: false, // Prevent throwing errors to component level
    },
  },

});
