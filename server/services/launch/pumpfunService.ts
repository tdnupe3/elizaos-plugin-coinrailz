import { 
  PublicKey, 
  LAMPORTS_PER_SOL,
  Keypair,
  VersionedTransaction,
  Connection
} from '@solana/web3.js';
import { launcherWalletService } from './launcherWalletService';
import bs58 from 'bs58';

export const PUMPFUN_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const PUMPFUN_TOKEN_DECIMALS = 6;

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  imageUrl?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface LaunchConfig {
  metadata: TokenMetadata;
  initialLiquiditySol: number;
  priorityFeeMicroLamports: number;
  mode: 'paper' | 'live';
}

export interface LaunchResult {
  success: boolean;
  tokenMint?: string;
  signature?: string;
  bondingCurve?: string;
  pumpfunUrl?: string;
  error?: string;
  mode: 'paper' | 'live';
  cost: {
    gasSol: number;
    liquiditySol: number;
    totalSol: number;
  };
}

export interface TradeConfig {
  tokenMint: string;
  action: 'buy' | 'sell';
  amountSol?: number;
  amountPercent?: string;
  slippage: number;
  priorityFee: number;
}

export interface TradeResult {
  success: boolean;
  signature?: string;
  error?: string;
}

const BOT_ATTRACTIVE_TICKERS = [
  'PEPE', 'DOGE', 'SHIB', 'BONK', 'WIF', 'MEME', 'FROG', 'CHAD', 'WOJAK', 'APE',
  'MOON', 'PUMP', 'BULL', 'BEAR', 'YEET', 'GIGA', 'WAGMI', 'HODL', 'SEND', 'BASED',
  'TRUMP', 'ELON', 'CHAD', 'KEKW', 'COPE', 'RATIO', 'SHILL', 'FOMO', 'DEGEN', 'REKT'
];

const BOT_ATTRACTIVE_PREFIXES = [
  'Baby', 'Mini', 'Mega', 'Super', 'Ultra', 'Giga', 'Turbo', 'Hyper', 'Epic', 'Based',
  'Chad', 'Alpha', 'Sigma', 'Omega', 'King', 'Lord', 'Sir', 'Degen', 'Rich', 'Moon'
];

const BOT_ATTRACTIVE_SUFFIXES = [
  'Inu', 'Cat', 'Dog', 'Coin', 'Token', 'AI', 'GPT', 'Bot', 'DAO', 'Fi',
  '2.0', 'X', 'Pro', 'Max', 'Plus', 'Gold', 'Moon', 'Mars', 'Sol', 'Pump'
];

export function generateBotAttractiveMetadata(): TokenMetadata {
  const usePrefix = Math.random() > 0.4;
  const useSuffix = Math.random() > 0.4;
  
  const baseTicker = BOT_ATTRACTIVE_TICKERS[Math.floor(Math.random() * BOT_ATTRACTIVE_TICKERS.length)];
  const prefix = usePrefix ? BOT_ATTRACTIVE_PREFIXES[Math.floor(Math.random() * BOT_ATTRACTIVE_PREFIXES.length)] : '';
  const suffix = useSuffix ? BOT_ATTRACTIVE_SUFFIXES[Math.floor(Math.random() * BOT_ATTRACTIVE_SUFFIXES.length)] : '';
  
  const name = `${prefix}${baseTicker}${suffix}`.slice(0, 20);
  const symbol = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  
  const descriptions = [
    `${name} - The next 1000x gem on Solana!`,
    `${name} to the moon! Community-driven meme token`,
    `Join the ${name} revolution! Fair launch, no presale`,
    `${name} - Built different. WAGMI!`,
    `The most based token on Solana. ${name} szn!`,
    `${name} - No dev wallets, 100% community owned`,
    `Are you early on ${name}? LFG!`,
    `${name} is inevitable. Get in before it moons!`
  ];
  
  return {
    name,
    symbol,
    description: descriptions[Math.floor(Math.random() * descriptions.length)]
  };
}

export function generateMemeSupply(): bigint {
  const memeSupplies = [
    420_000_000n,
    69_000_000_000n,
    1_000_000_000_000n,
    420_690_000_000n,
    1_000_000_000n
  ];
  return memeSupplies[Math.floor(Math.random() * memeSupplies.length)];
}

