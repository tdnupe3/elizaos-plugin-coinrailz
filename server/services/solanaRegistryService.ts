/**
 * Solana Registry Preparation Service
 * 
 * IMPORTANT: This service DOES NOT automatically register with any external directories.
 * It only PREPARES the registration payloads and documents the manual steps required.
 * 
 * Manual registration is required for:
 * - Helius Actions Directory (no public API - requires manual submission)
 * - Jupiter Integrator Registry (requires application form)
 * - Solana Pay Directory (requires merchant application)
 * 
 * After republishing, use the admin endpoint to get the prepared payloads,
 * then follow the manual registration steps documented in each result.
 */

interface RegistrationPreparation {
  registry: string;
  status: 'prepared' | 'error';
  payload: object;
  manualSteps: string[];
  registrationUrl?: string;
  timestamp: Date;
}

interface PreparationStatus {
  lastRun: Date | null;
  preparations: RegistrationPreparation[];
  note: string;
}

const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://coinrailz.com';
const PLATFORM_WALLET = process.env.SOLANA_PUBLIC_KEY || 'Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k';

let preparationStatus: PreparationStatus = {
  lastRun: null,
  preparations: [],
  note: 'No preparations have been run yet.'
};

export async function prepareHeliusActionsPayload(): Promise<RegistrationPreparation> {
  const preparation: RegistrationPreparation = {
    registry: 'Helius Actions Directory',
    status: 'prepared',
    payload: {},
    manualSteps: [],
    timestamp: new Date()
  };
  
  try {
    preparation.payload = {
      name: "Coin Railz Payment Actions",
      description: "Solana Actions for AI agent payments and data services",
      icon: `${BASE_URL}/favicon.ico`,
      website: BASE_URL,
      actions_url: `${BASE_URL}/.well-known/solana-actions.json`,
      
      actions: [
        {
          id: "create-payment-intent",
          name: "Create Payment Intent",
          href: `${BASE_URL}/solana-pay/intents`,
          method: "POST"
        },
        {
          id: "token-price-feed",
          name: "Token Price Feed",
          href: `${BASE_URL}/solana-pay/services/price/{mint}`,
          method: "GET"
        },
        {
          id: "trending-tokens",
          name: "Trending Tokens",
          href: `${BASE_URL}/solana-pay/services/trending`,
          method: "GET"
        }
      ],
      
      identity: {
        wallet: PLATFORM_WALLET,
        network: "mainnet"
      }
    };
    
    preparation.manualSteps = [
      '1. Helius does NOT have a public registration API',
      '2. Discovery relies on crawlers finding /.well-known/solana-actions.json',
      '3. To accelerate indexing, contact Helius directly via:',
      '   - Discord: https://discord.gg/helius',
      '   - Email: support@helius.xyz',
      '4. Provide them with your manifest URL for manual review',
      `5. Manifest URL: ${BASE_URL}/.well-known/solana-actions.json`
    ];
    
    preparation.registrationUrl = 'https://discord.gg/helius';
    
    console.log('📋 Helius Actions payload PREPARED (not submitted)');
    console.log('   Manifest URL:', `${BASE_URL}/.well-known/solana-actions.json`);
    console.log('   ⚠️  Manual contact with Helius required for indexing');
    
  } catch (error) {
    preparation.status = 'error';
    preparation.manualSteps = [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`];
    console.error('❌ Helius Actions preparation failed:', error);
  }
  
  return preparation;
}

export async function prepareJupiterPayload(): Promise<RegistrationPreparation> {
  const preparation: RegistrationPreparation = {
    registry: 'Jupiter Integrator Registry',
    status: 'prepared',
    payload: {},
    manualSteps: [],
    timestamp: new Date()
  };
  
  try {
    preparation.payload = {
      name: "Coin Railz",
      description: "Payment infrastructure for AI agents with Solana Pay support",
      website: BASE_URL,
      logo: `${BASE_URL}/favicon.ico`,
      
      integration_type: "payment_processor",
      
      endpoints: {
        catalog: `${BASE_URL}/solana-pay/catalog`,
        create_payment: `${BASE_URL}/solana-pay/intents`,
        check_status: `${BASE_URL}/solana-pay/intents/{id}`
      },
      
      supported_tokens: [
        "SOL",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "Es9vMFrzaCERmnn4Xw4Jp9Dzk1XjCK8dygBBhPokv9wg"
      ],
      
      fee_structure: {
        type: "percentage",
        rate: 0.005
      }
    };
    
    preparation.manualSteps = [
      '1. Jupiter requires partner application for integration',
      '2. Visit: https://jup.ag/partners',
      '3. Fill out the partner application form',
      '4. Provide the following information:',
      `   - Website: ${BASE_URL}`,
      `   - Catalog endpoint: ${BASE_URL}/solana-pay/catalog`,
      '5. Wait for Jupiter team review (typically 1-2 weeks)'
    ];
    
    preparation.registrationUrl = 'https://jup.ag/partners';
    
    console.log('📋 Jupiter integration payload PREPARED (not submitted)');
    console.log('   Integration type: payment_processor');
    console.log('   ⚠️  Manual partner application required');
    
  } catch (error) {
    preparation.status = 'error';
    preparation.manualSteps = [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`];
    console.error('❌ Jupiter preparation failed:', error);
  }
  
  return preparation;
}

