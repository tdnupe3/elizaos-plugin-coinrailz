/**
 * Performance Optimization Hooks
 * Implements lazy loading, memoization, and efficient re-rendering
 */

import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Debounced value hook for search inputs
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Optimized API query with intelligent caching
 */
export function useOptimizedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    refetchOnWindowFocus?: boolean;
  } = {}
) {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: options.staleTime || 5 * 60 * 1000, // 5 minutes
    gcTime: options.cacheTime || 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: options.refetchOnWindowFocus || false,
  });
}

/**
 * Virtual scrolling for large lists
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return { visibleItems, onScroll };
}

/**
 * Intersection Observer for lazy loading
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref, options]);

  return isIntersecting;
}

/**
 * Memory-efficient data transformation
 */
export function useMemoizedComputation<T, R>(
  data: T,
  computeFn: (data: T) => R,
  deps: React.DependencyList = []
): R {
  return useMemo(() => {
    if (!data) return null as R;
    return computeFn(data);
  }, [data, ...deps]);
}

/**
 * Optimized event handlers to prevent unnecessary re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args) => {
    return callbackRef.current(...args);
  }) as T, []);
}

/**
 * Batch state updates for better performance
 */
export function useBatchedState<T>(initialState: T) {
  const [state, setState] = React.useState(initialState);
  const batchedUpdates = useRef<Partial<T>[]>([]);

  const batchUpdate = useCallback((update: Partial<T>) => {
    batchedUpdates.current.push(update);
    
    // Process batch on next tick
    setTimeout(() => {
      if (batchedUpdates.current.length > 0) {
        const merged = batchedUpdates.current.reduce(
          (acc, update) => ({ ...acc, ...update }),
          {} as Partial<T>
        );
        setState(prev => ({ ...prev, ...merged }));
        batchedUpdates.current = [];
      }
    }, 0);
  }, []);

  return [state, batchUpdate] as const;
}