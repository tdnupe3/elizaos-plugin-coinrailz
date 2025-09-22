import { Router } from 'express';
import { ethers } from 'ethers';
import { CoinbaseCDPService } from '../services/coinbaseCDPService';

const router = Router();

/**
 * Get current messaging wallet information
 */
router.get('/wallet/info', async (req, res) => {
  try {
    const cdpService = CoinbaseCDPService.getInstance();
    const status = await cdpService.getServiceStatus();
    
    res.json({
      address: "0x337b1b6a0FA833Ae09a697606Ca3FD21ADF696ed",
      network: "Base Chain",
      hasCredentials: status.hasCredentials,
      verified: true,
      messagesCount: 3,
      instructions: {
        blockscanChat: "https://chat.blockscan.com",
        metamaskNetwork: "Base",
        rpcUrl: "https://mainnet.base.org",
        chainId: 8453
      },
      security: {
        warning: "Never share private keys with anyone",
        recommendation: "Use Coinbase Wallet app for safer access"
      }
    });
  } catch (error) {
    console.error('Failed to get wallet info:', error);
    res.status(500).json({ error: 'Failed to get wallet information' });
  }
});

/**
 * Create new BNB wallet for cheaper messaging
 */
router.post('/wallet/create-bnb', async (req, res) => {
  try {
    // Create a fresh wallet for BNB chain
    const wallet = ethers.Wallet.createRandom();
    
    res.json({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase,
      network: "BNB Smart Chain",
      fundingInstructions: true,
      setupInstructions: true,
      metamaskNetwork: {
        networkName: "BNB Smart Chain",
        rpcUrl: "https://bsc-dataseed.binance.org/",
        chainId: 56,
        symbol: "BNB",
        blockExplorer: "https://bscscan.com"
      },
      security: {
        warning: "This private key controls your funds - keep it secure!",
        recommendation: "Fund with 0.01-0.1 BNB for messaging costs"
      },
      targets: [
        "PancakeSwap (DEX)",
        "Venus Protocol (Lending)",
        "Gaming projects",
        "DeFi protocols"
      ]
    });
  } catch (error) {
    console.error('Failed to create BNB wallet:', error);
    res.status(500).json({ error: 'Failed to create BNB wallet' });
  }
});

/**
 * Get BNB chain messaging targets
 */
router.get('/wallet/bnb-targets', async (req, res) => {
  try {
    const targets = [
      {
        name: "PancakeSwap",
        type: "DEX",
        wallet: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap Router
        description: "Largest DEX on BNB Chain",
        dealSize: "$500,000"
      },
      {
        name: "Venus Protocol",
        type: "Lending",
        wallet: "0xfD36E2c2a6789Db23113685031d7F16329158384", // Venus Comptroller
        description: "Major lending platform on BSC",
        dealSize: "$300,000"
      },
      {
        name: "Binance Smart Chain",
        type: "Infrastructure",
        wallet: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", // BSC Official
        description: "Official BSC development",
        dealSize: "$1,000,000"
      },
      {
        name: "BNB Chain Ecosystem",
        type: "Gaming",
        wallet: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // Common BSC address
        description: "Gaming and NFT projects",
        dealSize: "$250,000"
      }
    ];

    res.json({
      targets,
      totalPotential: "$2,050,000",
      messagingCost: "~$0.10-0.50 per message",
      networkInfo: {
        name: "BNB Smart Chain",
        symbol: "BNB",
        chainId: 56,
        rpcUrl: "https://bsc-dataseed.binance.org/"
      }
    });
  } catch (error) {
    console.error('Failed to get BNB targets:', error);
    res.status(500).json({ error: 'Failed to get BNB targets' });
  }
});

/**
 * Get funding instructions for different exchanges
 */
router.get('/wallet/funding-options', async (req, res) => {
  try {
    const options = [
      {
        exchange: "Coinbase",
        difficulty: "Easy",
        steps: [
          "Go to coinbase.com",
          "Buy BNB (Binance Coin)",
          "Click 'Send' → paste your wallet address",
          "Select 'BNB Smart Chain' network",
          "Send 0.01-0.1 BNB"
        ],
        fees: "~$1-3 network fee",
        time: "5-10 minutes"
      },
      {
        exchange: "Binance",
        difficulty: "Medium",
        steps: [
          "Create Binance account",
          "Complete verification",
          "Buy BNB",
          "Go to 'Withdraw'",
          "Select 'BSC' network",
          "Paste wallet address"
        ],
        fees: "~$0.50 withdrawal fee",
        time: "10-30 minutes"
      },
      {
        exchange: "Crypto.com",
        difficulty: "Easy",
        steps: [
          "Download Crypto.com app",
          "Buy BNB",
          "Tap 'Transfer' → 'Withdraw'",
          "Select 'BNB Smart Chain'",
          "Enter wallet address"
        ],
        fees: "~$1-2 network fee",
        time: "5-15 minutes"
      }
    ];

    res.json({
      options,
      recommendation: "Coinbase for beginners, Binance for lower fees",
      minimumAmount: "0.01 BNB (~$6)",
      suggestedAmount: "0.05 BNB (~$30)",
      messagingCapacity: "50-100 messages per 0.01 BNB"
    });
  } catch (error) {
    console.error('Failed to get funding options:', error);
    res.status(500).json({ error: 'Failed to get funding options' });
  }
});

export default router;