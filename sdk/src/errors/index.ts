/**
 * COINRAILZ SDK ERROR CLASSES
 * Comprehensive error handling for enterprise AI payment infrastructure
 */

export class CoinRailzError extends Error {
  public readonly code: string;
  public readonly category: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string, 
    code = 'COINRAILZ_ERROR', 
    category = 'general',
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CoinRailzError';
    this.code = code;
    this.category = category;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    const ErrorWithCapture = Error as any;
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, CoinRailzError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack
    };
  }
}

export class PaymentError extends CoinRailzError {
  public readonly paymentMethod?: string;
  public readonly transactionId?: string;
  public readonly amount?: number;

  constructor(
    message: string,
    code = 'PAYMENT_ERROR',
    context?: {
      paymentMethod?: string;
      transactionId?: string;
      amount?: number;
      [key: string]: any;
    }
  ) {
    super(message, code, 'payment', context);
    this.name = 'PaymentError';
    this.paymentMethod = context?.paymentMethod;
    this.transactionId = context?.transactionId;
    this.amount = context?.amount;
  }
}

export class LicenseError extends CoinRailzError {
  public readonly licenseKey?: string;
  public readonly tier?: string;
  public readonly expiresAt?: Date;

  constructor(
    message: string,
    code = 'LICENSE_ERROR',
    context?: {
      licenseKey?: string;
      tier?: string;
      expiresAt?: Date;
      [key: string]: any;
    }
  ) {
    super(message, code, 'license', context);
    this.name = 'LicenseError';
    this.licenseKey = context?.licenseKey;
    this.tier = context?.tier;
    this.expiresAt = context?.expiresAt;
  }
}

export class ComplianceError extends CoinRailzError {
  public readonly ruleId?: string;
  public readonly riskScore?: number;
  public readonly blockedReason?: string;

  constructor(
    message: string,
    code = 'COMPLIANCE_ERROR',
    context?: {
      ruleId?: string;
      riskScore?: number;
      blockedReason?: string;
      [key: string]: any;
    }
  ) {
    super(message, code, 'compliance', context);
    this.name = 'ComplianceError';
    this.ruleId = context?.ruleId;
    this.riskScore = context?.riskScore;
    this.blockedReason = context?.blockedReason;
  }
}

export class AgentError extends CoinRailzError {
  public readonly agentId?: string;
  public readonly capability?: string;
  public readonly endpoint?: string;

  constructor(
    message: string,
    code = 'AGENT_ERROR',
    context?: {
      agentId?: string;
      capability?: string;
      endpoint?: string;
      [key: string]: any;
    }
  ) {
    super(message, code, 'agent', context);
    this.name = 'AgentError';
    this.agentId = context?.agentId;
    this.capability = context?.capability;
    this.endpoint = context?.endpoint;
  }
}

export class NetworkError extends CoinRailzError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;
  public readonly method?: string;

  constructor(
    message: string,
    code = 'NETWORK_ERROR',
    context?: {
      statusCode?: number;
      endpoint?: string;
      method?: string;
      [key: string]: any;
    }
  ) {
    super(message, code, 'network', context);
    this.name = 'NetworkError';
    this.statusCode = context?.statusCode;
    this.endpoint = context?.endpoint;
    this.method = context?.method;
  }
}

export class ValidationError extends CoinRailzError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly constraint?: string;

  constructor(
    message: string,
    code = 'VALIDATION_ERROR',
    context?: {
      field?: string;
      value?: any;
      constraint?: string;
      [key: string]: any;
    }
  ) {
    super(message, code, 'validation', context);
    this.name = 'ValidationError';
    this.field = context?.field;
    this.value = context?.value;
    this.constraint = context?.constraint;
  }
}

export class RateLimitError extends CoinRailzError {
  public readonly limit?: number;
  public readonly resetTime?: Date;
  public readonly endpoint?: string;

  constructor(
    message: string,
    code = 'RATE_LIMIT_ERROR',
    context?: {
      limit?: number;
      resetTime?: Date;
      endpoint?: string;
      [key: string]: any;
    }
  ) {
    super(message, code, 'rate_limit', context);
    this.name = 'RateLimitError';
    this.limit = context?.limit;
    this.resetTime = context?.resetTime;
    this.endpoint = context?.endpoint;
  }
}

// Error factory functions
export function createPaymentError(
  message: string,
  paymentMethod?: string,
  transactionId?: string,
  amount?: number
): PaymentError {
  return new PaymentError(message, 'PAYMENT_FAILED', {
    paymentMethod,
    transactionId,
    amount
  });
}

export function createLicenseError(
  message: string,
  licenseKey?: string,
  tier?: string
): LicenseError {
  return new LicenseError(message, 'LICENSE_INVALID', {
    licenseKey,
    tier
  });
}

export function createComplianceError(
  message: string,
  ruleId?: string,
  riskScore?: number
): ComplianceError {
  return new ComplianceError(message, 'COMPLIANCE_VIOLATION', {
    ruleId,
    riskScore
  });
}

// Error response formatter for API calls
export function formatErrorResponse(error: CoinRailzError): {
  success: false;
  error: {
    message: string;
    code: string;
    category: string;
    timestamp: string;
    context?: Record<string, any>;
  };
} {
  return {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      category: error.category,
      timestamp: error.timestamp.toISOString(),
      context: error.context
    }
  };
}