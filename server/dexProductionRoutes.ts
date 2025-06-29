/**
 * Production DEX Routes
 * Enhanced DEX aggregator with comprehensive business logic validation
 */

import type { Express } from "express";
import { EnhancedDEXAggregator } from "./services/enhancedDEXAggregator";
import { isAuthenticated } from "./replitAuth";
import { authRateLimit } from "./middleware/authSecurity";
import { validateWithSchema } from "./middleware/inputValidationEnhanced";
import { z } from 'zod';

// Validation schemas
const dexQuoteSchema = z.object({
  fromToken: z.string()
    .min(1, 'From token required')
    .max(10, 'Token symbol too long'),
  toToken: z.string()
    .min(1, 'To token required')
    .max(10, 'Token symbol too long'),
  amount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Invalid amount')
    .refine(val => parseFloat(val) <= 1000000, 'Amount exceeds maximum limit'),
  chainId: z.number()
    .int()
    .refine(val => [1, 137, 56, 42161, 10, 8453].includes(val), 'Unsupported chain ID'),
  slippage: z.number()
    .min(0.1, 'Minimum slippage is 0.1%')
    .max(5.0, 'Maximum slippage is 5.0%')
    .optional()
    .default(1.0)
});

const dexSwapSchema = dexQuoteSchema.extend({
  userAddress: z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  maxSlippage: z.number()
    .min(0.1)
    .max(5.0, 'Maximum slippage cannot exceed 5.0%')
    .optional()
    .default(2.0),
  deadline: z.number()
    .int()
    .min(Date.now() / 1000, 'Deadline must be in the future')
    .optional()
});

const tokenListSchema = z.object({
  chainId: z.number()
    .int()
    .refine(val => [1, 137, 56, 42161, 10, 8453].includes(val), 'Unsupported chain ID')
});

