import { Router } from 'express';
import { enhancedCDPService } from '../services/coinbaseCDPEnhancedService.js';
import { isAuthenticated } from '../replitAuth.js';

const router = Router();

/**
 * Enhanced CDP Routes with Smart Accounts, Swaps, and Advanced Features
 * Production-ready endpoints for enterprise CDP functionality
 */

// Initialize enhanced CDP service on startup
enhancedCDPService.initialize().catch(error => {
  console.error('❌ Failed to initialize Enhanced CDP Service:', error);
});

/**
 * Create Smart Account with gas sponsorship
 */
router.post('/smart-account', isAuthenticated, async (req, res) => {
  try {
    const { network = 'base-mainnet' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const smartAccount = await enhancedCDPService.createSmartAccount(userId, network);
    
    res.json({
      success: true,
      smartAccount,
      features: {
        gasSponsorship: enhancedCDPService.getGasSponsorshipStatus(network),
        batchOperations: true,
        crossChain: true,
        dexIntegration: true
      }
    });
  } catch (error) {
    console.error('❌ Smart Account creation failed:', error);
    res.status(500).json({ 
      error: 'Failed to create Smart Account',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get swap quote using CDP Trade API
 */
router.post('/swap/quote', isAuthenticated, async (req, res) => {
  try {
    const { fromAsset, toAsset, amount, network = 'base-mainnet' } = req.body;

    if (!fromAsset || !toAsset || !amount) {
      return res.status(400).json({ 
        error: 'Missing required parameters: fromAsset, toAsset, amount' 
      });
    }

    const quote = await enhancedCDPService.getSwapQuote(
      fromAsset,
      toAsset,
      amount,
      network
    );

    res.json({
      success: true,
      quote,
      provider: 'CDP_SWAP_API',
      executionTime: '<500ms',
      liquidity: '130+ exchanges'
    });
  } catch (error) {
    console.error('❌ Swap quote failed:', error);
    res.status(500).json({ 
      error: 'Failed to get swap quote',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute swap with sub-500ms execution
 */
router.post('/swap/execute', isAuthenticated, async (req, res) => {
  try {
    const { 
      walletAddress, 
      fromAsset, 
      toAsset, 
      amount, 
      slippageBps = 100,
      network = 'base-mainnet' 
    } = req.body;

    if (!walletAddress || !fromAsset || !toAsset || !amount) {
      return res.status(400).json({ 
        error: 'Missing required parameters: walletAddress, fromAsset, toAsset, amount' 
      });
    }

    const result = await enhancedCDPService.executeSwap(
      walletAddress,
      fromAsset,
      toAsset,
      amount,
      slippageBps,
      network
    );

    res.json({
      success: true,
      transactionHash: result.transactionHash,
      executionTime: `${result.executionTime}ms`,
      network,
      explorer: `https://basescan.org/tx/${result.transactionHash}`
    });
  } catch (error) {
    console.error('❌ Swap execution failed:', error);
    res.status(500).json({ 
      error: 'Failed to execute swap',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Execute gasless batch transaction
 */
router.post('/batch-transaction', isAuthenticated, async (req, res) => {
  try {
    const { smartAccountAddress, operations, network = 'base-mainnet' } = req.body;

    if (!smartAccountAddress || !operations || !Array.isArray(operations)) {
      return res.status(400).json({ 
        error: 'Missing required parameters: smartAccountAddress, operations (array)' 
      });
    }

    const transactionHash = await enhancedCDPService.executeGaslessTransaction(
      smartAccountAddress,
      operations,
      network
    );

    res.json({
      success: true,
      transactionHash,
      gasSponsored: enhancedCDPService.getGasSponsorshipStatus(network),
      operationCount: operations.length,
      network
    });
  } catch (error) {
    console.error('❌ Batch transaction failed:', error);
    res.status(500).json({ 
      error: 'Failed to execute batch transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Validate external blockchain address
 */
router.post('/validate-address', isAuthenticated, async (req, res) => {
  try {
    const { address, network = 'base-mainnet' } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const validation = await enhancedCDPService.validateAddress(address, network);

    res.json({
      success: true,
      validation,
      recommendations: {
        showWarning: !validation.isInternal && validation.isValid,
        requireConfirmation: validation.riskLevel === 'High',
        suggestDoubleCheck: validation.riskLevel === 'Medium'
      }
    });
  } catch (error) {
    console.error('❌ Address validation failed:', error);
    res.status(500).json({ 
      error: 'Failed to validate address',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get supported networks and features
 */
router.get('/networks', async (req, res) => {
  try {
    const networks = enhancedCDPService.getSmartAccountNetworks();
    
    const networkDetails = networks.map(network => ({
      network,
      features: {
        smartAccounts: true,
        gasSponsorship: enhancedCDPService.getGasSponsorshipStatus(network),
        swapApi: true,
        batchOperations: true
      }
    }));

    res.json({
      success: true,
      networks: networkDetails,
      totalNetworks: networks.length
    });
  } catch (error) {
    console.error('❌ Failed to get network info:', error);
    res.status(500).json({ 
      error: 'Failed to get network information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Estimate transaction fees
 */
router.post('/estimate-fees', isAuthenticated, async (req, res) => {
  try {
    const { operations, network = 'base-mainnet' } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ error: 'Operations array is required' });
    }

    const feeEstimate = await enhancedCDPService.estimateTransactionFees(
      operations,
      network
    );

    res.json({
      success: true,
      feeEstimate,
      gasSponsorship: enhancedCDPService.getGasSponsorshipStatus(network),
      note: enhancedCDPService.getGasSponsorshipStatus(network) 
        ? 'Gas fees sponsored on this network'
        : 'User pays gas fees'
    });
  } catch (error) {
    console.error('❌ Fee estimation failed:', error);
    res.status(500).json({ 
      error: 'Failed to estimate fees',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as enhancedCDPRoutes };