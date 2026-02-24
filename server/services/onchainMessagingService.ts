/**
 * On-Chain Wallet-to-Wallet Messaging Service
 * 
 * Uses deployed smart contract to store messages on-chain.
 * Messages are permanently recorded on-chain and visible on block explorers
 * like Etherscan, Basescan, etc.
 */

import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';
import fs from 'fs';
import path from 'path';

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
  messageId?: number;
}

export class OnChainMessagingService {
  private cdpService: CoinbaseCDPService;
  private provider: ethers.JsonRpcProvider;
  private contractAddress: string;
  private contractABI: any[];

  constructor() {
    this.cdpService = CoinbaseCDPService.getInstance();
    
    // Use FREE public Base mainnet RPC (no API key required)
    const rpcUrl = 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Load deployed contract config
    const configPath = path.join(process.cwd(), 'messaging-contract-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('Messaging contract not deployed. Run deployment script first.');
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    this.contractAddress = config.address;
    this.contractABI = config.abi;
    
    console.log(`🌐 On-chain messaging using smart contract: ${this.contractAddress}`);
    console.log(`🔍 View contract: https://basescan.org/address/${this.contractAddress}`);
  }

  /**
   * Send on-chain message to wallet address using smart contract
   * Message will be visible on block explorer (Etherscan/Basescan)
   */
  async sendOnChainMessage(
    toAddress: string,
    message: string,
    network: 'base' | 'ethereum' = 'base'
  ): Promise<OnChainMessage> {
    try {
      console.log(`📨 Sending on-chain message to ${toAddress} via smart contract`);
      console.log(`📝 Message: ${message.substring(0, 100)}...`);

      // Get private key for signing
      const privateKey = process.env.EOA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Private key not available for on-chain messaging');
      }

      // Create wallet signer
      const wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`📤 Sending from wallet: ${wallet.address}`);

      // Create contract instance
      const contract = new ethers.Contract(
        this.contractAddress,
        this.contractABI,
        wallet
      );

      // Send message via contract
      console.log(`📝 Calling contract.sendMessage()...`);
      const tx = await contract.sendMessage(toAddress, message);
      
      console.log(`✅ Transaction sent! Hash: ${tx.hash}`);
      console.log(`🔍 View on Basescan: https://basescan.org/tx/${tx.hash}`);

      // Wait for confirmation
      console.log(`⏳ Waiting for confirmation...`);
      const receipt = await tx.wait();

      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // Get message ID from event logs
      let messageId = 0;
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog?.name === 'MessageSent';
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = contract.interface.parseLog(event);
        messageId = Number(parsedLog?.args[0] || 0);
        console.log(`📬 Message ID: ${messageId}`);
      }

      return {
        txHash: tx.hash,
        from: wallet.address,
        to: toAddress,
        message: message,
        network: network,
        explorerUrl: `https://basescan.org/tx/${tx.hash}`,
        gasUsed: receipt.gasUsed?.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        timestamp: new Date().toISOString(),
        messageId: messageId
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
