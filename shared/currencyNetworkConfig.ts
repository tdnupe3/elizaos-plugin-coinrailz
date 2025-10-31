// Shared currency-network compatibility configuration
// Used by both frontend and backend to ensure consistency

export const CURRENCY_NETWORK_MATRIX: Record<string, string[]> = {
  'USDC': ['base', 'ethereum', 'polygon', 'arbitrum'],
  'USDT': ['ethereum', 'polygon', 'arbitrum', 'bnb'],
  'ETH': ['ethereum', 'arbitrum'],
  'BNB': ['bnb']
};

// Helper function to validate currency-network combination
export function isValidCurrencyNetworkCombination(currency: string, network: string): boolean {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedNetwork = network.toLowerCase();
  const allowedNetworks = CURRENCY_NETWORK_MATRIX[normalizedCurrency];
  return allowedNetworks?.includes(normalizedNetwork) || false;
}

// Get available networks for a currency
export function getAvailableNetworks(currency: string): string[] {
  return CURRENCY_NETWORK_MATRIX[currency.toUpperCase()] || [];
}
