/**
 * Wallet Balance Checker - Verify ETH funding for on-chain operations
 */
import express from 'express';
import { ethers } from 'ethers';

const router = express.Router();

/**
 * Check ETH balance of platform wallet
 */
router.get('/wallet/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate address
    if (!ethers.isAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }

    // Use Alchemy RPC endpoint for balance check
    const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/demo');
    
    const balanceWei = await provider.getBalance(address);
    const balanceETH = ethers.formatEther(balanceWei);
    
    // Estimate how many messages can be sent
    const avgGasPerMessage = 0.002; // ~0.002 ETH per message at current gas prices
    const estimatedMessages = Math.floor(parseFloat(balanceETH) / avgGasPerMessage);

    res.json({
      success: true,
      address,
      balanceWei: balanceWei.toString(),
      balanceETH: parseFloat(balanceETH).toFixed(6),
      estimatedMessages,
      status: parseFloat(balanceETH) > 0.001 ? 'funded' : 'needs_funding',
      message: parseFloat(balanceETH) > 0.001 
        ? `Wallet funded with ${parseFloat(balanceETH).toFixed(4)} ETH - ready for ${estimatedMessages} messages`
        : 'Wallet needs ETH funding for gas fees'
    });

  } catch (error) {
    console.error('Wallet balance check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check wallet balance',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;