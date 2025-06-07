import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

/**
 * Custom hook that wraps useQuery with comprehensive error handling
 * and automatic cleanup to prevent unhandled promise rejections
 */
export function useStableQuery<TData = unknown>(
  queryKey: string[],
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const safeQueryFn = async () => {
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(queryKey[0], {
        signal: abortControllerRef.current.signal,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      // Handle abort errors silently
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      return null;
    }
  };

  return useQuery({
    queryKey,
    queryFn: safeQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    throwOnError: false,
    ...options,
  });
}