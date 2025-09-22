/**
 * 🔐 SECURE WALLET EXPORT UTILITY
 * This script helps you safely export your wallet for use with MetaMask or Blockscan Chat
 * 
 * SECURITY WARNINGS:
 * - Only run this on your secure, private computer
 * - Never share the private key with anyone
 * - Delete this output after importing to MetaMask
 * - This wallet contains funds - treat it like cash
 */

const { CdpClient } = require('@coinbase/cdp-sdk');

async function exportWalletSafely() {
    try {
        console.log('🔐 WALLET EXPORT UTILITY');
        console.log('========================');
        console.log('⚠️  SECURITY WARNING: Private keys are like cash - never share them!');
        console.log('');

        // Your current wallet address (visible on blockchain)
        const walletAddress = "0x337b1b6a0FA833Ae09a697606Ca3FD21ADF696ed";
        console.log(`📍 Wallet Address: ${walletAddress}`);
        console.log('');

        console.log('🔑 To access this wallet:');
        console.log('');
        console.log('OPTION 1: Get Private Key (ADVANCED USERS ONLY)');
        console.log('==============================================');
        console.log('1. Set environment variables:');
        console.log('   CDP_API_KEY_ID=your_cdp_key_id');
        console.log('   CDP_PRIVATE_KEY=your_cdp_private_key');
        console.log('2. Run this script in your terminal with Node.js');
        console.log('3. Copy the private key to MetaMask (Import Account)');
        console.log('4. DELETE this output immediately after importing');
        console.log('');

        console.log('OPTION 2: Use Coinbase Wallet App (RECOMMENDED)');
        console.log('===============================================');
        console.log('1. Download Coinbase Wallet mobile app');
        console.log('2. Sign in with your Coinbase account');
        console.log('3. Your CDP wallets will appear automatically');
        console.log('4. Connect to Blockscan Chat directly from the app');
        console.log('');

        console.log('OPTION 3: Fund BNB Wallet (EASIEST)');
        console.log('===================================');
        console.log('1. Use our platform to create a new BNB wallet');
        console.log('2. Fund it with BNB for messaging on BSC');
        console.log('3. Export that wallet instead (simpler)');
        console.log('');

        // Only show private key if explicitly requested
        if (process.argv.includes('--export-private-key')) {
            console.log('🚨 EXPORTING PRIVATE KEY - HANDLE WITH EXTREME CARE!');
            console.log('================================================');
            
            // Initialize CDP client
            const client = new CdpClient();
            
            // Note: This is a simplified example
            // The actual private key export depends on your CDP setup
            console.log('⚠️  Private key export requires CDP API access');
            console.log('⚠️  Use Coinbase Wallet app for safer access');
        } else {
            console.log('🛡️  To export private key, run: node wallet-export-utility.js --export-private-key');
            console.log('⚠️  WARNING: Only do this on a secure, private computer');
        }

        console.log('');
        console.log('💬 FOR BLOCKSCAN CHAT:');
        console.log('======================');
        console.log(`1. Go to https://chat.blockscan.com`);
        console.log(`2. Click "Connect Wallet"`);
        console.log(`3. Choose MetaMask or Coinbase Wallet`);
        console.log(`4. Your wallet (${walletAddress}) will connect`);
        console.log(`5. Start messaging other wallets for free!`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('');
        console.log('💡 TIP: For security, consider creating a new BNB wallet instead');
        console.log('This avoids exposing your main messaging wallet');
    }
}

// Export function for use
if (require.main === module) {
    exportWalletSafely();
}

module.exports = { exportWalletSafely };