export async function prepareSolanaPayPayload(): Promise<RegistrationPreparation> {
  const preparation: RegistrationPreparation = {
    registry: 'Solana Pay Directory',
    status: 'prepared',
    payload: {},
    manualSteps: [],
    timestamp: new Date()
  };
  
  try {
    preparation.payload = {
      name: "Coin Railz",
      description: "Multi-chain payment infrastructure for AI agents",
      website: BASE_URL,
      logo: `${BASE_URL}/favicon.ico`,
      support_email: "support@coinrailz.com",
      
      category: "payment_processor",
      subcategory: "ai_services",
      
      payment_config: {
        recipient_wallet: PLATFORM_WALLET,
        network: "mainnet-beta",
        memo_required: true,
        webhook_url: `${BASE_URL}/solana-pay/webhook`
      },
      
      manifest_url: `${BASE_URL}/.well-known/solana-pay.json`,
      
      accepted_tokens: ["SOL", "USDC", "USDT"]
    };
    
    preparation.manualSteps = [
      '1. Solana Pay merchant registration is handled through Solana Foundation',
      '2. Visit: https://solanapay.com/merchants',
      '3. Complete merchant verification process',
      '4. Provide the following for review:',
      `   - Website: ${BASE_URL}`,
      `   - Manifest: ${BASE_URL}/.well-known/solana-pay.json`,
      `   - Wallet: ${PLATFORM_WALLET}`,
      '5. Solana Pay SDK will auto-discover manifest once domain is verified'
    ];
    
    preparation.registrationUrl = 'https://solanapay.com/merchants';
    
    console.log('📋 Solana Pay merchant profile PREPARED (not submitted)');
    console.log('   Category: payment_processor');
    console.log('   ⚠️  Manual merchant verification required');
    
  } catch (error) {
    preparation.status = 'error';
    preparation.manualSteps = [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`];
    console.error('❌ Solana Pay preparation failed:', error);
  }
  
  return preparation;
}

export async function prepareAllRegistrations(): Promise<RegistrationPreparation[]> {
  const preparations: RegistrationPreparation[] = [];
  
  console.log('\n📋 SOLANA REGISTRY PREPARATION');
  console.log('================================');
  console.log('⚠️  NOTE: This ONLY prepares payloads. No actual registration occurs.');
  console.log(`Platform: ${BASE_URL}`);
  console.log(`Wallet: ${PLATFORM_WALLET}`);
  console.log('');
  
  preparations.push(await prepareHeliusActionsPayload());
  preparations.push(await prepareJupiterPayload());
  preparations.push(await prepareSolanaPayPayload());
  
  const successCount = preparations.filter(p => p.status === 'prepared').length;
  console.log('');
  console.log(`📊 Preparation Summary: ${successCount}/${preparations.length} payloads ready`);
  console.log('');
  
  console.log('📍 Discovery Manifests (published, awaiting external indexing):');
  console.log(`   • ${BASE_URL}/.well-known/solana.json`);
  console.log(`   • ${BASE_URL}/.well-known/solana-actions.json`);
  console.log(`   • ${BASE_URL}/.well-known/solana-pay.json`);
  console.log(`   • ${BASE_URL}/.well-known/helius.json`);
  console.log(`   • ${BASE_URL}/solana-openrpc.json`);
  console.log('');
  console.log('⚠️  MANUAL REGISTRATION REQUIRED:');
  console.log('   See manualSteps in each preparation result for next actions.');
  console.log('');
  
  preparationStatus = {
    lastRun: new Date(),
    preparations,
    note: 'Payloads prepared. Manual registration with each directory is required.'
  };
  
  return preparations;
}

export function getPreparationStatus(): PreparationStatus {
  return preparationStatus;
}

export async function initializeSolanaDiscovery(): Promise<void> {
  console.log('\n🚀 Solana Discovery Service Initialized');
  console.log('   ℹ️  Use POST /solana-pay/admin/discovery/register to prepare registration payloads');
  console.log('   ⚠️  Actual directory registration requires manual steps');
  
  if (process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production') {
    console.log('   📋 Production mode: Run admin endpoint after deployment to get registration instructions');
  }
}

// Legacy exports for backwards compatibility (renamed to be honest)
export const registerWithHeliusActions = prepareHeliusActionsPayload;
export const registerWithJupiterRegistry = prepareJupiterPayload;
export const registerWithSolanaPayDirectory = prepareSolanaPayPayload;
export const pingDiscoveryCrawlers = prepareAllRegistrations;
export const getRegistryStatus = getPreparationStatus;