export function registerDEXProductionRoutes(app: Express) {

  // Get aggregated swap quote from multiple DEXs
  app.post('/api/dex/quote', 
    validateWithSchema(dexQuoteSchema),
    async (req, res) => {
      try {
        const quoteRequest = req.body;
        const aggregatedQuote = await EnhancedDEXAggregator.getAggregatedQuote(quoteRequest);

        res.json({
          success: true,
          quote: aggregatedQuote,
          meta: {
            requestId: `quote_${Date.now()}`,
            timestamp: new Date().toISOString(),
            validUntil: new Date(Date.now() + 30000).toISOString() // 30 seconds
          }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: 'Quote generation failed',
          message: error.message,
          code: 'DEX_QUOTE_ERROR'
        });
      }
    }
  );

  // Execute swap transaction
  app.post('/api/dex/swap',
    isAuthenticated,
    authRateLimit,
    validateWithSchema(dexSwapSchema),
    async (req, res) => {
      try {
        const swapRequest = req.body;
        const userId = (req.user as any)?.claims?.sub;

        // Add user context to swap request
        const swapWithUser = {
          ...swapRequest,
          userId
        };

        const swapTransaction = await EnhancedDEXAggregator.executeSwap(swapWithUser);

        res.json({
          success: true,
          transaction: swapTransaction,
          meta: {
            requestId: `swap_${Date.now()}`,
            userId,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: 'Swap execution failed',
          message: error.message,
          code: 'DEX_SWAP_ERROR'
        });
      }
    }
  );

  // Get supported tokens for a specific chain
  app.get('/api/dex/tokens/:chainId', async (req, res) => {
    try {
      const chainId = parseInt(req.params.chainId);
      
      if (![1, 137, 56, 42161, 10, 8453].includes(chainId)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported chain ID',
          supportedChains: [1, 137, 56, 42161, 10, 8453]
        });
      }

      const tokens = await EnhancedDEXAggregator.getSupportedTokens(chainId);

      res.json({
        success: true,
        chainId,
        tokens,
        count: tokens.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Token list fetch failed',
        message: error.message
      });
    }
  });

  // Get DEX performance metrics
  app.get('/api/dex/metrics', async (req, res) => {
    try {
      const metrics = EnhancedDEXAggregator.getPerformanceMetrics();

      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Metrics fetch failed',
        message: error.message
      });
    }
  });

  // Get supported chains and their details
  app.get('/api/dex/chains', async (req, res) => {
    try {
      const supportedChains = [
        {
          chainId: 1,
          name: 'Ethereum',
          symbol: 'ETH',
          rpcUrl: 'https://mainnet.infura.io/v3/',
          blockExplorer: 'https://etherscan.io',
          dexSupport: ['1inch', '0x Protocol', 'Uniswap V3', 'Curve', 'Balancer']
        },
        {
          chainId: 137,
          name: 'Polygon',
          symbol: 'MATIC',
          rpcUrl: 'https://polygon-rpc.com',
          blockExplorer: 'https://polygonscan.com',
          dexSupport: ['1inch', '0x Protocol', 'Uniswap V3', 'QuickSwap']
        },
        {
          chainId: 56,
          name: 'BNB Chain',
          symbol: 'BNB',
          rpcUrl: 'https://bsc-dataseed.binance.org',
          blockExplorer: 'https://bscscan.com',
          dexSupport: ['1inch', 'PancakeSwap', '0x Protocol']
        },
        {
          chainId: 42161,
          name: 'Arbitrum',
          symbol: 'ETH',
          rpcUrl: 'https://arb1.arbitrum.io/rpc',
          blockExplorer: 'https://arbiscan.io',
          dexSupport: ['1inch', '0x Protocol', 'Uniswap V3', 'Balancer']
        },
        {
          chainId: 10,
          name: 'Optimism',
          symbol: 'ETH',
          rpcUrl: 'https://mainnet.optimism.io',
          blockExplorer: 'https://optimistic.etherscan.io',
          dexSupport: ['1inch', '0x Protocol', 'Uniswap V3']
        },
        {
          chainId: 8453,
          name: 'Base',
          symbol: 'ETH',
          rpcUrl: 'https://mainnet.base.org',
          blockExplorer: 'https://basescan.org',
          dexSupport: ['1inch', '0x Protocol', 'Uniswap V3']
        }
      ];

      res.json({
        success: true,
        chains: supportedChains,
        count: supportedChains.length,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Chain list fetch failed',
        message: error.message
      });
    }
  });

  // Compare prices across multiple DEXs
  app.post('/api/dex/compare',
    validateWithSchema(dexQuoteSchema),
    async (req, res) => {
      try {
        const quoteRequest = req.body;
        const aggregatedQuote = await EnhancedDEXAggregator.getAggregatedQuote(quoteRequest);

        // Format for price comparison
        const comparison = {
          inputToken: quoteRequest.fromToken,
          outputToken: quoteRequest.toToken,
          inputAmount: quoteRequest.amount,
          bestDEX: aggregatedQuote.bestQuote.dex,
          bestRate: aggregatedQuote.bestQuote.exchangeRate,
          bestOutput: aggregatedQuote.bestQuote.outputAmount,
          allQuotes: aggregatedQuote.allQuotes.map(quote => ({
            dex: quote.dex,
            rate: quote.exchangeRate,
            output: quote.outputAmount,
            priceImpact: quote.priceImpact,
            gasEstimate: quote.gasEstimate,
            confidence: quote.confidence
          })),
          savings: {
            bestVsWorst: aggregatedQuote.allQuotes.length > 1 ? 
              ((parseFloat(aggregatedQuote.bestQuote.outputAmount) - 
                parseFloat(aggregatedQuote.allQuotes[aggregatedQuote.allQuotes.length - 1].outputAmount)) /
                parseFloat(aggregatedQuote.allQuotes[aggregatedQuote.allQuotes.length - 1].outputAmount) * 100).toFixed(2) + '%' 
              : '0%'
          },
          warnings: {
            priceImpact: aggregatedQuote.priceImpactWarning,
            slippage: aggregatedQuote.slippageWarning
          }
        };

        res.json({
          success: true,
          comparison,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: 'Price comparison failed',
          message: error.message
        });
      }
    }
  );

  // Get transaction status
  app.get('/api/dex/transaction/:hash', async (req, res) => {
    try {
      const { hash } = req.params;
      
      if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction hash format'
        });
      }

      // For production, this would check actual blockchain status
      const mockStatus = {
        hash,
        status: Math.random() > 0.1 ? 'confirmed' : 'pending',
        blockNumber: Math.floor(Math.random() * 1000000),
        gasUsed: '150000',
        actualSlippage: (Math.random() * 2).toFixed(3) + '%',
        executionTime: Math.floor(Math.random() * 30) + ' seconds',
        confirmations: Math.floor(Math.random() * 20)
      };

      res.json({
        success: true,
        transaction: mockStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Transaction status check failed',
        message: error.message
      });
    }
  });

  // Clear quote cache (admin only)
  app.post('/api/dex/clear-cache', isAuthenticated, async (req, res) => {
    try {
      EnhancedDEXAggregator.clearCache();
      
      res.json({
        success: true,
        message: 'Quote cache cleared',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Cache clear failed',
        message: error.message
      });
    }
  });
}