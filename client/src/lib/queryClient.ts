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
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
      retry: false, // Disable retries completely to prevent cascade failures
      networkMode: 'online',
    },
    mutations: {
      retry: false, // Disable mutation retries
      networkMode: 'online',
    },
  },
});

// Add global mutation cache error handling
queryClient.getMutationCache().subscribe((event) => {
  if (event?.type === 'updated' && event.mutation.state.status === 'error') {
    console.error('Global mutation error:', event.mutation.state.error);
  }
});

// Add global query cache error handling  
queryClient.getQueryCache().subscribe((event) => {
  if (event?.type === 'updated' && event.query.state.status === 'error') {
    const error = event.query.state.error;
    const errorMessage = String(error?.message || error || '');
    
    // Suppress development-related connection errors
    const isDevelopmentError = ['ChromeTransport', 'connectChrome', 'WebSocket', 'vite', 'connecting'].some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (!isDevelopmentError) {
      console.error('Global query error:', error);
    }
  }
});

// Create a custom query function that never throws unhandled rejections
const safeQueryFn = async ({ queryKey, signal }: any) => {
  try {
    const response = await fetch(queryKey[0] as string, {
      signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return null; // Always return null instead of throwing
    }
    
    return await response.json();
  } catch (error) {
    return null; // Always return null instead of throwing
  }
};

// Configure React Query with comprehensive error prevention
queryClient.setDefaultOptions({
  queries: {
    queryFn: safeQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    staleTime: Infinity,
    gcTime: Infinity,
    throwOnError: false,
  },
  mutations: {
    retry: false,
    throwOnError: false,
    onError: () => {}, // Silent error handling
  },
});
