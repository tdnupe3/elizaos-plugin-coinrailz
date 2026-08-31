import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiKeyValue } from "./apiKeyStorage";

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
      
      // Auto-include stored API key for satellite/IoT/x402 endpoints
      const apiKey = getApiKeyValue();
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
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
  urlOrOptions?: string | ApiRequestOptions,
  data?: unknown
): Promise<any> => {
  let url: string;
  let options: RequestInit;

  // Get auth token and API key
  const authToken = getAuthToken();
  const apiKey = getApiKeyValue();
  const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    baseHeaders['Authorization'] = `Bearer ${authToken}`;
  }
  if (apiKey) {
    baseHeaders['X-API-Key'] = apiKey;
  }

  // Handle both signatures: (url, options) and (method, url, data)
  if (typeof urlOrOptions === 'string') {
    // Three-argument signature: (method, url, data)
    const method = methodOrUrl;
    url = urlOrOptions;
    options = {
      method,
      headers: baseHeaders as HeadersInit,
      body: data === undefined ? undefined : JSON.stringify(data),
    };
  } else {
    // Two-argument signature: (url, options)
    url = methodOrUrl;
    const existingOptions = urlOrOptions || {};
    const existingHeaders = existingOptions.headers || {};
    const requestBody = existingOptions.body;
    options = {
      ...existingOptions,
      headers: { ...baseHeaders, ...existingHeaders } as HeadersInit,
      body: isJsonPayload(requestBody) ? JSON.stringify(requestBody) : requestBody,
    };
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `Request failed with status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        }
      } catch (_) {}
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_) {
      throw new Error('Server returned an unexpected response. Please try again.');
    }
  } catch (error) {
    throw error;
  }
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
};

function isJsonPayload(value: ApiRequestOptions["body"]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" &&
    !(value instanceof Blob) &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof ReadableStream);
}

