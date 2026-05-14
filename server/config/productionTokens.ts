// Production token configuration for real DEX trading
export const PRODUCTION_TOKENS = {
  // Major cryptocurrencies
  ETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    coingeckoId: 'ethereum'
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coingeckoId: 'usd-coin'
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coingeckoId: 'tether'
  },
  // USDT on Base chain (bridged) - for x402 payments
  USDT_BASE: {
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    symbol: 'USDT',
    name: 'Tether USD (Base)',
    decimals: 6,
    coingeckoId: 'tether',
    chain: 'base'
  },
  WBTC: {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin'
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    coingeckoId: 'dai'
  },
  LINK: {
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    symbol: 'LINK',
    name: 'Chainlink',
    decimals: 18,
    coingeckoId: 'chainlink'
  },
  UNI: {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
    coingeckoId: 'uniswap'
  },
  AAVE: {
    address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    symbol: 'AAVE',
    name: 'Aave',
    decimals: 18,
    coingeckoId: 'aave'
  },
  // Meme tokens and trending
  PEPE: {
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    symbol: 'PEPE',
    name: 'Pepe',
    decimals: 18,
    coingeckoId: 'pepe'
  },
  SHIB: {
    address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    symbol: 'SHIB',
    name: 'Shiba Inu',
    decimals: 18,
    coingeckoId: 'shiba-inu'
  },
  // Base Chain tokens (for multi-chain)
  CBETH: {
    address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    coingeckoId: 'coinbase-wrapped-staked-eth'
  },
  // PEEZY Token - High-demand trading pair
  PEEZY: {
    address: '0xA0b86a33E6441E983BF0A96a1a5E86C3c1b8c2Fb',
    symbol: 'PEEZY',
    name: 'PEEZY Token',
    decimals: 18,
    coingeckoId: 'peezy'
  },
  // RAILZ Token - Coin Railz Platform Token (Base Chain)
  RALZ: {
    address: '0x2D45A4E7B3a89FbA480051c972c3A461d886aE28',
    symbol: 'RALZ',
    name: 'Railz Token',
    decimals: 18,
    coingeckoId: 'railz-token',
    chain: 'base',
    description: 'Native utility token for Coin Railz platform - AI-powered fintech infrastructure'
  },
  // VLT - Bankroll Vault (Ethereum mainnet)
  VLT: {
    address: '0x6b785a0322126826d8226d77e173d75DAfb84d11',
    symbol: 'VLT',
    name: 'Bankroll Vault',
    decimals: 18,
    coingeckoId: 'bankroll-vault',
    chain: 'ethereum',
    description: 'Fixed-supply Ethereum asset backed by secured onchain liquidity. Proof of Liquidity model — trading fees deepen the Uniswap V2 pool. No admin keys. No mint function. Immutable contracts since 2020.'
  }
};

export const POPULAR_PAIRS = [
  ['ETH', 'USDC'],
  ['ETH', 'USDT'],
  ['WBTC', 'ETH'],
  ['LINK', 'ETH'],
  ['UNI', 'ETH'],
  ['PEPE', 'ETH'],
  ['SHIB', 'ETH'],
  ['DAI', 'USDC'],
  ['AAVE', 'ETH'],
  ['VLT', 'ETH'],
  ['VLT', 'USDC'],
  ['ETH', 'VLT']
];

export function getTokenBySymbol(symbol: string) {
  return PRODUCTION_TOKENS[symbol as keyof typeof PRODUCTION_TOKENS];
}

export function isValidTradingPair(fromToken: string, toToken: string) {
  return getTokenBySymbol(fromToken) && getTokenBySymbol(toToken) && fromToken !== toToken;
}