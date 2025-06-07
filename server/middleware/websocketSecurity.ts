/**
 * WebSocket Security Middleware
 * Prevents message flooding and unauthorized access
 */

import WebSocket from 'ws';
import { IncomingMessage } from 'http';

interface WebSocketSession {
  messageCount: number;
  lastReset: number;
  isAuthenticated: boolean;
  userId?: string;
}

export class WebSocketSecurity {
  private static sessions = new Map<WebSocket, WebSocketSession>();
  private static readonly MESSAGE_LIMIT = 100; // messages per minute
  private static readonly RATE_WINDOW = 60000; // 1 minute

  /**
   * Initialize WebSocket security for a connection
   */
  static initializeConnection(ws: WebSocket, request: IncomingMessage): boolean {
    try {
      // Extract authentication from headers or query
      const token = this.extractAuthToken(request);
      const isAuthenticated = this.validateAuthToken(token);

      this.sessions.set(ws, {
        messageCount: 0,
        lastReset: Date.now(),
        isAuthenticated,
        userId: isAuthenticated ? this.getUserIdFromToken(token) : undefined
      });

      // Set up connection cleanup
      ws.on('close', () => {
        this.sessions.delete(ws);
      });

      // Set up message rate limiting
      ws.on('message', (data) => {
        if (!this.checkMessageRate(ws)) {
          ws.close(1008, 'Rate limit exceeded');
          return;
        }
      });

      return true;
    } catch (error) {
      console.error('WebSocket security initialization failed:', error);
      return false;
    }
  }

  /**
   * Check message rate limits
   */
  private static checkMessageRate(ws: WebSocket): boolean {
    const session = this.sessions.get(ws);
    if (!session) return false;

    const now = Date.now();
    
    // Reset counter if window expired
    if (now - session.lastReset > this.RATE_WINDOW) {
      session.messageCount = 0;
      session.lastReset = now;
    }

    session.messageCount++;

    // Check rate limit
    if (session.messageCount > this.MESSAGE_LIMIT) {
      console.warn(`WebSocket rate limit exceeded for ${session.userId || 'anonymous'}`);
      return false;
    }

    return true;
  }

  /**
   * Extract authentication token from request
   */
  private static extractAuthToken(request: IncomingMessage): string | null {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token') || request.headers.authorization;
    
    if (token && token.startsWith('Bearer ')) {
      return token.substring(7);
    }
    
    return token || null;
  }

  /**
   * Validate authentication token
   */
  private static validateAuthToken(token: string | null): boolean {
    if (!token) return false;
    
    // In production, implement JWT validation
    // For now, basic validation
    return token.length > 20 && !token.includes('fake');
  }

  /**
   * Extract user ID from token
   */
  private static getUserIdFromToken(token: string | null): string | undefined {
    if (!token) return undefined;
    
    // In production, decode JWT to extract user ID
    // For now, return a placeholder
    return 'user_' + token.substring(0, 8);
  }

  /**
   * Check if WebSocket is authenticated
   */
  static isAuthenticated(ws: WebSocket): boolean {
    const session = this.sessions.get(ws);
    return session?.isAuthenticated || false;
  }

  /**
   * Get user ID for WebSocket connection
   */
  static getUserId(ws: WebSocket): string | undefined {
    const session = this.sessions.get(ws);
    return session?.userId;
  }

  /**
   * Broadcast message with authentication check
   */
  static secureBroadcast(
    wss: WebSocket.Server,
    message: any,
    requireAuth: boolean = true
  ): void {
    const messageStr = JSON.stringify(message);
    
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const session = this.sessions.get(ws);
        
        if (!requireAuth || session?.isAuthenticated) {
          ws.send(messageStr);
        }
      }
    });
  }

  /**
   * Send message to specific user
   */
  static sendToUser(
    wss: WebSocket.Server,
    userId: string,
    message: any
  ): boolean {
    const messageStr = JSON.stringify(message);
    let sent = false;
    
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        const session = this.sessions.get(ws);
        
        if (session?.userId === userId) {
          ws.send(messageStr);
          sent = true;
        }
      }
    });
    
    return sent;
  }

  /**
   * Clean up inactive sessions
   */
  static cleanup(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    this.sessions.forEach((session, ws) => {
      if (now - session.lastReset > staleThreshold) {
        this.sessions.delete(ws);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Session expired');
        }
      }
    });
  }
}

export default WebSocketSecurity;