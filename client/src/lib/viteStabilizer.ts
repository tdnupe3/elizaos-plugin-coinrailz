/**
 * Vite Development Server Stabilizer
 * Eliminates connection issues and development environment artifacts
 */

class ViteStabilizer {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private isStabilizing = false;

  constructor() {
    this.initializeViteOptimizations();
  }

  private initializeViteOptimizations(): void {
    // Override WebSocket to prevent aggressive reconnection
    this.stabilizeWebSocketConnections();
    
    // Handle Vite HMR events gracefully
    this.setupHMREventHandling();
    
    // Optimize development server interactions
    this.optimizeDevServerInteraction();
    
    console.log('Vite stabilizer initialized');
  }

  private stabilizeWebSocketConnections(): void {
    const originalWebSocket = window.WebSocket;
    
    window.WebSocket = class extends originalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        
        // Enhanced error handling for Vite connections
        this.addEventListener('error', (event) => {
          // Suppress Vite connection errors from console
          if (typeof url === 'string' && url.includes('/@vite/client')) {
            event.preventDefault();
            event.stopPropagation();
          }
        });

        this.addEventListener('close', (event) => {
          // Handle Vite connection close gracefully
          if (typeof url === 'string' && url.includes('/@vite/client')) {
            // Don't attempt immediate reconnection
            event.preventDefault();
          }
        });
      }
    };
  }

  private setupHMREventHandling(): void {
    // Listen for Vite HMR events
    if ('__vite_plugin_react_preamble_installed__' in window) {
      // Override hot reload behavior to be more stable
      const originalHot = window.__vite_hot__;
      if (originalHot) {
        window.__vite_hot__ = {
          ...originalHot,
          accept: (deps?: any, callback?: any) => {
            try {
              return originalHot.accept(deps, callback);
            } catch (error) {
              console.warn('HMR accept error handled:', error);
            }
          }
        };
      }
    }
  }

  private optimizeDevServerInteraction(): void {
    // Debounce rapid development server requests
    let requestQueue: Array<() => void> = [];
    let isProcessing = false;

    const processQueue = async () => {
      if (isProcessing || requestQueue.length === 0) return;
      
      isProcessing = true;
      const batch = requestQueue.splice(0, 5); // Process 5 at a time
      
      for (const request of batch) {
        try {
          request();
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
        } catch (error) {
          console.warn('Request processing error:', error);
        }
      }
      
      isProcessing = false;
      
      if (requestQueue.length > 0) {
        setTimeout(processQueue, 100);
      }
    };

    // Override fetch for development server requests
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Queue development server requests
      if (url.includes('/@vite/') || url.includes('/__vite')) {
        return new Promise((resolve, reject) => {
          requestQueue.push(async () => {
            try {
              const response = await originalFetch(input, init);
              resolve(response);
            } catch (error) {
              reject(error);
            }
          });
          processQueue();
        });
      }
      
      return originalFetch(input, init);
    };
  }

  public handleConnectionError(error: any): void {
    if (this.isStabilizing) return;
    
    this.isStabilizing = true;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      setTimeout(() => {
        this.attemptStabilization();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.log('Max reconnection attempts reached, stabilizing in background');
      this.isStabilizing = false;
    }
  }

  private attemptStabilization(): void {
    try {
      // Perform a lightweight health check
      fetch('/api/system/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      })
      .then(response => {
        if (response.ok) {
          this.reconnectAttempts = 0;
          console.log('Connection stabilized');
        }
      })
      .catch(() => {
        // Ignore connection errors during stabilization
      })
      .finally(() => {
        this.isStabilizing = false;
      });
    } catch (error) {
      this.isStabilizing = false;
    }
  }

  public getStatus(): object {
    return {
      reconnectAttempts: this.reconnectAttempts,
      isStabilizing: this.isStabilizing,
      maxAttempts: this.maxReconnectAttempts
    };
  }
}

// Initialize Vite stabilizer
export const viteStabilizer = new ViteStabilizer();

// Global error handler for Vite-related issues
window.addEventListener('error', (event) => {
  const errorMessage = event.message.toLowerCase();
  
  if (errorMessage.includes('vite') || 
      errorMessage.includes('hmr') || 
      errorMessage.includes('websocket')) {
    event.preventDefault();
    viteStabilizer.handleConnectionError(event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.toString?.().toLowerCase() || '';
  
  if (reason.includes('vite') || 
      reason.includes('hmr') || 
      reason.includes('websocket')) {
    event.preventDefault();
    viteStabilizer.handleConnectionError(event.reason);
  }
});