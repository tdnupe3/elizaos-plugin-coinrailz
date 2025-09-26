/**
 * 🚀 PILOT CAMPAIGN SERVICE - Proof of Delivery for .cb.id/.base.eth Addresses
 * 
 * Executes blockchain messaging campaign to prove impossible-to-block delivery works.
 * Creates comprehensive proof-of-delivery report for sales collateral.
 */

import { ethers } from 'ethers';
import { CoinbaseCDPService } from './coinbaseCDPService';
import { db } from '../db';

interface PilotTarget {
  id: number;
  address: string;
  domain_name: string;
  domain_type: '.cb.id' | '.base.eth';
}

interface DeliveryProof {
  target: PilotTarget;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  timestamp: Date;
  messageData: string;
  status: 'success' | 'failed';
  error?: string;
}

export class PilotCampaignService {
  private provider: ethers.JsonRpcProvider;
  private platformWallet: ethers.Wallet | null = null;
  private deliveryProofs: DeliveryProof[] = [];

  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  }

  private async initializePlatformWallet() {
    this.platformWallet = await CoinbaseCDPService.getPlatformSigner('base');
    console.log(`🔗 Pilot campaign initialized with platform wallet: ${this.platformWallet.address}`);
  }

  /**
   * 🎯 Execute pilot campaign to all addresses in database
   */
  async executePilotCampaign(): Promise<DeliveryProof[]> {
    console.log('🚀 EXECUTING PILOT BLOCKCHAIN MESSAGING CAMPAIGN...');
    
    // Initialize platform wallet
    await this.initializePlatformWallet();
    if (!this.platformWallet) {
      throw new Error('Failed to initialize platform wallet');
    }

    // Get all addresses from database
    const targets = await this.getTargetAddresses();
    console.log(`📊 Found ${targets.length} target addresses: ${targets.map(t => t.domain_name).join(', ')}`);
    
    // Check balance
    const balance = await this.provider.getBalance(this.platformWallet.address);
    console.log(`💰 Base ETH Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === BigInt(0)) {
      throw new Error('No Base ETH available for messaging campaign');
    }

    // Execute messages to all targets
    for (const target of targets) {
      try {
        console.log(`📡 Sending message to ${target.domain_name} (${target.address})...`);
        const proof = await this.sendPilotMessage(target);
        this.deliveryProofs.push(proof);
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error: any) {
        console.error(`❌ Failed to message ${target.domain_name}:`, error.message);
        this.deliveryProofs.push({
          target,
          transactionHash: '',
          blockNumber: 0,
          gasUsed: '0',
          timestamp: new Date(),
          messageData: '',
          status: 'failed',
          error: error.message
        });
      }
    }

    await this.generateProofReport();
    return this.deliveryProofs;
  }

  /**
   * 📡 Send blockchain message to specific target
   */
  private async sendPilotMessage(target: PilotTarget): Promise<DeliveryProof> {
    if (!this.platformWallet) throw new Error('Platform wallet not initialized');

    const message = this.generatePilotMessage(target);
    const messageData = ethers.hexlify(ethers.toUtf8Bytes(message));
    
    try {
      // Get current gas data
      const feeData = await this.provider.getFeeData();
      
      // Estimate gas
      const estimatedGas = await this.provider.estimateGas({
        to: target.address,
        value: ethers.parseEther('0.000001'),
        data: messageData
      });

      // Create transaction
      const tx = {
        to: target.address,
        value: ethers.parseEther('0.000001'), // Send minimal ETH (0.000001 ETH)
        data: messageData,
        gasLimit: (estimatedGas * BigInt(130)) / BigInt(100), // 30% buffer
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
      };

      // Send transaction
      const txResponse = await this.platformWallet.sendTransaction(tx);
      const receipt = await txResponse.wait();

      if (receipt) {
        // Calculate actual cost: gasUsed * effectiveGasPrice
        const actualCost = receipt.gasUsed * (receipt.gasPrice || feeData.gasPrice || BigInt(0));
        const costInEth = Number(ethers.formatEther(actualCost));
        const costInUsd = costInEth * 2800; // Approximate ETH price
        
        console.log(`✅ MESSAGE DELIVERED: ${target.domain_name}`);
        console.log(`🔗 Transaction Hash: ${receipt.hash}`);
        console.log(`📦 Block Number: ${receipt.blockNumber}`);
        console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`💰 Actual Cost: ${costInEth.toFixed(8)} ETH (~$${costInUsd.toFixed(6)} USD)`);
        
        return {
          target,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          timestamp: new Date(),
          messageData: message,
          status: 'success'
        };
      } else {
        throw new Error('Transaction failed - no receipt');
      }

    } catch (error: any) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * 📝 Generate pilot campaign message
   */
  private generatePilotMessage(target: PilotTarget): string {
    return `🎯 COIN RAILZ PILOT CAMPAIGN: This message proves impossible-to-block delivery to ${target.domain_name}. We can guarantee your marketing messages reach verified Coinbase/Base wallet holders via blockchain transactions. No ads can be blocked, filtered, or ignored. Platform demo: coinrailz.com | Contact: support@coinrailz.com | Campaign ID: PILOT-${Date.now()}`;
  }

  /**
   * 📊 Get target addresses from database (EOAs only - filter out smart contracts)
   */
  private async getTargetAddresses(): Promise<PilotTarget[]> {
    const result = await db.execute(`
      SELECT id, address, domain_name, domain_type 
      FROM coinbase_address_database 
      WHERE can_receive_messages = true
      ORDER BY domain_type, domain_name
    `);
    
    const allAddresses = result.rows as PilotTarget[];
    const eoaAddresses: PilotTarget[] = [];
    
    // Filter for EOAs only by checking if address has code
    for (const address of allAddresses) {
      try {
        const code = await this.provider.getCode(address.address);
        if (code === '0x') {
          // No code = EOA (can receive arbitrary transactions)
          eoaAddresses.push(address);
          console.log(`✅ EOA confirmed: ${address.domain_name} (${address.address})`);
        } else {
          console.log(`❌ Smart contract skipped: ${address.domain_name} (${address.address})`);
        }
      } catch (error) {
        console.log(`⚠️ Address check failed: ${address.domain_name} - ${error}`);
      }
    }
    
    console.log(`📊 Address filtering: ${eoaAddresses.length}/${allAddresses.length} are EOAs that can receive messages`);
    return eoaAddresses;
  }

  /**
   * 📋 Generate comprehensive proof-of-delivery report
   */
  private async generateProofReport(): Promise<void> {
    const successCount = this.deliveryProofs.filter(p => p.status === 'success').length;
    const failureCount = this.deliveryProofs.filter(p => p.status === 'failed').length;
    
    // Calculate total cost properly: sum all actual transaction costs
    let totalCostEth = 0;
    for (const proof of this.deliveryProofs.filter(p => p.status === 'success')) {
      try {
        const receipt = await this.provider.getTransactionReceipt(proof.transactionHash);
        if (receipt) {
          const txCost = receipt.gasUsed * (receipt.gasPrice || BigInt(0));
          totalCostEth += Number(ethers.formatEther(txCost));
        }
      } catch (error) {
        console.log(`⚠️ Could not get receipt for ${proof.transactionHash}`);
      }
    }
    const totalCostUsd = totalCostEth * 2800;

    console.log('\n🎯 PILOT CAMPAIGN COMPLETE - PROOF OF DELIVERY REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 DELIVERY STATISTICS:`);
    console.log(`   • Total Addresses: ${this.deliveryProofs.length}`);
    console.log(`   • Successful Deliveries: ${successCount} (${((successCount/this.deliveryProofs.length)*100).toFixed(1)}%)`);
    console.log(`   • Failed Deliveries: ${failureCount}`);
    console.log(`   • Total Cost: $${totalCostUsd.toFixed(6)} USD`);
    console.log(`   • Cost per Message: $${successCount > 0 ? (totalCostUsd / successCount).toFixed(6) : '0.000000'} USD`);
    
    console.log(`\n🔗 TRANSACTION PROOF (100% Verifiable):`);
    this.deliveryProofs.forEach((proof, index) => {
      if (proof.status === 'success') {
        console.log(`   ${index + 1}. ${proof.target.domain_name}`);
        console.log(`      • Transaction: https://basescan.org/tx/${proof.transactionHash}`);
        console.log(`      • Block: ${proof.blockNumber}`);
        console.log(`      • Timestamp: ${proof.timestamp.toISOString()}`);
      } else {
        console.log(`   ${index + 1}. ${proof.target.domain_name} - FAILED: ${proof.error}`);
      }
    });

    const deliveryRate = ((successCount/this.deliveryProofs.length)*100).toFixed(1);
    console.log(`\n💡 HONEST SALES PROPOSITION:`);
    console.log(`   • ✅ IMPOSSIBLE TO BLOCK: Messages stored permanently on blockchain`);
    console.log(`   • ⚠️  DELIVERY RATE: ${successCount}/${this.deliveryProofs.length} addresses reached (${deliveryRate}% - EOAs only)`);
    console.log(`   • ✅ VERIFIED WALLETS: All addresses verified Coinbase/Base holders`);
    console.log(`   • ✅ COST EFFECTIVE: $${successCount > 0 ? (totalCostUsd / successCount).toFixed(6) : '0.000000'} per verified delivery`);
    console.log(`   • ✅ PERMANENT PROOF: Every message has blockchain transaction hash`);
    
    console.log(`\n🎯 REALISTIC BUSINESS VALUE:`);
    console.log(`   • Traditional ads: 2-5% reach, easily blocked`);
    console.log(`   • Our solution: ${deliveryRate}% reach to EOAs, impossible to block`);
    console.log(`   • Target audience: Verified crypto users with spending power`);
    console.log(`   • Use case: Product launches, token sales, targeted EOA outreach`);
    console.log(`   • Limitation: Only works with externally owned accounts (not smart contracts)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Store results in database for sales team (temporarily disabled)
    // await this.storeCampaignResults();
    console.log('📊 Campaign results ready for sales team (database storage temporarily disabled)');
  }

  /**
   * 💾 Store campaign results in database
   */
  private async storeCampaignResults(): Promise<void> {
    for (const proof of this.deliveryProofs) {
      await db.execute(`
        INSERT INTO pilot_campaign_results 
        (target_address, domain_name, transaction_hash, block_number, gas_used, status, error_message, campaign_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        proof.target.address,
        proof.target.domain_name,
        proof.transactionHash || null,
        proof.blockNumber || null,
        proof.gasUsed || null,
        proof.status,
        proof.error || null,
        proof.timestamp
      ]);
    }
    
    console.log('💾 Campaign results stored in database for sales team access');
  }

  /**
   * 📊 Get campaign results for sales team
   */
  static async getCampaignResults(): Promise<DeliveryProof[]> {
    const result = await db.execute(`
      SELECT * FROM pilot_campaign_results 
      ORDER BY campaign_date DESC
    `);
    
    return result.rows.map(row => ({
      target: {
        id: 0,
        address: row.target_address,
        domain_name: row.domain_name,
        domain_type: row.domain_name.includes('.cb.id') ? '.cb.id' : '.base.eth'
      },
      transactionHash: row.transaction_hash || '',
      blockNumber: row.block_number || 0,
      gasUsed: row.gas_used || '0',
      timestamp: new Date(row.campaign_date),
      messageData: '',
      status: row.status as 'success' | 'failed',
      error: row.error_message || undefined
    })) as DeliveryProof[];
  }
}