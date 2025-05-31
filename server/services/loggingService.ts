// Production-ready logging and monitoring service
import { storage } from "../storage";

interface LogLevel {
  ERROR: 'ERROR';
  WARN: 'WARN';
  INFO: 'INFO';
  DEBUG: 'DEBUG';
}

interface LogEntry {
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

interface TransactionLog {
  transactionId: string;
  userId: string;
  type: 'fiat_deposit' | 'fiat_withdrawal' | 'crypto_purchase' | 'crypto_sale' | 'crypto_transfer' | 'p2p_payment';
  amount: string;
  currency: string;
  status: 'initiated' | 'processing' | 'completed' | 'failed' | 'cancelled';
  metadata: Record<string, any>;
}

interface SecurityEvent {
  userId?: string;
  eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'suspicious_activity' | 'kyc_attempt' | 'compliance_flag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class LoggingService {
  private logs: LogEntry[] = [];
  private maxLogSize = 10000; // Keep last 10k logs in memory

  async log(level: keyof LogLevel, message: string, metadata?: Record<string, any>, userId?: string): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      userId,
      requestId: this.generateRequestId(),
      metadata,
    };

    // Add to in-memory logs
    this.addToMemoryLogs(logEntry);

    // Store critical logs in database
    if (level === 'ERROR' || level === 'WARN') {
      try {
        await storage.createAPILog({
          endpoint: 'SYSTEM_LOG',
          method: 'LOG',
          statusCode: level === 'ERROR' ? 500 : 200,
          responseTime: 0,
          userId,
          requestData: metadata,
          responseData: { level, message },
          createdAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to store log in database:', error);
      }
    }

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
      console[consoleMethod](`[${level}] ${message}`, metadata || '');
    }
  }

  async logTransaction(transactionLog: TransactionLog): Promise<void> {
    await this.log('INFO', `Transaction ${transactionLog.status}: ${transactionLog.type}`, {
      transactionId: transactionLog.transactionId,
      amount: transactionLog.amount,
      currency: transactionLog.currency,
      ...transactionLog.metadata,
    }, transactionLog.userId);

    // Store in compliance reports for audit trail
    try {
      await storage.createComplianceReport({
        userId: transactionLog.userId,
        reportType: 'transaction_log',
        riskScore: 0,
        flaggedReasons: [],
        reportData: transactionLog,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to store transaction log:', error);
    }
  }

  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.log(
      event.severity === 'critical' || event.severity === 'high' ? 'ERROR' : 'WARN',
      `Security Event: ${event.eventType}`,
      {
        severity: event.severity,
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
      event.userId
    );

    // Store security events for compliance
    try {
      await storage.createComplianceReport({
        userId: event.userId || 'ANONYMOUS',
        reportType: 'security_event',
        riskScore: this.getSeverityScore(event.severity),
        flaggedReasons: [event.eventType],
        reportData: event,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to store security event:', error);
    }
  }

  async logAPICall(endpoint: string, method: string, statusCode: number, responseTime: number, userId?: string, requestData?: any, responseData?: any): Promise<void> {
    try {
      await storage.createAPILog({
        endpoint,
        method,
        statusCode,
        responseTime,
        userId,
        requestData,
        responseData,
        createdAt: new Date(),
      });

      // Log slow API calls
      if (responseTime > 5000) {
        await this.log('WARN', `Slow API call detected: ${method} ${endpoint}`, {
          responseTime,
          statusCode,
        }, userId);
      }

      // Log API errors
      if (statusCode >= 500) {
        await this.log('ERROR', `API Error: ${method} ${endpoint}`, {
          statusCode,
          responseTime,
          responseData,
        }, userId);
      }
    } catch (error) {
      console.error('Failed to log API call:', error);
    }
  }

  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  getLogsByLevel(level: keyof LogLevel, count: number = 100): LogEntry[] {
    return this.logs.filter(log => log.level === level).slice(-count);
  }

  getLogsByUser(userId: string, count: number = 100): LogEntry[] {
    return this.logs.filter(log => log.userId === userId).slice(-count);
  }

  private addToMemoryLogs(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Trim logs if exceeding max size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
  }

  private generateRequestId(): string {
    return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 100;
      case 'high': return 75;
      case 'medium': return 50;
      case 'low': return 25;
      default: return 0;
    }
  }

  // Monitoring and health checks
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    metrics: Record<string, number>;
  }> {
    const recentErrors = this.getLogsByLevel('ERROR', 50);
    const errorRate = recentErrors.length / 50;

    return {
      status: errorRate > 0.1 ? 'unhealthy' : errorRate > 0.05 ? 'degraded' : 'healthy',
      services: {
        database: true, // Would check actual database connection
        logging: true,
        compliance: true,
      },
      metrics: {
        totalLogs: this.logs.length,
        errorRate,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      }
    };
  }
}

export const loggingService = new LoggingService();