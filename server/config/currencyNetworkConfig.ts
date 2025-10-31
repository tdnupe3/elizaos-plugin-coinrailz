// Centralized currency-network configuration
// This file is the single source of truth for currency/network metadata

import { CURRENCY_NETWORK_MATRIX, isValidCurrencyNetworkCombination as validateCurrencyNetwork } from '../../shared/currencyNetworkConfig';

// Re-export for backward compatibility
export { CURRENCY_NETWORK_MATRIX };

export interface TokenConfig {
  decimals: number;
  type: 'native' | 'erc20';
  contractAddress?: string; // Only for ERC-20 tokens
}

export interface NetworkConfig {
  rpcUrl: string;
  tokens: Record<string, TokenConfig>;
}

// Get Alchemy API key or throw error if not configured
const getAlchemyKey = () => {
  const key = process.env.HELIUS_API_KEY; // Note: Using HELIUS_API_KEY env var which contains Alchemy key
  if (!key) {
    throw new Error('HELIUS_API_KEY not configured - required for Alchemy RPC endpoints');
  }
  return key;
};

// Network configurations with RPC endpoints and token addresses
export const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  base: {
    rpcUrl: `https://base-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`,
    tokens: {
      USDC: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      }
    }
  },
  ethereum: {
    rpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`,
    tokens: {
      USDC: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      },
      USDT: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      },
      ETH: {
        type: 'native',
        decimals: 18
      }
    }
  },
  polygon: {
    rpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`,
    tokens: {
      USDC: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
      },
      USDT: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
      }
    }
  },
  arbitrum: {
    rpcUrl: `https://arb-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`,
    tokens: {
      USDC: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
      },
      USDT: {
        type: 'erc20',
        decimals: 6,
        contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
      },
      ETH: {
        type: 'native',
        decimals: 18
      }
    }
  },
  bnb: {
    rpcUrl: 'https://bsc-dataseed.binance.org/',
    tokens: {
      USDT: {
        type: 'erc20',
        decimals: 18, // USDT on BSC uses 18 decimals
        contractAddress: '0x55d398326f99059fF775485246999027B3197955'
      },
      BNB: {
        type: 'native',
        decimals: 18
      }
    }
  }
};

// Helper function to get token config
export function getTokenConfig(currency: string, network: string): TokenConfig | null {
  const networkConfig = NETWORK_CONFIGS[network.toLowerCase()];
  if (!networkConfig) return null;
  return networkConfig.tokens[currency.toUpperCase()] || null;
}

// Helper function to validate currency-network combination (delegates to shared)
export function isValidCurrencyNetworkCombination(currency: string, network: string): boolean {
  return validateCurrencyNetwork(currency, network);
}

// Helper function to get RPC URL for a network
export function getRpcUrl(network: string): string | null {
  const networkConfig = NETWORK_CONFIGS[network.toLowerCase()];
  return networkConfig?.rpcUrl || null;
}
