/**
 * Deploy Messaging Smart Contract to Base Chain
 */

import solc from 'solc';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('🔧 Compiling Solidity contract...');

  // Read the contract source code
  const contractPath = path.join(process.cwd(), 'contracts', 'AgentMessaging.sol');
  const source = fs.readFileSync(contractPath, 'utf8');

  // Compile the contract
  const input = {
    language: 'Solidity',
    sources: {
      'AgentMessaging.sol': {
        content: source
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // Check for errors
  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ Compilation errors:');
      errors.forEach((err: any) => console.error(err.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['AgentMessaging.sol']['AgentMessaging'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  console.log('✅ Contract compiled successfully');
  console.log(`📏 Bytecode size: ${bytecode.length / 2 - 1} bytes`);

  // Deploy to Base Chain
  console.log('\n🚀 Deploying to Base Chain...');

  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const privateKey = process.env.XMTP_EOA_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('XMTP_EOA_PRIVATE_KEY not found in environment');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`👛 Deploying from: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error('Insufficient balance for deployment');
  }

  // Create contract factory
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  // Estimate deployment cost
  const deployTx = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas(deployTx);
  const feeData = await provider.getFeeData();
  const estimatedCost = gasEstimate * (feeData.gasPrice || 0n);

  console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
  console.log(`💵 Estimated cost: ${ethers.formatEther(estimatedCost)} ETH (~$${(parseFloat(ethers.formatEther(estimatedCost)) * 2500).toFixed(2)} USD)`);

  // Deploy
  console.log('\n📝 Deploying contract...');
  const contract2 = await factory.deploy();
  
  console.log(`⏳ Transaction sent: ${contract2.deploymentTransaction()?.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  await contract2.waitForDeployment();
  const address = await contract2.getAddress();

  console.log(`\n✅ Contract deployed successfully!`);
  console.log(`📍 Address: ${address}`);
  console.log(`🔍 Basescan: https://basescan.org/address/${address}`);

  // Save deployment info
  const config = {
    address: address,
    deployedAt: new Date().toISOString(),
    network: 'base',
    deployer: wallet.address,
    txHash: contract2.deploymentTransaction()?.hash,
    abi: abi
  };

  const configPath = path.join(process.cwd(), 'messaging-contract-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`💾 Config saved to: messaging-contract-config.json`);

  // Test the contract
  console.log('\n🧪 Testing contract...');
  const messageCount = await contract2.getMessageCount();
  console.log(`📊 Current message count: ${messageCount.toString()}`);

  console.log('\n🎉 Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
