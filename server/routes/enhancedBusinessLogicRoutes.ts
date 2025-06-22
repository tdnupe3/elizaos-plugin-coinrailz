/**
 * Enhanced Business Logic Routes - Integrated Safety Mechanisms
 * All endpoints use transaction wrapper, tiered commissions, exchange protection, and safe math
 * Based on comprehensive business logic audit requirements
 */

import { Express } from 'express';
import { BusinessLogicIntegration } from '../services/businessLogicIntegration';
import { ExchangeRateProtection } from '../services/exchangeRateProtection';
import { TieredCommissionCalculator } from '../services/tieredCommissionCalculator';

export function setupEnhancedBusinessLogicRoutes(app: Express) {
  
  // Enhanced fee calculation with all safety mechanisms
  app.post('/api/send-money-fee', async (req, res) => {
    try {
      const result = BusinessLogicIntegration.calculateTransactionFee(req.body.amount);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          validation: result.validation
        });
      }

      res.json({
        success: true,
        ...result.data
      });
    } catch (error) {
      console.error('Enhanced fee calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Fee calculation service temporarily unavailable'
      });
    }
  });

  // Enhanced P2P transfer with atomic transaction protection
  app.post('/api/transfers/p2p', async (req, res) => {
    try {
      const { fromUserId, toUserId, amount, currency } = req.body;
      
      const result = await BusinessLogicIntegration.processP2PTransfer({
        fromUserId,
        toUserId,
        amount,
        currency
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          validation: result.validation
        });
      }

      res.status(201).json({
        success: true,
        transfer: result.data
      });
    } catch (error) {
      console.error('Enhanced P2P transfer error:', error);
      res.status(500).json({
        success: false,
        message: 'Transfer service temporarily unavailable'
      });
    }
  });

  // Enhanced currency exchange with rate staleness protection
  app.post('/api/exchange/currency', async (req, res) => {
    try {
      const { userId, fromCurrency, toCurrency, amount } = req.body;
      
      const result = await BusinessLogicIntegration.processCurrencyExchange({
        userId,
        fromCurrency,
        toCurrency,
        amount
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          validation: result.validation
        });
      }

      res.status(201).json({
        success: true,
        exchange: result.data
      });
    } catch (error) {
      console.error('Enhanced currency exchange error:', error);
      res.status(500).json({
        success: false,
        message: 'Exchange service temporarily unavailable'
      });
    }
  });

  // Enhanced commission payout with atomic protection
  app.post('/api/commissions/payout', async (req, res) => {
    try {
      const { agentId, amount, transactionId } = req.body;
      
      const result = await BusinessLogicIntegration.processCommissionPayout({
        agentId,
        amount,
        transactionId
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          validation: result.validation
        });
      }

      res.status(201).json({
        success: true,
        payout: result.data
      });
    } catch (error) {
      console.error('Enhanced commission payout error:', error);
      res.status(500).json({
        success: false,
        message: 'Commission service temporarily unavailable'
      });
    }
  });

  // Enhanced agent registration with comprehensive validation
  app.post('/api/ai-agents/register-enhanced', (req, res) => {
    try {
      const { name, email, capabilities } = req.body;
      
      const result = BusinessLogicIntegration.processAgentRegistration({
        name,
        email,
        capabilities
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
          validation: result.validation
        });
      }

      res.status(201).json({
        success: true,
        agent: result.data
      });
    } catch (error) {
      console.error('Enhanced agent registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration service temporarily unavailable'
      });
    }
  });

  // Commission tier information endpoint
  app.get('/api/commissions/tiers', (req, res) => {
    try {
      const { amount } = req.query;
      
      if (!amount) {
        return res.json({
          success: true,
          tiers: [
            { minAmount: 5.00, maxAmount: 14.99, rate: '0.25%', description: 'Micro Transaction Tier' },
            { minAmount: 15.00, maxAmount: 99.99, rate: '0.5%', description: 'Standard Transaction Tier' },
            { minAmount: 100.00, maxAmount: 999999.99, rate: '0.75%', description: 'High Value Transaction Tier' }
          ]
        });
      }

      const numericAmount = parseFloat(amount as string);
      if (isNaN(numericAmount) || numericAmount < 5) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be at least $5.00'
        });
      }

      const tierInfo = TieredCommissionCalculator.getTierInfo(numericAmount);
      const commission = TieredCommissionCalculator.calculateCommission(numericAmount);
      const breakEven = TieredCommissionCalculator.calculateBreakEvenAnalysis(numericAmount);

      res.json({
        success: true,
        amount: numericAmount,
        tier: tierInfo,
        commission,
        profitability: breakEven
      });
    } catch (error) {
      console.error('Commission tier lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Commission service temporarily unavailable'
      });
    }
  });

  // Exchange rate status and health check
  app.get('/api/exchange/rates/status', (req, res) => {
    try {
      const status = ExchangeRateProtection.getCacheStatus();
      
      res.json({
        success: true,
        rateCache: {
          size: status.cacheSize,
          circuitBreakerActive: status.circuitBreakerStatus,
          rates: status.rates.map(rate => ({
            pair: rate.pair,
            rate: rate.rate,
            ageSeconds: Math.round(rate.age / 1000),
            fresh: rate.fresh
          }))
        }
      });
    } catch (error) {
      console.error('Exchange rate status error:', error);
      res.status(500).json({
        success: false,
        message: 'Rate service status unavailable'
      });
    }
  });

  // Get validated exchange rate for transaction
  app.get('/api/exchange/rates/:from/:to', async (req, res) => {
    try {
      const { from, to } = req.params;
      const { amount } = req.query;

      if (!amount) {
        return res.status(400).json({
          success: false,
          message: 'Amount parameter required'
        });
      }

      const numericAmount = parseFloat(amount as string);
      const rateValidation = await ExchangeRateProtection.validateRateForTransaction(
        from.toUpperCase(),
        to.toUpperCase(),
        numericAmount
      );

      if (!rateValidation.valid) {
        return res.status(400).json({
          success: false,
          message: rateValidation.error
        });
      }

      res.json({
        success: true,
        fromCurrency: from.toUpperCase(),
        toCurrency: to.toUpperCase(),
        rate: rateValidation.rate,
        amount: numericAmount,
        estimatedOutput: numericAmount * rateValidation.rate!,
        rateAge: 'fresh'
      });
    } catch (error) {
      console.error('Exchange rate lookup error:', error);
      res.status(500).json({
        success: false,
        message: 'Rate lookup service temporarily unavailable'
      });
    }
  });

  // Business logic health check
  app.get('/api/business-logic/health', (req, res) => {
    try {
      const health = BusinessLogicIntegration.getSystemHealthStatus();
      
      res.json({
        success: true,
        healthy: health.healthy,
        components: health.components,
        exchangeRates: health.exchangeRates,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Business logic health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Health check service unavailable'
      });
    }
  });

  // Transaction validation endpoint
  app.post('/api/validation/transaction', (req, res) => {
    try {
      const { InputValidation } = require('../services/inputValidation');
      
      const validation = InputValidation.validateP2PTransfer(req.body);
      
      res.json({
        success: true,
        valid: validation.valid,
        error: validation.error,
        sanitized: validation.sanitized
      });
    } catch (error) {
      console.error('Transaction validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Validation service temporarily unavailable'
      });
    }
  });

  // Minimum transaction amounts endpoint
  app.get('/api/limits/transaction', (req, res) => {
    try {
      res.json({
        success: true,
        limits: {
          minimumTransaction: 5.00,
          maximumTransaction: 999999.99,
          minimumCommissionRate: 0.01,
          maximumCommissionRate: 2.00,
          currency: 'USD'
        },
        reasoning: {
          minimumTransaction: 'Ensures profitability after processing fees and commissions',
          maximumCommissionRate: 'Prevents commission overflow that could cause platform losses'
        }
      });
    } catch (error) {
      console.error('Transaction limits error:', error);
      res.status(500).json({
        success: false,
        message: 'Limits service temporarily unavailable'
      });
    }
  });
}