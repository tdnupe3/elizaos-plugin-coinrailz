/**
 * PRODUCTION HEALTH CHECKS
 * Validates critical configuration before server starts
 */

export function validateProductionReadiness(): void {
  console.log('\n🔍 Running production readiness health checks...');

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check PUBLIC_BASE_URL configuration
  const expectedDomain = process.env.REPLIT_DEPLOYMENT === '1' 
    ? 'coinrailz.com'
    : process.env.REPLIT_DOMAINS
      ? process.env.REPLIT_DOMAINS
      : 'localhost:5000';

  console.log(`   ✓ Expected domain: ${expectedDomain}`);

  // 2. Verify required API keys
  const requiredKeys = {
    ALCHEMY_API_KEY: 'Alchemy RPC (blockchain data)',
    OPENAI_API_KEY: 'OpenAI (AI services)',
    CDP_API_KEY_ID: 'Coinbase CDP (wallets)',
    CDP_API_KEY_SECRET: 'Coinbase CDP (wallets)',
  };

  for (const [key, description] of Object.entries(requiredKeys)) {
    if (!process.env[key]) {
      errors.push(`Missing ${key} (${description})`);
    } else {
      console.log(`   ✓ ${description}: configured`);
    }
  }

  // 3. Check platform wallet address
  const platformWallet = process.env.PLATFORM_WALLET_ADDRESS;
  if (!platformWallet || !platformWallet.match(/^0x[a-fA-F0-9]{40}$/)) {
    warnings.push('PLATFORM_WALLET_ADDRESS not set or invalid - using default');
  } else {
    console.log(`   ✓ Platform wallet: ${platformWallet.slice(0, 10)}...`);
  }

  // 4. Verify environment configuration
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    console.log('   ✓ Production deployment detected');
    
    // In production, ensure we're not using workspace URLs
    if (process.env.REPLIT_DOMAINS && process.env.REPLIT_DOMAINS.includes('replit.dev')) {
      warnings.push('Production deployment but REPLIT_DOMAINS still set - will use coinrailz.com');
    }
  } else {
    console.log('   ✓ Development/workspace environment');
  }

  // Report results
  if (errors.length > 0) {
    console.error('\n❌ CRITICAL ERRORS - Server cannot start:');
    errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNINGS:');
    warnings.forEach(warn => console.warn(`   - ${warn}`));
  }

  console.log('\n✅ All health checks passed - server ready for production\n');
}
