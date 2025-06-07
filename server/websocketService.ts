import WebSocket, { WebSocketServer } from "ws";

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId?: string;
}

class WebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private wss: WebSocketServer | null = null;

  initialize(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws: ws
      };

      this.clients.set(clientId, client);
      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    console.log('WebSocket server initialized on /ws');
  }

  private generateClientId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private handleMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'auth':
        client.userId = data.userId;
        this.clients.set(clientId, client);
        break;
      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  broadcastToUser(userId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Send message to specific user (for notification service compatibility)
  async sendToUser(userId: string, message: any): Promise<void> {
    this.broadcastToUser(userId, message);
  }

  // Broadcast message to all connected clients
  async broadcast(message: any): Promise<void> {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Send notification to specific user
  sendNotification(userId: string, notification: any) {
    this.broadcastToUser(userId, {
      type: 'notification',
      data: notification,
      timestamp: Date.now()
    });
  }

  // Send security alert to user
  sendSecurityAlert(userId: string, alert: any) {
    this.broadcastToUser(userId, {
      type: 'security_alert',
      data: alert,
      timestamp: Date.now(),
      priority: 'high'
    });
  }

  // Broadcast crypto price updates
  broadcastPriceUpdate(priceData: any) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'price_update',
          data: priceData,
          timestamp: Date.now()
        }));
      }
    });
  }

  // Send AI agent activity update
  sendAgentUpdate(userId: string, agentData: any) {
    this.broadcastToUser(userId, {
      type: 'agent_update',
      data: agentData,
      timestamp: Date.now()
    });
  }

  // Send transaction status update
  sendTransactionUpdate(userId: string, transactionData: any) {
    this.broadcastToUser(userId, {
      type: 'transaction_update',
      data: transactionData,
      timestamp: Date.now()
    });
  }

  // Send referral reward notification
  sendReferralReward(userId: string, rewardData: any) {
    this.broadcastToUser(userId, {
      type: 'referral_reward',
      data: rewardData,
      timestamp: Date.now(),
      priority: 'medium'
    });
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  getUserConnections(userId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.userId === userId) count++;
    });
    return count;
  }
}

export const websocketService = new WebSocketService();
export { WebSocketService };