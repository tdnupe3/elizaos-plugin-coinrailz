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
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
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

// Enhanced error handling for React Query operations
queryClient.setMutationDefaults(['default'], {
  mutationFn: async (variables) => {
    try {
      return variables;
    } catch (error) {
      console.error('Mutation error caught:', error);
      throw error;
    }
  },
});

// Handle promise rejections at the query level
const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);
queryClient.invalidateQueries = async (...args) => {
  try {
    return await originalInvalidateQueries(...args);
  } catch (error) {
    console.error('Query invalidation error caught:', error);
    return Promise.resolve();
  }
};
