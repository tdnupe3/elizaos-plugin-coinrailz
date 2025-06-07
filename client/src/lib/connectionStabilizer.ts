/**
 * Production Connection Stabilizer
 * Manages network connectivity and API resilience for production deployment
 */

interface ConnectionState {
  isOnline: boolean;
  isStable: boolean;
  lastConnectedAt: number;
  reconnectAttempts: number;
  apiHealth: Record<string, boolean>;
}

class ConnectionStabilizer {
  private state: ConnectionState = {
    isOnline: true,
    isStable: true,
    lastConnectedAt: Date.now(),
    reconnectAttempts: 0,
    apiHealth: {}
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private eventListeners: Array<(state: ConnectionState) => void> = [];

  constructor() {
    this.initializeConnectionMonitoring();
    this.startHealthChecks();
  }

  private initializeConnectionMonitoring(): void {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.updateConnectionState({ isOnline: true, reconnectAttempts: 0 });
      this.attemptReconnection();
    });

    window.addEventListener('offline', () => {
      this.updateConnectionState({ isOnline: false, isStable: false });
    });

    // Monitor visibility changes for mobile/tab switching
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.state.isOnline) {
        this.performHealthCheck();
      }
    });
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.warn('Connection state listener error:', error);
      }
    });
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private async performHealthCheck(): Promise<void> {
    const endpoints = [
      '/api/system/health',
      '/api/crypto/prices'
    ];

    const healthResults: Record<string, boolean> = {};
    let overallHealth = true;

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        healthResults[endpoint] = response.ok;
        if (!response.ok) overallHealth = false;
      } catch (error) {
        healthResults[endpoint] = false;
        overallHealth = false;
      }
    }

    this.updateConnectionState({
      isStable: overallHealth,
      apiHealth: healthResults,
      lastConnectedAt: overallHealth ? Date.now() : this.state.lastConnectedAt
    });

    if (!overallHealth && this.state.isOnline) {
      this.scheduleReconnection();
    }
  }

  private scheduleReconnection(): void {
    if (this.reconnectTimeout) return;

    const delay = Math.min(1000 * Math.pow(2, this.state.reconnectAttempts), 30000);
    
    this.reconnectTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  private async attemptReconnection(): Promise<void> {
    this.reconnectTimeout = null;
    
    if (this.state.reconnectAttempts > 5) {
      // Stop aggressive reconnection after 5 attempts
      return;
    }

    this.updateConnectionState({
      reconnectAttempts: this.state.reconnectAttempts + 1
    });

    await this.performHealthCheck();

    if (!this.state.isStable) {
      this.scheduleReconnection();
    }
  }

  public subscribe(listener: (state: ConnectionState) => void): () => void {
    this.eventListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  public getState(): ConnectionState {
    return { ...this.state };
  }

  public forceHealthCheck(): Promise<void> {
    return this.performHealthCheck();
  }

  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.eventListeners = [];
  }
}

// Create singleton instance
export const connectionStabilizer = new ConnectionStabilizer();

// React hook for connection state
import { useState, useEffect } from 'react';

export function useConnectionState() {
  const [state, setState] = useState(connectionStabilizer.getState());

  useEffect(() => {
    const unsubscribe = connectionStabilizer.subscribe(setState);
    return unsubscribe;
  }, []);

  return state;
}

// Production-ready fetch wrapper with automatic retry
export async function stableFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  const maxRetries = 3;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}