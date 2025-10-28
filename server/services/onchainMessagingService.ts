/**
 * On-Chain Wallet-to-Wallet Messaging Service
 * 
 * Sends messages as blockchain transactions with data payload.
 * Messages are permanently recorded on-chain and visible on block explorers
 * like Etherscan, Basescan, etc.
 */

import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';

export interface OnChainMessage {
  txHash: string;
  from: string;
  to: string;
  message: string;
  network: string;
  explorerUrl: string;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
}

export class OnChainMessagingService {
  private cdpService: CoinbaseCDPService;
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.cdpService = CoinbaseCDPService.getInstance();
    
    // Use FREE public Base mainnet RPC (no API key required)
    const rpcUrl = 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`🌐 On-chain messaging using public Base RPC: ${rpcUrl}`);
  }

  /**
   * Send on-chain message to wallet address
   * Message will be visible on block explorer (Etherscan/Basescan)
   */
  async sendOnChainMessage(
    toAddress: string,
    message: string,
    network: 'base' | 'ethereum' = 'base'
  ): Promise<OnChainMessage> {
    try {
      console.log(`📨 Sending on-chain message to ${toAddress} on ${network}`);
      console.log(`📝 Message: ${message.substring(0, 100)}...`);

      // Get platform wallet signer
      const platformWallet = await this.cdpService.getOrCreatePlatformWallet();
      
      // Convert message to hex data
      const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message));
      
      // Get private key for signing (from CDP or environment)
      const privateKey = process.env.XMTP_EOA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Private key not available for on-chain messaging');
      }

      // Create wallet signer
      const wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`📤 Sending from wallet: ${wallet.address}`);

      // Prepare transaction
      const tx = {
        to: toAddress,
        value: ethers.parseEther('0'), // Send 0 ETH, just the message
        data: messageHex,
        // Gas settings will be estimated automatically
      };

      console.log(`⛽ Estimating gas...`);
      
      // Estimate gas
      let gasLimit;
      try {
        gasLimit = await wallet.estimateGas(tx);
        console.log(`⛽ Estimated gas: ${gasLimit.toString()}`);
      } catch (gasError) {
        console.log('⚠️ Gas estimation failed, using default gas limit');
        gasLimit = BigInt(100000); // Default gas limit
      }

      // Get current gas price
      const feeData = await this.provider.getFeeData();
      console.log(`💰 Gas price: ${feeData.gasPrice?.toString() || 'auto'}`);

      // Check wallet balance
      const balance = await this.provider.getBalance(wallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

      const estimatedCost = gasLimit * (feeData.gasPrice || BigInt(0));
      console.log(`💰 Estimated cost: ${ethers.formatEther(estimatedCost)} ETH`);

      if (balance < estimatedCost) {
        throw new Error(`Insufficient balance. Need ${ethers.formatEther(estimatedCost)} ETH, have ${ethers.formatEther(balance)} ETH`);
      }

      // Send transaction
      console.log(`🚀 Sending transaction...`);
      const txResponse = await wallet.sendTransaction({
        ...tx,
        gasLimit,
      });

      console.log(`✅ Transaction sent! Hash: ${txResponse.hash}`);
      console.log(`🔍 View on explorer: ${this.getExplorerUrl(txResponse.hash, network)}`);

      // Wait for confirmation (optional, can return immediately)
      console.log(`⏳ Waiting for confirmation...`);
      const receipt = await txResponse.wait(1);

      console.log(`✅ Transaction confirmed in block ${receipt?.blockNumber}`);

      return {
        txHash: txResponse.hash,
        from: wallet.address,
        to: toAddress,
        message: message,
        network: network,
        explorerUrl: this.getExplorerUrl(txResponse.hash, network),
        gasUsed: receipt?.gasUsed?.toString(),
        status: receipt?.status === 1 ? 'confirmed' : 'failed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ On-chain messaging error:`, error);
      throw error;
    }
  }

  /**
   * Get block explorer URL for transaction
   */
  private getExplorerUrl(txHash: string, network: string): string {
    const explorers: Record<string, string> = {
      'base': 'https://basescan.org/tx/',
      'ethereum': 'https://etherscan.io/tx/',
    };

    return `${explorers[network] || explorers.base}${txHash}`;
  }

  /**
   * Decode message from transaction data
   */
  async decodeMessage(txHash: string): Promise<string | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      
      if (!tx || !tx.data || tx.data === '0x') {
        return null;
      }

      // Decode hex data to UTF-8 string
      const message = ethers.toUtf8String(tx.data);
      return message;
    } catch (error) {
      console.error(`Error decoding message from tx ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Batch send messages to multiple wallets
   */
  async broadcastOnChainMessages(
    addresses: string[],
    message: string,
    network: 'base' | 'ethereum' = 'base'
  ): Promise<OnChainMessage[]> {
    console.log(`📢 Broadcasting on-chain message to ${addresses.length} wallets`);
    
    const results: OnChainMessage[] = [];
    
    for (const address of addresses) {
      try {
        const result = await this.sendOnChainMessage(address, message, network);
        results.push(result);
        
        // Rate limiting - wait between transactions
        console.log('⏳ Waiting 5 seconds before next transaction...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`❌ Failed to send to ${address}:`, error);
        results.push({
          txHash: '',
          from: '',
          to: address,
          message: message,
          network: network,
          explorerUrl: '',
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Check if wallet has enough ETH for messaging
   */
  async canAffordMessage(walletAddress: string): Promise<{
    canAfford: boolean;
    balance: string;
    estimatedCost: string;
  }> {
    try {
      const balance = await this.provider.getBalance(walletAddress);
      const feeData = await this.provider.getFeeData();
      const estimatedGas = BigInt(100000); // Approximate
      const estimatedCost = estimatedGas * (feeData.gasPrice || BigInt(0));

      return {
        canAfford: balance >= estimatedCost,
        balance: ethers.formatEther(balance),
        estimatedCost: ethers.formatEther(estimatedCost)
      };
    } catch (error) {
      console.error('Error checking balance:', error);
      return {
        canAfford: false,
        balance: '0',
        estimatedCost: '0'
      };
    }
  }
}

export const onChainMessagingService = new OnChainMessagingService();
