/**
 * 🌟 BNB WALLET SETUP & FUNDING GUIDE
 * Simple solution for BNB chain messaging
 */

const { ethers } = require('ethers');

async function createBNBWallet() {
    console.log('🌟 BNB WALLET SETUP');
    console.log('==================');
    console.log('');

    // Create a new wallet for BNB chain
    const wallet = ethers.Wallet.createRandom();
    
    console.log('✅ NEW BNB WALLET CREATED:');
    console.log(`📍 Address: ${wallet.address}`);
    console.log(`🔑 Private Key: ${wallet.privateKey}`);
    console.log('');
    
    console.log('⚠️  SECURITY: Save this private key safely! It controls your funds.');
    console.log('');
    
    console.log('💰 HOW TO FUND YOUR BNB WALLET:');
    console.log('===============================');
    console.log('');
    
    console.log('OPTION 1: From Coinbase (Easiest)');
    console.log('----------------------------------');
    console.log('1. Go to coinbase.com');
    console.log('2. Buy BNB (Binance Coin)');
    console.log('3. Click "Send" → paste your address above');
    console.log('4. Send 0.01 BNB ($6-10) for messaging');
    console.log('');
    
    console.log('OPTION 2: From Binance');
    console.log('----------------------');
    console.log('1. Create Binance account');
    console.log('2. Buy BNB');
    console.log('3. Withdraw to BSC network');
    console.log('4. Use your address above');
    console.log('');
    
    console.log('OPTION 3: From Crypto.com');
    console.log('-------------------------');
    console.log('1. Buy BNB on Crypto.com');
    console.log('2. Withdraw to "BNB Smart Chain"');
    console.log('3. Use your address above');
    console.log('');
    
    console.log('🔧 SETUP IN METAMASK:');
    console.log('=====================');
    console.log('1. Open MetaMask');
    console.log('2. Click "Add Network" → "Add network manually"');
    console.log('3. Enter BNB Smart Chain details:');
    console.log('   Network Name: BNB Smart Chain');
    console.log('   RPC URL: https://bsc-dataseed.binance.org/');
    console.log('   Chain ID: 56');
    console.log('   Symbol: BNB');
    console.log('   Block Explorer: https://bscscan.com');
    console.log('4. Click "Import Account" → paste private key above');
    console.log('');
    
    console.log('💬 CONNECT TO BLOCKSCAN CHAT:');
    console.log('=============================');
    console.log('1. Go to https://chat.blockscan.com');
    console.log('2. Connect with MetaMask');
    console.log('3. Switch to BNB Smart Chain network');
    console.log('4. Start messaging BNB projects!');
    console.log('');
    
    console.log('🎯 BNB CHAIN TARGETS:');
    console.log('=====================');
    console.log('• PancakeSwap (DEX)');
    console.log('• Venus Protocol (Lending)');
    console.log('• Binance Smart Chain projects');
    console.log('• Gaming projects (huge on BSC)');
    console.log('• DeFi protocols');
    console.log('');
    
    console.log('💡 MESSAGING COST:');
    console.log('==================');
    console.log('• BNB chain fees: ~$0.10-0.50 per message');
    console.log('• Much cheaper than Base chain');
    console.log('• 0.01 BNB = 20-100 messages');
    console.log('');
    
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase
    };
}

// Run if called directly
if (require.main === module) {
    createBNBWallet();
}

module.exports = { createBNBWallet };