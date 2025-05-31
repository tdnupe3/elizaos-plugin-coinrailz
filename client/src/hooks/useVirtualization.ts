import { useMemo, useState, useEffect, useRef } from 'react';

interface VirtualizationOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualizedItem<T> {
  index: number;
  item: T;
  style: React.CSSProperties;
}

export function useVirtualization<T>(
  items: T[],
  options: VirtualizationOptions
): {
  virtualItems: VirtualizedItem<T>[];
  totalHeight: number;
  containerRef: React.RefObject<HTMLDivElement>;
} {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const virtualItems = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2);

    const virtualizedItems: VirtualizedItem<T>[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      virtualizedItems.push({
        index: i,
        item: items[i],
        style: {
          position: 'absolute',
          top: i * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight,
        },
      });
    }

    return virtualizedItems;
  }, [items, scrollTop, itemHeight, containerHeight, overscan]);

  const totalHeight = items.length * itemHeight;

  return {
    virtualItems,
    totalHeight,
    containerRef,
  };
}