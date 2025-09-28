import { useState, useCallback } from 'react';

// Optimized image component with lazy loading and WebP support
interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

export function OptimizedImage({ 
  src, 
  alt, 
  className = '', 
  width, 
  height, 
  priority = false,
  objectFit = 'cover'
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleLoad = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setImageError(true);
    setImageLoading(false);
    // Fallback to original if WebP fails
    if (imageSrc.includes('.webp')) {
      setImageSrc(src);
    }
  }, [src, imageSrc]);

  // Generate WebP version if not already WebP
  const webpSrc = src.includes('.webp') ? src : src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {imageLoading && (
        <div 
          className="absolute inset-0 bg-slate-200 dark:bg-slate-700 animate-pulse"
          style={{ width, height }}
        />
      )}
      
      <picture>
        {/* WebP version for modern browsers */}
        <source srcSet={webpSrc} type="image/webp" />
        
        {/* Fallback to original format */}
        <img
          src={imageSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          } ${imageError ? 'hidden' : ''}`}
          style={{ 
            width: width || '100%', 
            height: height || 'auto',
            objectFit 
          }}
          loading={priority ? 'eager' : 'lazy'}
          onLoad={handleLoad}
          onError={handleError}
          width={width}
          height={height}
        />
      </picture>
      
      {imageError && (
        <div 
          className="absolute inset-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 text-sm"
          style={{ width, height }}
        >
          Image unavailable
        </div>
      )}
    </div>
  );
}

// Component to add missing alt tags to existing images
export function EnhanceImageSEO() {
  // This component adds proper alt tags to existing images for SEO
  const enhanceImages = () => {
    if (typeof window === 'undefined') return;
    
    const images = document.querySelectorAll('img:not([alt]), img[alt=""]');
    
    images.forEach((img) => {
      const src = img.getAttribute('src') || '';
      const fileName = src.split('/').pop()?.split('.')[0] || '';
      
      // Generate meaningful alt text based on context
      let altText = '';
      
      if (src.includes('logo')) {
        altText = 'Coin Railz Logo - AI-Powered Fintech Platform';
      } else if (src.includes('icon')) {
        altText = `${fileName} icon for crypto payment feature`;
      } else if (src.includes('crypto') || src.includes('usdc') || src.includes('xrp')) {
        altText = `Cryptocurrency ${fileName} icon for digital payments`;
      } else if (src.includes('ai') || src.includes('agent')) {
        altText = `AI agent ${fileName} for automated trading services`;
      } else {
        altText = `${fileName} - Coin Railz fintech platform feature`;
      }
      
      img.setAttribute('alt', altText);
    });
  };

  // Run enhancement after DOM is loaded
  if (typeof window !== 'undefined') {
    setTimeout(enhanceImages, 500);
  }

  return null;
}