export class PumpfunService {
  private static instance: PumpfunService;
  private readonly PUMPPORTAL_API = 'https://pumpportal.fun/api';
  private readonly PUMPFUN_IPFS = 'https://pump.fun/api/ipfs';

  public static getInstance(): PumpfunService {
    if (!this.instance) {
      this.instance = new PumpfunService();
    }
    return this.instance;
  }

  async launchToken(config: LaunchConfig): Promise<LaunchResult> {
    if (config.mode === 'paper') {
      return this.simulateLaunch(config);
    }

    const keypair = launcherWalletService.getKeypair();
    const connection = launcherWalletService.getConnection();

    if (!keypair) {
      return {
        success: false,
        error: 'Launcher wallet not initialized',
        mode: config.mode,
        cost: { gasSol: 0, liquiditySol: 0, totalSol: 0 }
      };
    }

    try {
      const estimatedGas = 0.02;
      const totalCost = config.initialLiquiditySol + estimatedGas;

      const balance = await connection.getBalance(keypair.publicKey);
      const balanceSol = balance / LAMPORTS_PER_SOL;

      if (balanceSol < totalCost) {
        return {
          success: false,
          error: `Insufficient balance. Have ${balanceSol.toFixed(4)} SOL, need ${totalCost.toFixed(4)} SOL`,
          mode: config.mode,
          cost: { gasSol: estimatedGas, liquiditySol: config.initialLiquiditySol, totalSol: totalCost }
        };
      }

      const mintKeypair = Keypair.generate();
      
      console.log(`🚀 Launching token via PumpPortal: ${config.metadata.name} (${config.metadata.symbol})`);
      console.log(`   Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`   Initial buy: ${config.initialLiquiditySol} SOL`);

      const metadataUri = await this.uploadMetadata(config.metadata);
      
      if (!metadataUri) {
        return {
          success: false,
          error: 'Failed to upload metadata to IPFS',
          mode: config.mode,
          cost: { gasSol: 0, liquiditySol: 0, totalSol: 0 }
        };
      }

      console.log(`   Metadata URI: ${metadataUri}`);

      const createResponse = await fetch(`${this.PUMPPORTAL_API}/trade-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: keypair.publicKey.toBase58(),
          action: 'create',
          tokenMetadata: {
            name: config.metadata.name,
            symbol: config.metadata.symbol,
            uri: metadataUri
          },
          mint: mintKeypair.publicKey.toBase58(),
          denominatedInSol: 'true',
          amount: config.initialLiquiditySol,
          slippage: 10,
          priorityFee: config.priorityFeeMicroLamports / 1_000_000,
          pool: 'pump'
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        return {
          success: false,
          error: `PumpPortal API error: ${createResponse.status} - ${errorText}`,
          mode: config.mode,
          cost: { gasSol: estimatedGas, liquiditySol: 0, totalSol: estimatedGas }
        };
      }

      const txData = await createResponse.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
      
      tx.sign([keypair, mintKeypair]);

      const signature = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3
      });

      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`   ✅ Token launched! Signature: ${signature}`);
      console.log(`   🔗 https://pump.fun/${mintKeypair.publicKey.toBase58()}`);

      return {
        success: true,
        tokenMint: mintKeypair.publicKey.toBase58(),
        signature,
        pumpfunUrl: `https://pump.fun/${mintKeypair.publicKey.toBase58()}`,
        mode: config.mode,
        cost: {
          gasSol: estimatedGas,
          liquiditySol: config.initialLiquiditySol,
          totalSol: totalCost
        }
      };

    } catch (error: any) {
      console.error('❌ Token launch failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error',
        mode: config.mode,
        cost: { gasSol: 0, liquiditySol: 0, totalSol: 0 }
      };
    }
  }

  private async uploadMetadata(metadata: TokenMetadata): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('name', metadata.name);
      formData.append('symbol', metadata.symbol);
      formData.append('description', metadata.description);
      formData.append('showName', 'true');
      
      if (metadata.twitter) formData.append('twitter', metadata.twitter);
      if (metadata.telegram) formData.append('telegram', metadata.telegram);
      if (metadata.website) formData.append('website', metadata.website);

      const defaultImage = await this.generatePlaceholderImage(metadata.symbol);
      formData.append('file', new Blob([defaultImage], { type: 'image/png' }), 'token.png');

      const response = await fetch(this.PUMPFUN_IPFS, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.error('IPFS upload failed:', await response.text());
        return null;
      }

      const result = await response.json();
      return result.metadataUri;
    } catch (error) {
      console.error('Failed to upload metadata:', error);
      return null;
    }
  }

  private async generatePlaceholderImage(symbol: string): Promise<Buffer> {
    const sanitizedSymbol = symbol.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
    const color1 = this.randomColor();
    const color2 = this.randomColor();
    
    const svg = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#${color1};stop-opacity:1" /><stop offset="100%" style="stop-color:#${color2};stop-opacity:1" /></linearGradient></defs><rect width="256" height="256" fill="url(#bg)"/><text x="128" y="140" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">${sanitizedSymbol}</text></svg>`;
    return Buffer.from(svg);
  }

  private randomColor(): string {
    return Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  }

  async sellToken(config: TradeConfig): Promise<TradeResult> {
    const keypair = launcherWalletService.getKeypair();
    const connection = launcherWalletService.getConnection();

    if (!keypair) {
      return { success: false, error: 'Launcher wallet not initialized' };
    }

    try {
      console.log(`💰 Selling ${config.amountPercent || config.amountSol} of ${config.tokenMint}`);

      const response = await fetch(`${this.PUMPPORTAL_API}/trade-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: keypair.publicKey.toBase58(),
          action: 'sell',
          mint: config.tokenMint,
          denominatedInSol: 'false',
          amount: config.amountPercent || config.amountSol,
          slippage: config.slippage,
          priorityFee: config.priorityFee,
          pool: 'pump'
        })
      });

      if (!response.ok) {
        return { success: false, error: `Sell failed: ${response.status}` };
      }

      const txData = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
      tx.sign([keypair]);

      const signature = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3
      });

      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`   ✅ Sold! Signature: ${signature}`);
      return { success: true, signature };

    } catch (error: any) {
      console.error('Sell failed:', error);
      return { success: false, error: error.message };
    }
  }

  private async simulateLaunch(config: LaunchConfig): Promise<LaunchResult> {
    const fakeMint = Keypair.generate().publicKey.toBase58();
    const fakeBondingCurve = Keypair.generate().publicKey.toBase58();
    const fakeSignature = `paper_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    
    const estimatedGas = 0.02 + Math.random() * 0.01;
    
    console.log(`📝 [PAPER MODE] Simulating launch: ${config.metadata.name} (${config.metadata.symbol})`);
    console.log(`   Simulated mint: ${fakeMint}`);
    console.log(`   Simulated cost: ${(estimatedGas + config.initialLiquiditySol).toFixed(4)} SOL`);

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const successRate = 0.90;
    const success = Math.random() < successRate;

    if (success) {
      return {
        success: true,
        tokenMint: fakeMint,
        signature: fakeSignature,
        bondingCurve: fakeBondingCurve,
        pumpfunUrl: `https://pump.fun/${fakeMint}`,
        mode: 'paper',
        cost: {
          gasSol: estimatedGas,
          liquiditySol: config.initialLiquiditySol,
          totalSol: estimatedGas + config.initialLiquiditySol
        }
      };
    } else {
      return {
        success: false,
        error: 'Simulated transaction failed (random failure for testing)',
        mode: 'paper',
        cost: {
          gasSol: estimatedGas,
          liquiditySol: 0,
          totalSol: estimatedGas
        }
      };
    }
  }

  async estimateLaunchCost(initialLiquiditySol: number): Promise<{
    gasSol: number;
    liquiditySol: number;
    totalSol: number;
    totalUsd: number;
  }> {
    const gasSol = 0.02;
    const pumpfunFee = 0.005;
    const totalSol = gasSol + pumpfunFee + initialLiquiditySol;
    const solPrice = 220;
    
    return {
      gasSol: gasSol + pumpfunFee,
      liquiditySol: initialLiquiditySol,
      totalSol,
      totalUsd: totalSol * solPrice
    };
  }
}

export const pumpfunService = new PumpfunService();
