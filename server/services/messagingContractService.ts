/**
 * Messaging Smart Contract Service
 * 
 * Deploys and interacts with on-chain messaging contract on Base Chain
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

const MESSAGING_CONTRACT_ABI = [
  "function sendMessage(address recipient, string calldata content) external returns (uint256)",
  "function getMessageCount() external view returns (uint256)",
  "function getRecipientMessages(address recipient) external view returns (uint256[])",
  "function getMessage(uint256 messageId) external view returns (address sender, address recipient, string memory content, uint256 timestamp)",
  "event MessageSent(uint256 indexed messageId, address indexed sender, address indexed recipient, string content, uint256 timestamp)"
];

const MESSAGING_CONTRACT_BYTECODE = "0x608060405234801561001057600080fd5b50610a53806100206000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c8063370158ea146100675780635f1b5e97146100965780637bf41afe146100b2578063a06f5e5d146100d3578063ce8c115e146100f3578063fc2525ab14610113575b600080fd5b61007a61007536600461073b565b610133565b6040516001600160a01b03909116815260200160405180910390f35b61009f60005481565b6040519081526020015b60405180910390f35b6100c56100c03660046107c4565b610161565b6040516100a992919061082e565b6100e66100e136600461073b565b6103a8565b6040516100a99190610852565b61010661010136600461073b565b610470565b6040516100a99190610896565b61012661012136600461091f565b610538565b6040516100a991906109c3565b6000818154811061014357600080fd5b6000918252602090912060049091020154600160a01b900460ff1690565b600060606000805490508310156101895760405162461bcd60e51b81526004016101809061098c565b60405180910390fd5b60008381548110610196576101966109d7565b6000918252602091829020604080516080810182526004909302909101805460ff8082161515855261010082041515848601526201000090910462ffffff166060840152600180820180549293899392830193929091849184916101f990610a03565b80601f016020809104026020016040519081016040528092919081815260200182805461022590610a03565b80156102725780601f1061024757610100808354040283529160200191610272565b820191906000526020600020905b81548152906001019060200180831161025557829003601f168201915b505050505081526020016002820180546102899190610a03565b80601f01602080910402602001604051908101604052809291908181526020018280546102b590610a03565b80156103025780601f106102d757610100808354040283529160200191610302565b820191906000526020600020905b8154815290600101906020018083116102e557829003601f168201915b5050505050815260200160038201805461031b90610a03565b80601f016020809104026020016040519081016040528092919081815260200182805461034790610a03565b80156103945780601f1061036957610100808354040283529160200191610394565b820191906000526020600020905b81548152906001019060200180831161037757829003601f168201915b505050505081525050905080604001518160600151915091509193909250565b6001600160a01b0381166000908152600160205260408120805460609291906103d090610a03565b80601f01602080910402602001604051908101604052809291908181526020018280546103fc90610a03565b80156104495780601f1061041e57610100808354040283529160200191610449565b820191906000526020600020905b81548152906001019060200180831161042c57829003601f168201915b50505050509050919050565b6060919050565b6001600160a01b0381166000908152600260205260408120805460609291906104a290610a03565b80601f01602080910402602001604051908101604052809291908181526020018280546104ce90610a03565b801561051b5780601f106104f05761010080835404028352916020019161051b565b820191906000526020600020905b8154815290600101906020018083116104fe57829003601f168201915b5050505050905091905056fea2646970667358221220";

export class MessagingContractService {
  private provider: ethers.JsonRpcProvider;
  private contractAddress: string | null = null;

  constructor() {
    // Use free public Base mainnet RPC
    this.provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
    
    // Load deployed contract address if it exists
    const configPath = path.join(process.cwd(), 'messaging-contract-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      this.contractAddress = config.address;
      console.log(`📜 Loaded messaging contract at: ${this.contractAddress}`);
    }
  }

  /**
   * Deploy the messaging contract to Base Chain
   */
  async deployContract(): Promise<string> {
    try {
      const privateKey = process.env.XMTP_EOA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Private key not available for contract deployment');
      }

      const wallet = new ethers.Wallet(privateKey, this.provider);
      console.log(`🚀 Deploying messaging contract from: ${wallet.address}`);

      // Check balance
      const balance = await this.provider.getBalance(wallet.address);
      console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH`);

      // Create contract factory
      const factory = new ethers.ContractFactory(
        MESSAGING_CONTRACT_ABI,
        MESSAGING_CONTRACT_BYTECODE,
        wallet
      );

      // Deploy contract
      console.log('📝 Deploying contract...');
      const contract = await factory.deploy();
      
      console.log(`⏳ Waiting for deployment transaction: ${contract.target}`);
      await contract.waitForDeployment();

      const address = await contract.getAddress();
      this.contractAddress = address;

      // Save contract address
      const configPath = path.join(process.cwd(), 'messaging-contract-config.json');
      fs.writeFileSync(configPath, JSON.stringify({
        address: address,
        deployedAt: new Date().toISOString(),
        network: 'base',
        deployer: wallet.address
      }, null, 2));

      console.log(`✅ Contract deployed at: ${address}`);
      console.log(`🔍 View on Basescan: https://basescan.org/address/${address}`);

      return address;
    } catch (error) {
      console.error('❌ Contract deployment failed:', error);
      throw error;
    }
  }

  /**
   * Send a message using the deployed contract
   */
  async sendMessage(recipientAddress: string, message: string): Promise<{
    txHash: string;
    messageId: number;
    explorerUrl: string;
  }> {
    if (!this.contractAddress) {
      throw new Error('Contract not deployed. Call deployContract() first.');
    }

    try {
      const privateKey = process.env.XMTP_EOA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Private key not available');
      }

      const wallet = new ethers.Wallet(privateKey, this.provider);
      const contract = new ethers.Contract(
        this.contractAddress,
        MESSAGING_CONTRACT_ABI,
        wallet
      );

      console.log(`📨 Sending message via contract to ${recipientAddress}`);
      console.log(`📝 Message: ${message.substring(0, 100)}...`);

      // Send transaction
      const tx = await contract.sendMessage(recipientAddress, message);
      console.log(`✅ Transaction sent: ${tx.hash}`);
      console.log(`🔍 View on Basescan: https://basescan.org/tx/${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

      // Get message ID from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsedLog = contract.interface.parseLog(log);
          return parsedLog?.name === 'MessageSent';
        } catch {
          return false;
        }
      });

      let messageId = 0;
      if (event) {
        const parsedLog = contract.interface.parseLog(event);
        messageId = Number(parsedLog?.args[0] || 0);
        console.log(`📬 Message ID: ${messageId}`);
      }

      return {
        txHash: tx.hash,
        messageId: messageId,
        explorerUrl: `https://basescan.org/tx/${tx.hash}`
      };
    } catch (error) {
      console.error('❌ Failed to send message via contract:', error);
      throw error;
    }
  }

  /**
   * Get messages sent to a recipient
   */
  async getRecipientMessages(recipientAddress: string): Promise<any[]> {
    if (!this.contractAddress) {
      throw new Error('Contract not deployed');
    }

    const contract = new ethers.Contract(
      this.contractAddress,
      MESSAGING_CONTRACT_ABI,
      this.provider
    );

    const messageIds = await contract.getRecipientMessages(recipientAddress);
    
    const messages = [];
    for (const id of messageIds) {
      const [sender, recipient, content, timestamp] = await contract.getMessage(id);
      messages.push({
        id: Number(id),
        sender,
        recipient,
        content,
        timestamp: Number(timestamp)
      });
    }

    return messages;
  }

  getContractAddress(): string | null {
    return this.contractAddress;
  }
}

export const messagingContractService = new MessagingContractService();
