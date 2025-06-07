broadcastToUser(userId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
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