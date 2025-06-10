
/**
 * Response Compression Optimizer
 * Implements intelligent compression for faster response times
 */

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

export class CompressionOptimizer {
  /**
   * Create optimized compression middleware
   */
  static createCompressionMiddleware() {
    return compression({
      // Compress responses larger than 1KB
      threshold: 1024,
      
      // Compression level (1-9, 6 is good balance)
      level: 6,
      
      // Memory level (1-9, 8 is good for performance)
      memLevel: 8,
      
      // Custom filter for what to compress
      filter: (req: Request, res: Response) => {
        // Don't compress if disabled
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Compress by default for text-based content
        return compression.filter(req, res);
      },
      
      // Custom compression strategy
      strategy: require('zlib').constants.Z_DEFAULT_STRATEGY
    });
  }

  /**
   * Intelligent content-type based compression
   */
  static shouldCompress(contentType: string): boolean {
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml'
    ];
    
    return compressibleTypes.some(type => contentType.includes(type));
  }

  /**
   * Header optimization for better caching
   */
  static optimizeHeaders(req: Request, res: Response, next: NextFunction): void {
    // Set optimal cache headers for static content
    if (req.url.includes('.js') || req.url.includes('.css') || req.url.includes('.png')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    }
    
    // Set compression headers
    res.setHeader('Vary', 'Accept-Encoding');
    
    // Enable HTTP/2 server push hints
    res.setHeader('Link', '</static/main.js>; rel=preload; as=script');
    
    next();
  }
}
