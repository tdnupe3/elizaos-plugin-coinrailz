/**
 * Deploy ERC-8004 Identity and Reputation Registries to Base Sepolia Testnet
 */

import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY as `0x${string}`; // Repurpose for Base deployment

if (!PRIVATE_KEY || PRIVATE_KEY === 'your-private-key-here') {
  console.error('❌ Missing SOLANA_PRIVATE_KEY environment variable');
  console.error('Set it to your Base Sepolia testnet wallet private key');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

async function compileContract(contractPath: string): Promise<{ abi: any[], bytecode: string }> {
  console.log(`📦 Compiling ${contractPath}...`);
  
  try {
    const { stdout } = await execAsync(
      `solc --optimize --optimize-runs 200 --combined-json abi,bin ${contractPath} @openzeppelin/=$(pwd)/node_modules/@openzeppelin/`
    );
    
    const output = JSON.parse(stdout);
    const contractKey = Object.keys(output.contracts).find(key => key.includes(contractPath));
    
    if (!contractKey) {
      throw new Error('Contract not found in compilation output');
    }
    
    const contract = output.contracts[contractKey];
    
    return {
      abi: JSON.parse(contract.abi),
      bytecode: `0x${contract.bin}`
    };
  } catch (error: any) {
    console.error(`❌ Compilation failed:`, error.message);
    throw error;
  }
}

async function deployContract(
  name: string,
  abi: any[],
  bytecode: string,
  constructorArgs: any[] = []
): Promise<{ address: string, txHash: string }> {
  console.log(`\n🚀 Deploying ${name}...`);
  console.log(`Deployer: ${account.address}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${(Number(balance) / 1e18).toFixed(4)} ETH`);
  
  if (balance === 0n) {
    throw new Error(`❌ No ETH balance! Get testnet ETH from https://www.coinbase.com/faucets/base-ethereum-goerli-faucet`);
  }
  
  // Deploy
  const hash = await walletClient.deployContract({
    abi,
    bytecode: bytecode as `0x${string}`,
    args: constructorArgs
  });
  
  console.log(`📝 Transaction: ${hash}`);
  console.log(`⏳ Waiting for confirmation...`);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  
  if (!receipt.contractAddress) {
    throw new Error('Contract deployment failed - no address');
  }
  
  console.log(`✅ ${name} deployed!`);
  console.log(`📍 Address: ${receipt.contractAddress}`);
  console.log(`🔗 BaseScan: https://sepolia.basescan.org/address/${receipt.contractAddress}`);
  
  return {
    address: receipt.contractAddress,
    txHash: hash
  };
}

async function main() {
  console.log('🎯 ERC-8004 Deployment to Base Sepolia Testnet\n');
  console.log('═'.repeat(60));
  
  try {
    // Compile contracts
    const identityContract = await compileContract('contracts/ERC8004IdentityRegistry.sol');
    const reputationContract = await compileContract('contracts/ERC8004ReputationRegistry.sol');
    
    // Deploy Identity Registry
    const identityDeployment = await deployContract(
      'ERC8004 Identity Registry',
      identityContract.abi,
      identityContract.bytecode
    );
    
    // Deploy Reputation Registry
    const reputationDeployment = await deployContract(
      'ERC8004 Reputation Registry',
      reputationContract.abi,
      reputationContract.bytecode
    );
    
    // Save deployment config
    const config = {
      network: 'base-sepolia',
      chainId: 84532,
      deployedAt: new Date().toISOString(),
      deployer: account.address,
      contracts: {
        identityRegistry: {
          address: identityDeployment.address,
          txHash: identityDeployment.txHash,
          abi: identityContract.abi
        },
        reputationRegistry: {
          address: reputationDeployment.address,
          txHash: reputationDeployment.txHash,
          abi: reputationContract.abi
        }
      },
      explorer: {
        identity: `https://sepolia.basescan.org/address/${identityDeployment.address}`,
        reputation: `https://sepolia.basescan.org/address/${reputationDeployment.address}`
      }
    };
    
    await writeFile(
      'erc8004-deployment-sepolia.json',
      JSON.stringify(config, null, 2)
    );
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ DEPLOYMENT COMPLETE!');
    console.log('═'.repeat(60));
    console.log('\n📄 Configuration saved to: erc8004-deployment-sepolia.json');
    console.log('\n🔗 Contract Addresses:');
    console.log(`   Identity Registry:   ${identityDeployment.address}`);
    console.log(`   Reputation Registry: ${reputationDeployment.address}`);
    console.log('\n🌐 BaseScan Links:');
    console.log(`   Identity: ${config.explorer.identity}`);
    console.log(`   Reputation: ${config.explorer.reputation}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Verify contracts on BaseScan');
    console.log('   2. Mint agent NFTs using registerAgent()');
    console.log('   3. Test reputation submission flow');
    console.log('   4. Deploy to mainnet after testing\n');
    
  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

main();
