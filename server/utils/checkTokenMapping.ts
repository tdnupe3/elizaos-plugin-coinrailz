/**
 * Token ID Mapping Checker
 * Investigate the Circle token ID b037d751-fb22-5f0d-bae6-47373e7ae3e3
 */

import { CircleService } from '../services/const circleService = new CircleService(); circleService.js';

async function checkTokenMapping() {
  console.log('🔍 Investigating Circle Token ID Mapping...');
  
  try {
    // Get supported tokens from Circle
    const tokens = await const circleService = new CircleService(); circleService.getSupportedTokens();
    console.log('\n📋 Circle Supported Tokens:');
    tokens.forEach((token, i) => {
      console.log(`   ${i+1}. ID: ${token.id} | Symbol: ${token.symbol} | Name: ${token.name}`);
      if (token.id === 'b037d751-fb22-5f0d-bae6-47373e7ae3e3') {
        console.log(`       🎯 THIS IS THE MYSTERY TOKEN!`);
      }
    });
    
    // Check if b037d751-fb22-5f0d-bae6-47373e7ae3e3 is actually USDC
    const usdcToken = tokens.find(t => t.symbol === 'USDC');
    if (usdcToken) {
      console.log(`\n💰 USDC Token Details:`);
      console.log(`   Token ID: ${usdcToken.id}`);
      console.log(`   Symbol: ${usdcToken.symbol}`);
      console.log(`   Name: ${usdcToken.name}`);
      
      if (usdcToken.id === 'b037d751-fb22-5f0d-bae6-47373e7ae3e3') {
        console.log(`   ✅ CONFIRMED: b037d751-fb22-5f0d-bae6-47373e7ae3e3 IS USDC!`);
      } else {
        console.log(`   ❌ Different token ID than transaction: ${usdcToken.id}`);
      }
    }
    
    // Check wallet balance using the mystery token ID
    const walletId = '540d451e-d4b5-5abc-9f29-7a41214d37e0'; // The wallet that received the $50
    console.log(`\n🔍 Checking wallet balance for specific token...`);
    
    const balances = await const circleService = new CircleService(); circleService.getWalletBalance(walletId);
    console.log(`\n📊 All balances for wallet ${walletId}:`);
    balances.forEach((balance, i) => {
      console.log(`   ${i+1}. Token: ${balance.tokenId} | Amount: ${balance.amount}`);
      if (balance.tokenId === 'b037d751-fb22-5f0d-bae6-47373e7ae3e3') {
        console.log(`       🎯 MYSTERY TOKEN BALANCE: ${balance.amount}`);
      }
      if (balance.tokenId === 'USDC') {
        console.log(`       💰 USDC BALANCE: ${balance.amount}`);
      }
    });
    
    return {
      success: true,
      tokens: tokens,
      usdcToken: usdcToken,
      mysteryTokenIsUsdc: usdcToken?.id === 'b037d751-fb22-5f0d-bae6-47373e7ae3e3',
      walletBalances: balances
    };
    
  } catch (error: any) {
    console.error('❌ Token mapping check failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

checkTokenMapping().then(result => {
  console.log('\n🏁 Token Mapping Investigation Complete');
  if (result.success) {
    console.log(`Found ${result.tokens?.length} supported tokens`);
    if (result.mysteryTokenIsUsdc) {
      console.log('✅ Mystery token IS USDC - balance should be updated');
    } else {
      console.log('❌ Mystery token is NOT USDC - investigate further');  
    }
  }
}).catch(console.error);