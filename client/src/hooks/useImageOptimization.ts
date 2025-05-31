import { useEffect, useState, useRef } from 'react';

interface ImageOptimizationOptions {
  lazy?: boolean;
  quality?: number;
  placeholder?: string;
  sizes?: string;
}

interface ImageState {
  loaded: boolean;
  error: boolean;
  src: string;
}

export function useImageOptimization(
  originalSrc: string,
  options: ImageOptimizationOptions = {}
) {
  const { lazy = true, placeholder = '', quality = 85 } = options;
  const [imageState, setImageState] = useState<ImageState>({
    loaded: false,
    error: false,
    src: placeholder,
  });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!lazy) {
      loadImage(originalSrc);
      return;
    }

    // Set up intersection observer for lazy loading
    if ('IntersectionObserver' in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              loadImage(originalSrc);
              observerRef.current?.disconnect();
            }
          });
        },
        { rootMargin: '50px' }
      );

      if (imgRef.current) {
        observerRef.current.observe(imgRef.current);
      }
    } else {
      // Fallback for browsers without IntersectionObserver
      loadImage(originalSrc);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [originalSrc, lazy]);

  const loadImage = (src: string) => {
    const img = new Image();
    
    img.onload = () => {
      setImageState({
        loaded: true,
        error: false,
        src: src,
      });
    };

    img.onerror = () => {
      setImageState({
        loaded: false,
        error: true,
        src: placeholder,
      });
    };

    img.src = src;
  };

  const imgProps = {
    ref: imgRef,
    src: imageState.src,
    style: {
      transition: 'opacity 0.3s ease-in-out',
      opacity: imageState.loaded ? 1 : 0.7,
    },
  };

  return {
    ...imageState,
    imgProps,
  };
}

// Preload critical images
export function useImagePreloader(imageSources: string[]) {
  const [preloadedCount, setPreloadedCount] = useState(0);

  useEffect(() => {
    let loadedCount = 0;

    const preloadPromises = imageSources.map((src) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setPreloadedCount(loadedCount);
          resolve();
        };
        img.onerror = reject;
        img.src = src;
      });
    });

    Promise.allSettled(preloadPromises);
  }, [imageSources]);

  return {
    preloadedCount,
    totalImages: imageSources.length,
    isComplete: preloadedCount === imageSources.length,
  };
}

// WebP support detection and fallback
export function useWebPSupport() {
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebPSupport = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      const dataURL = canvas.toDataURL('image/webp');
      const isWebPSupported = dataURL.startsWith('data:image/webp');
      
      setSupportsWebP(isWebPSupported);
    };

    checkWebPSupport();
  }, []);

  const getOptimizedSrc = (baseSrc: string, fallbackSrc?: string) => {
    if (supportsWebP === null) return baseSrc; // Still checking
    
    if (supportsWebP && baseSrc.includes('.')) {
      // Replace extension with .webp for better compression
      const webpSrc = baseSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      return webpSrc;
    }
    
    return fallbackSrc || baseSrc;
  };

  return {
    supportsWebP,
    getOptimizedSrc,
  };
}