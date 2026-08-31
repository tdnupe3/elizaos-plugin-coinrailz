import type { Response } from "express";

export interface ServiceError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

class ErrorHandler {
  static handleDatabaseError(error: any): ServiceError {
    // PostgreSQL specific error codes
    if (error.code === '23505') {
      return {
        message: 'Resource already exists',
        code: 'DUPLICATE_ENTRY',
        statusCode: 409
      };
    }
    
    if (error.code === '23503') {
      return {
        message: 'Referenced resource not found',
        code: 'FOREIGN_KEY_VIOLATION',
        statusCode: 400
      };
    }
    
    if (error.code === '23502') {
      return {
        message: 'Required field is missing',
        code: 'NOT_NULL_VIOLATION',
        statusCode: 400
      };
    }

    // Connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        message: 'Database connection failed',
        code: 'DATABASE_UNAVAILABLE',
        statusCode: 503
      };
    }

    // Generic database error
    return {
      message: 'Database operation failed',
      code: 'DATABASE_ERROR',
      statusCode: 500,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }

  static handleValidationError(error: any): ServiceError {
    if (error.name === 'ZodError') {
      return {
        message: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: error.errors
      };
    }

    return {
      message: error.message || 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400
    };
  }

  static handleComplianceError(error: any): ServiceError {
    return {
      message: 'Transaction blocked by compliance screening',
      code: 'COMPLIANCE_BLOCKED',
      statusCode: 403,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }

  static handleInsufficientFunds(): ServiceError {
    return {
      message: 'Insufficient balance for this transaction',
      code: 'INSUFFICIENT_FUNDS',
      statusCode: 400
    };
  }

  static sendErrorResponse(res: Response, error: ServiceError): void {
    const statusCode = error.statusCode || 500;
    const response: any = {
      success: false,
      message: error.message,
      code: error.code
    };

    if (error.details && process.env.NODE_ENV === 'development') {
      response.details = error.details;
    }

    res.status(statusCode).json(response);
  }

  static async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    res: Response,
    operationName: string = 'operation'
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error: any) {
      console.error(`${operationName} failed:`, error);

      let serviceError: ServiceError;

      if (error.code && error.code.startsWith('23')) {
        serviceError = this.handleDatabaseError(error);
      } else if (error.name === 'ZodError') {
        serviceError = this.handleValidationError(error);
      } else if (error.message?.includes('compliance') || error.message?.includes('blocked')) {
        serviceError = this.handleComplianceError(error);
      } else if (error.message?.includes('insufficient') || error.message?.includes('balance')) {
        serviceError = this.handleInsufficientFunds();
      } else {
        serviceError = {
          message: `${operationName} failed`,
          code: 'INTERNAL_ERROR',
          statusCode: 500
        };
      }

      this.sendErrorResponse(res, serviceError);
      return null;
    }
  }
}