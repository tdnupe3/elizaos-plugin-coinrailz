import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Simple error throwing helper
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
}

// Helper to get auth token from localStorage - updated for session-based auth
const getAuthToken = () => {
  try {
    // First check for standard auth token
    const authToken = localStorage.getItem('auth_token');
    if (authToken) return authToken;
    
    // Check for coinrailz session-based auth
    const sessionData = localStorage.getItem('coinrailz_user_session');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session.isAuthenticated) {
        return 'demo-token'; // Demo token for authenticated users
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Simple query function with authentication
export const getQueryFn: <T>(options: {
  on401: "returnNull" | "throw";
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    try {
      const headers: Record<string, string> = {};
      const authToken = getAuthToken();
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // Handle dynamic URLs for balance checks
      let requestUrl = queryKey[0] as string;
      if (queryKey.length > 1 && requestUrl.includes('/api/balance-check')) {
        requestUrl = `${requestUrl}/${queryKey[1]}`;
      }
      
      const res = await fetch(requestUrl, {
        credentials: "include",
        signal,
        headers,
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

// Simplified query client with comprehensive error handling
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      retry: false, // No retries to prevent multiple failed attempts
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000,
      throwOnError: false, // Prevent unhandled promise rejections
    },
    mutations: {
      retry: false, // No retries for mutations
      throwOnError: false, // Prevent unhandled promise rejections
    },
  },
});

// Simple API request function with authentication
export const apiRequest = async (
  methodOrUrl: string, 
  urlOrOptions?: string | RequestInit, 
  data?: any
): Promise<any> => {
  let url: string;
  let options: RequestInit;

  // Get auth token
  const authToken = getAuthToken();
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    baseHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  // Handle both signatures: (url, options) and (method, url, data)
  if (typeof urlOrOptions === 'string') {
    // Three-argument signature: (method, url, data)
    const method = methodOrUrl;
    url = urlOrOptions;
    options = {
      method,
      headers: baseHeaders as HeadersInit,
      ...(data && { body: JSON.stringify(data) })
    };
  } else {
    // Two-argument signature: (url, options)
    url = methodOrUrl;
    const existingOptions = urlOrOptions || {};
    const existingHeaders = existingOptions.headers || {};
    options = {
      ...existingOptions,
      headers: { ...baseHeaders, ...existingHeaders } as HeadersInit
    };
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Request failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

