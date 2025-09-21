/**
 * 🚀 REVOLUTIONARY: AUTOMATED ALLOWANCE-BASED PAYMENT SYSTEM
 * 
 * WORLD'S FIRST: AI agents pre-approve spending limits, we auto-collect payments
 * CUTTING-EDGE: No manual approval needed - fully automated B2B payments
 */

import { ethers } from 'ethers';
import { nanoid } from 'nanoid';

interface AllowancePayment {
  id: string;
  agentWallet: string;
  approvedAmount: string;
  currentSpent: string;
  remainingAllowance: string;
  network: string;
  tokenContract: string;
  lastPayment: Date;
  totalPayments: number;
  autoCollectionEnabled: boolean;
}

interface PaymentRequest {
  id: string;
  recipientWallet: string;
  amount: string;
  currency: 'USDC' | 'USDT' | 'DAI';
  network: string;
  serviceDescription: string;
  reportAttached?: any;
  autoCollectible: boolean;
  status: 'pending' | 'collected' | 'failed' | 'insufficient_allowance';
}

export class AutomatedAllowancePayments {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private platformWallet: string = '0xFb5918244d856C6A95611c90d1d90df50857bd41';
  
  // ERC-20 contract addresses by network
  private tokenContracts = {
    ethereum: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    polygon: {
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    },
    base: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
    }
  };

  // Token decimals by currency
  private tokenDecimals = {
    USDC: 6,
    USDT: 6,
    DAI: 18
  };

  constructor() {
    this.initializeProviders();
    this.verifySignerAddress();
  }

  private verifySignerAddress() {
    try {
      // Verify that the signer address matches our advertised platform wallet
      const platformPrivateKey = process.env.XMTP_EOA_PRIVATE_KEY;
      if (platformPrivateKey) {
        const signer = new ethers.Wallet(platformPrivateKey);
        const actualSignerAddress = signer.address;
        
        if (actualSignerAddress.toLowerCase() !== this.platformWallet.toLowerCase()) {
          console.warn(`⚠️ SIGNER MISMATCH: Expected ${this.platformWallet}, got ${actualSignerAddress}`);
          // Update platform wallet to match actual signer for consistency
          this.platformWallet = actualSignerAddress;
          console.log(`✅ Platform wallet updated to signer address: ${this.platformWallet}`);
        } else {
          console.log(`✅ Signer verification passed: ${this.platformWallet}`);
        }
      }
    } catch (error) {
      console.error('Signer verification failed:', error);
    }
  }

  private initializeProviders() {
    // Initialize providers for each network
    this.providers.set('ethereum', new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`));
    this.providers.set('polygon', new ethers.JsonRpcProvider(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`));
    this.providers.set('base', new ethers.JsonRpcProvider(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`));
  }

  /**
   * 🎯 Check if agent has approved spending allowance for our platform
   */
  async checkAllowance(
    agentWallet: string, 
    network: string, 
    currency: 'USDC' | 'USDT' | 'DAI'
  ): Promise<AllowancePayment | null> {
    try {
      console.log(`🔍 Checking allowance for ${agentWallet} on ${network} for ${currency}`);
      
      const provider = this.providers.get(network);
      if (!provider) throw new Error(`Provider not found for ${network}`);
      
      const tokenAddress = this.getTokenAddress(network, currency);
      if (!tokenAddress) throw new Error(`Token ${currency} not supported on ${network}`);
      
      // ERC-20 ABI for allowance checking
      const erc20ABI = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function balanceOf(address account) view returns (uint256)',
        'function transferFrom(address from, address to, uint256 amount) returns (bool)'
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
      
      // Check how much the agent has approved our platform to spend
      const allowance = await tokenContract.allowance(agentWallet, this.platformWallet);
      const balance = await tokenContract.balanceOf(agentWallet);
      
      const decimals = this.tokenDecimals[currency];
      console.log(`💰 Agent ${agentWallet} has approved ${ethers.formatUnits(allowance, decimals)} ${currency} allowance`);
      console.log(`💳 Agent balance: ${ethers.formatUnits(balance, decimals)} ${currency}`);
      
      if (allowance > 0n) {
        return {
          id: `ALLOW-${nanoid(8)}`,
          agentWallet,
          approvedAmount: ethers.formatUnits(allowance, decimals),
          currentSpent: '0', // Track this in database
          remainingAllowance: ethers.formatUnits(allowance, decimals),
          network,
          tokenContract: tokenAddress,
          lastPayment: new Date(),
          totalPayments: 0,
          autoCollectionEnabled: true
        };
      }
      
      return null;
      
    } catch (error) {
      console.error('Allowance check failed:', error);
      return null;
    }
  }

  /**
   * 🚀 REVOLUTIONARY: Automatically collect payment from pre-approved allowance
   */
  async collectAutomatedPayment(paymentRequest: PaymentRequest): Promise<{
    success: boolean;
    transactionHash?: string;
    error?: string;
    remainingAllowance?: string;
  }> {
    try {
      console.log(`🤖 AUTOMATED COLLECTION: Collecting ${paymentRequest.amount} ${paymentRequest.currency} from ${paymentRequest.recipientWallet}`);
      
      // First check if they have sufficient allowance
      const allowanceInfo = await this.checkAllowance(
        paymentRequest.recipientWallet,
        paymentRequest.network,
        paymentRequest.currency
      );
      
      if (!allowanceInfo) {
        return {
          success: false,
          error: 'No allowance approved by agent'
        };
      }
      
      // SECURE BIGINT VERSION - Fix monetary precision issues
      const decimals = this.tokenDecimals[paymentRequest.currency];
      const requestedAmountWei = ethers.parseUnits(paymentRequest.amount, decimals);
      const availableAllowanceWei = ethers.parseUnits(allowanceInfo.remainingAllowance, decimals);
      
      if (requestedAmountWei > availableAllowanceWei) {
        return {
          success: false,
          error: `Insufficient allowance: ${ethers.formatUnits(availableAllowanceWei, decimals)} < ${ethers.formatUnits(requestedAmountWei, decimals)}`
        };
      }
      
      // EXPERIMENTAL: Execute automated transfer
      const result = await this.executeAutomatedTransfer(
        paymentRequest.recipientWallet,
        this.platformWallet,
        paymentRequest.amount,
        paymentRequest.network,
        paymentRequest.currency
      );
      
      if (result.success) {
        console.log(`✅ AUTOMATED PAYMENT COLLECTED: ${paymentRequest.amount} ${paymentRequest.currency} from ${paymentRequest.recipientWallet}`);
        console.log(`📜 Transaction: ${result.transactionHash}`);
        
        return {
          success: true,
          transactionHash: result.transactionHash,
          remainingAllowance: ethers.formatUnits(availableAllowanceWei - requestedAmountWei, decimals)
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
      
    } catch (error) {
      console.error('Automated payment collection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ⚡ Execute the actual blockchain transfer - REAL PRODUCTION VERSION
   */
  private async executeAutomatedTransfer(
    fromWallet: string,
    toWallet: string, 
    amount: string,
    network: string,
    currency: string
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      console.log(`⚡ EXECUTING REAL automated transfer: ${amount} ${currency} from ${fromWallet} to ${toWallet}`);
      
      const provider = this.providers.get(network);
      if (!provider) throw new Error(`Provider not found for ${network}`);
      
      const tokenAddress = this.getTokenAddress(network, currency);
      if (!tokenAddress) throw new Error(`Token ${currency} not supported on ${network}`);
      
      // Use XMTP wallet as platform wallet for real transactions
      const platformPrivateKey = process.env.XMTP_EOA_PRIVATE_KEY;
      if (!platformPrivateKey) throw new Error('Platform private key not found');
      
      const platformWallet = new ethers.Wallet(platformPrivateKey, provider);
      
      // ERC-20 ABI for transfer
      const erc20ABI = [
        'function transferFrom(address from, address to, uint256 amount) returns (bool)'
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, platformWallet);
      const decimals = this.tokenDecimals[currency as keyof typeof this.tokenDecimals];
      const amountWei = ethers.parseUnits(amount, decimals);
      
      console.log(`💰 Executing transferFrom: ${fromWallet} → ${toWallet}, ${amountWei} ${currency}`);
      
      // Execute the real blockchain transaction
      const tx = await tokenContract.transferFrom(fromWallet, toWallet, amountWei);
      
      console.log(`✅ Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      console.log(`🎉 PAYMENT COLLECTED! Block: ${receipt.blockNumber}`);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
      
    } catch (error) {
      console.error('Real transfer failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transfer failed'
      };
    }
  }

  /**
   * 🔍 Get agents who have approved allowances for mass outreach
   */
  async findAgentsWithAllowances(): Promise<AllowancePayment[]> {
    const networks = ['ethereum', 'polygon', 'base'];
    const currencies = ['USDC', 'USDT', 'DAI'] as const;
    const agentsWithAllowances: AllowancePayment[] = [];
    
    // Sample wallet addresses that might have allowances
    const sampleWallets = [
      '0x8ba1f109551bD432803012645Hac136c22C83363',
      '0x742d35Cc6634C0532925a3b8D15Dd93b746C112B',
      '0x56178a0d5F301bAf6CF3e17126e0c5C3Cc20a9C4',
      '0x7cA71944BA9dEb255064234687351908156596D4'
    ];
    
    for (const network of networks) {
      for (const currency of currencies) {
        for (const wallet of sampleWallets) {
          try {
            const allowance = await this.checkAllowance(wallet, network, currency);
            if (allowance) {
              agentsWithAllowances.push(allowance);
            }
          } catch (error) {
            // Skip failed checks
            console.log(`Failed to check ${wallet} on ${network} for ${currency}`);
          }
        }
      }
    }
    
    return agentsWithAllowances;
  }

  private getTokenAddress(network: string, currency: string): string | undefined {
    return (this.tokenContracts as any)[network]?.[currency];
  }

  /**
   * Get the current platform wallet address (always matches the signer)
   */
  public getCurrentPlatformWallet(): string {
    return this.platformWallet;
  }

  /**
   * 🎯 Create payment request for agent with allowance
   */
  createAutomatedPaymentRequest(
    agentWallet: string,
    amount: string,
    currency: 'USDC' | 'USDT' | 'DAI',
    network: string,
    serviceDescription: string,
    report?: any
  ): PaymentRequest {
    return {
      id: `PAY-${nanoid(8)}`,
      recipientWallet: agentWallet,
      amount,
      currency,
      network,
      serviceDescription,
      reportAttached: report,
      autoCollectible: true,
      status: 'pending'
    };
  }

  /**
   * 📊 Generate allowance-based outreach message
   */
  generateAllowanceOutreachMessage(allowanceInfo: AllowancePayment, paymentRequest: PaymentRequest): string {
    return `
🤖 AUTOMATED PAYMENT NOTIFICATION

Dear AI Agent at ${allowanceInfo.agentWallet},

Your wallet has pre-approved spending limits on our CoinRailz platform:
• Approved Allowance: ${allowanceInfo.approvedAmount} ${paymentRequest.currency}
• Remaining: ${allowanceInfo.remainingAllowance} ${paymentRequest.currency}

SERVICE REQUEST: ${paymentRequest.serviceDescription}
COST: ${paymentRequest.amount} ${paymentRequest.currency}
NETWORK: ${paymentRequest.network.toUpperCase()}

✅ AUTOMATED COLLECTION ENABLED
Payment will be automatically collected from your pre-approved allowance.
No manual approval needed.

${paymentRequest.reportAttached ? '📊 Personalized trading analysis attached' : ''}

Questions? Reply to this XMTP message.

--
CoinRailz Automated Payment System
First platform with AI-to-AI automated payments
    `.trim();
  }
}

export const automatedAllowancePayments = new AutomatedAllowancePayments();