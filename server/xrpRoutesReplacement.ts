/**
 * Complete XRP Routes Replacement
 * Replaces all problematic XRP endpoints with working simplified versions
 */

import { Express } from 'express';
import { XRPEndpoints } from './services/xrpEndpoints';

export function registerXRPRoutes(app: Express, isAuthenticated: any) {
  
  // Get XRP exchange rate
  app.get('/api/xrp/rate', async (req, res) => {
    const result = await XRPEndpoints.getRate();
    res.json(result);
  });

  // Calculate XRP transaction fees
  app.post('/api/xrp/fees/calculate', async (req, res) => {
    try {
      const { amount } = req.body;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
      }

      const result = await XRPEndpoints.calculateFees(amount);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to calculate fees'
      });
    }
  });

  // Create XRP wallet
  app.post('/api/xrp/wallet/create', isAuthenticated, async (req, res) => {
    const result = await XRPEndpoints.createWallet();
    res.json(result);
  });

  // Get wallet balance
  app.get('/api/xrp/wallet/:address/balance', isAuthenticated, async (req, res) => {
    try {
      const { address } = req.params;
      
      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const result = await XRPEndpoints.getBalance(address);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get balance'
      });
    }
  });

  // Send XRP payment
  app.post('/api/xrp/payment/send', isAuthenticated, async (req, res) => {
    try {
      const { fromAddress, fromSeed, toAddress, amount, currency, memo } = req.body;
      
      if (!fromAddress || !fromSeed || !toAddress || !amount || !currency) {
        return res.status(400).json({
          success: false,
          message: 'All payment fields are required'
        });
      }

      const result = await XRPEndpoints.sendPayment({
        fromAddress,
        fromSeed,
        toAddress,
        amount,
        currency,
        memo
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send payment'
      });
    }
  });

  // Get transaction history
  app.get('/api/xrp/transactions/:address', isAuthenticated, async (req, res) => {
    try {
      const { address } = req.params;
      const { limit } = req.query;
      
      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Wallet address is required'
        });
      }

      const result = await XRPEndpoints.getTransactionHistory(
        address, 
        limit ? parseInt(limit as string) : 20
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get transaction history'
      });
    }
  });

  // Get network status
  app.get('/api/xrp/network/status', async (req, res) => {
    const result = await XRPEndpoints.getNetworkStatus();
    res.json(result);
  });

  // Validate XRP address
  app.post('/api/xrp/address/validate', async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address) {
        return res.status(400).json({
          success: false,
          message: 'Address is required'
        });
      }

      const result = XRPEndpoints.validateAddress(address);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to validate address'
      });
    }
  });

  // Convert currency
  app.post('/api/xrp/convert', async (req, res) => {
    try {
      const { amount, from, to } = req.body;
      
      if (!amount || !from || !to) {
        return res.status(400).json({
          success: false,
          message: 'Amount, from currency, and to currency are required'
        });
      }

      if (!['XRP', 'USD'].includes(from) || !['XRP', 'USD'].includes(to)) {
        return res.status(400).json({
          success: false,
          message: 'Only XRP and USD conversions are supported'
        });
      }

      const result = await XRPEndpoints.convertCurrency(amount, from as 'XRP' | 'USD', to as 'XRP' | 'USD');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to convert currency'
      });
    }
  });
}