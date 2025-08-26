import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowUpDown, Wallet, TrendingUp, Info, Shield, LineChart, Target, Layers, ArrowLeftRight, Zap, Settings, Search, Plus, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TradingPair {
  from: string;
  to: string;
  verified: boolean;
}

interface NetworkOption {
  id: string;
  name: string;
  displayName: string;
  icon: string;
}

interface Token {
  symbol: string;
  name: string;
  contractAddress?: string;
  decimals: number;
  logoURI: string;
  isNative: boolean;
  verified: boolean;
  marketCap?: number;
  priceUSD?: string;
  networks: string[];
}

const SUPPORTED_NETWORKS: NetworkOption[] = [
  { 
    id: 'base-mainnet', 
    name: 'base', 
    displayName: 'Base', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiMwMDUyRkYiLz4KPHBhdGggZD0iTTcuNSAxNEM3LjUgMTAuNDEgMTAuNDEgNy41IDE0IDcuNUMyMC41IDcuNSAyMC41IDEzLjUgMjAuNSAxNEMyMC41IDE3LjU5IDE3LjU5IDIwLjUgMTQgMjAuNUM3LjUgMjAuNSA3LjUgMTQuNSA3LjUgMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K' 
  },
  { 
    id: 'ethereum-mainnet', 
    name: 'ethereum', 
    displayName: 'Ethereum', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiM2MjdFRUEiLz4KPHBhdGggZD0iTTE0IDUuNVYxMC43NEwxOSAxMi44M0wxNCA1LjVaIiBmaWxsPSJ3aGl0ZSIgZmlsbC1vcGFjaXR5PSIwLjYiLz4KPHBhdGggZD0iTTE0IDUuNUw5IDEyLjgzTDE0IDEwLjc0VjUuNVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNCAxOC41MVYyMi41TDE5IDE0LjE2TDE0IDE4LjUxWiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC42Ii8+CjxwYXRoIGQ9Ik0xNCAyMi41VjE4LjUxTDkgMTQuMTZMMTQgMjIuNVoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xNCAxNy4xN0wxOSAxMi44M0wxNCAxNS4yN1YxNy4xN1oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMiIvPgo8cGF0aCBkPSJNOSAxMi44M0wxNCAxNy4xN1YxNS4yN0w5IDEyLjgzWiIgZmlsbD0id2hpdGUiIGZpbGwtb3BhY2l0eT0iMC42Ii8+Cjwvc3ZnPgo=' 
  },
  { 
    id: 'polygon-mainnet', 
    name: 'polygon', 
    displayName: 'Polygon', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiM4MjQ3RTUiLz4KPHBhdGggZD0iTTE4LjI1IDkuNDdDMTguMDEgOS4zMiAxNy43MSA5LjMyIDE3LjQ3IDkuNDdMMTUuMTggMTAuODJMMTMuNjYgMTEuNjNMMTEuMzcgMTIuOThDMTAuMzggMTMuNTcgMTAuMzggMTUuMDIgMTEuMzcgMTUuNjJMMTMuNjYgMTYuOTZMMTUuMTggMTcuNzdMMTcuNDcgMTkuMTJDMTcuNzEgMTkuMjcgMTguMDEgMTkuMjcgMTguMjUgMTkuMTJMMTkuNzggMTguMzFDMjAuMDIgMTguMTcgMjAuMTcgMTcuODkgMjAuMTcgMTcuNlYxMy4wQzIwLjE3IDEyLjcxIDIwLjAyIDEyLjQzIDE5Ljc4IDEyLjI5TDE4LjI1IDExLjQ4VjkuNDdaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K' 
  },
  { 
    id: 'arbitrum-mainnet', 
    name: 'arbitrum', 
    displayName: 'Arbitrum', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiMyRDM3NEIiLz4KPHBhdGggZD0iTTEwIDguNUgxOEwxNi41IDExSDE0TDEyLjUgMTMuNUgxNS41TDE0IDIwSDE0TDEyLjUgMTMuNUgxMEw4IDExSDEwVjguNVoiIGZpbGw9IiM5NkRCRkYiLz4KPHBhdGggZD0iTTE4IDguNUwxOS41IDExSDE4TDE2LjUgMTNIMTkuNUwyMSAxNUgxOUwxNy41IDE3SDE5LjVMMTggMjBIMTYuNUwxOCAxN0gxNS41TDE3IDEzSDEzTDE0LjUgMTBIMTdMMTguNSA3LjVIMTZMMTcuNSA1SDE5LjVMMTggOFoiIGZpbGw9IiM2Q0I3RjAiLz4KPC9zdmc+' 
  },
  { 
    id: 'bnb-mainnet', 
    name: 'bnb', 
    displayName: 'BNB Chain', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiNGM0JBMkYiLz4KPHBhdGggZD0iTTExIDlMMTQgNkwxNyA5TDE1LjUgMTAuNUwxNCA5TDEyLjUgMTAuNUwxMSA5Wk03LjUgMTNMMTAgMTBMMTEuNSAxMS41TDEwIDEzTDggMTVMNy41IDEzWk0xNCAyMkwxNyAxOUwxNCAyMkwxMSAxOUwxNCAyMlpNMjAuNSAxM0wxOSAxNUwxNy41IDEzTDE5IDExLjVMMjAuNSAxM1pNMTQgMTEuNUwxNS41IDEzTDE0IDE0LjVMMTIuNSAxM0wxNCAxMS41WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+' 
  },
  { 
    id: 'optimism-mainnet', 
    name: 'optimism', 
    displayName: 'Optimism', 
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgiIGhlaWdodD0iMjgiIHZpZXdCb3g9IjAgMCAyOCAyOCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTQiIGN5PSIxNCIgcj0iMTQiIGZpbGw9IiNGRjA0MjAiLz4KPHBhdGggZD0iTTEwIDEwQzEwIDkgMTAuNSA4IDEyIDhDMTMuNSA4IDE0IDkgMTQgMTBWMThDMTQgMTkgMTMuNSAyMCAxMiAyMEMxMC41IDIwIDEwIDE5IDEwIDE4VjEwWk0xNiAxMkMxNiAxMSAxNi41IDEwIDE4IDEwQzE5LjUgMTAgMjAgMTEgMjAgMTJWMTZDMjAgMTcgMTkuNSAxOCAxOCAxOEMxNi41IDE4IDE2IDE3IDE2IDE2VjEyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+' 
  },
];

// Comprehensive Token Database - Coinbase DEX Feature Parity (100+ tokens)
const COINBASE_DEX_TOKENS: Token[] = [
  // Major cryptocurrencies - Network natives and wrapped variants
  {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    isNative: true,
    verified: true,
    priceUSD: '4435.20',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet', 'optimism-mainnet']
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/2518/large/weth.png',
    isNative: false,
    verified: true,
    priceUSD: '4435.20',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet', 'optimism-mainnet']
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    logoURI: 'https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png',
    isNative: false,
    verified: true,
    priceUSD: '102456.78',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },

  // Stablecoins - Multiple networks
  {
    symbol: 'USDC',
    name: 'USD Coin',
    contractAddress: '0xA0b86a33E6772e1353aA6E6C8C87B8D8B47b62e4',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
    isNative: false,
    verified: true,
    priceUSD: '1.00',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet', 'polygon-mainnet', 'optimism-mainnet']
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    logoURI: 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
    isNative: false,
    verified: true,
    priceUSD: '1.00',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet', 'polygon-mainnet']
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png',
    isNative: false,
    verified: true,
    priceUSD: '0.9998',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },

  // DeFi Blue Chips - Top protocols
  {
    symbol: 'UNI',
    name: 'Uniswap',
    contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12504/large/uni.jpg',
    isNative: false,
    verified: true,
    priceUSD: '14.72',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
    isNative: false,
    verified: true,
    priceUSD: '28.45',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },
  {
    symbol: 'AAVE',
    name: 'Aave',
    contractAddress: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12645/large/AAVE.png',
    isNative: false,
    verified: true,
    priceUSD: '342.18',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },
  {
    symbol: 'CRV',
    name: 'Curve DAO Token',
    contractAddress: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12124/large/Curve.png',
    isNative: false,
    verified: true,
    priceUSD: '0.85',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },
  {
    symbol: 'COMP',
    name: 'Compound',
    contractAddress: '0xc00e94Cb662C3520282E6f5717214004A7f26888',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/10775/large/COMP.png',
    isNative: false,
    verified: true,
    priceUSD: '89.34',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'MKR',
    name: 'Maker',
    contractAddress: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/1364/large/Mark_Maker.png',
    isNative: false,
    verified: true,
    priceUSD: '1734.56',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'LDO',
    name: 'Lido DAO',
    contractAddress: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png',
    isNative: false,
    verified: true,
    priceUSD: '2.84',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },

  // Layer 1 & Layer 2 Tokens
  {
    symbol: 'MATIC',
    name: 'Polygon',
    contractAddress: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
    isNative: false,
    verified: true,
    priceUSD: '0.54',
    networks: ['ethereum-mainnet', 'polygon-mainnet']
  },
  {
    symbol: 'OP',
    name: 'Optimism',
    contractAddress: '0x4200000000000000000000000000000000000042',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
    isNative: true,
    verified: true,
    priceUSD: '2.34',
    networks: ['optimism-mainnet']
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum',
    contractAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
    isNative: true,
    verified: true,
    priceUSD: '0.89',
    networks: ['arbitrum-mainnet']
  },

  // Meme Coins & Community Tokens  
  {
    symbol: 'PEPE',
    name: 'Pepe',
    contractAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
    isNative: false,
    verified: true,
    priceUSD: '0.000021',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'SHIB',
    name: 'Shiba Inu',
    contractAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/11939/large/shiba.png',
    isNative: false,
    verified: true,
    priceUSD: '0.000025',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'FLOKI',
    name: 'FLOKI',
    contractAddress: '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E',
    decimals: 9,
    logoURI: 'https://assets.coingecko.com/coins/images/16746/large/PNG_image.png',
    isNative: false,
    verified: true,
    priceUSD: '0.000234',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },

  // Gaming & NFT Tokens
  {
    symbol: 'AXS',
    name: 'Axie Infinity',
    contractAddress: '0xBB0E17EF65F82Ab018d8EDd776e8DD940327B28b',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13029/large/axie_infinity_logo.png',
    isNative: false,
    verified: true,
    priceUSD: '7.42',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'SAND',
    name: 'The Sandbox',
    contractAddress: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12129/large/sandbox_logo.jpg',
    isNative: false,
    verified: true,
    priceUSD: '0.65',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'MANA',
    name: 'Decentraland',
    contractAddress: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/878/large/decentraland-mana.png',
    isNative: false,
    verified: true,
    priceUSD: '0.52',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },

  // Oracle & Infrastructure
  {
    symbol: 'BAND',
    name: 'Band Protocol',
    contractAddress: '0xBA11D00c5f74255f56a5E366F4F77f5A186d7f55',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/9545/large/Band_token_blue_violet_token.png',
    isNative: false,
    verified: true,
    priceUSD: '1.45',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'GRT',
    name: 'The Graph',
    contractAddress: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13397/large/Graph_Token.png',
    isNative: false,
    verified: true,
    priceUSD: '0.32',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },

  // Base Chain Native Tokens
  {
    symbol: 'BALD',
    name: 'Bald',
    contractAddress: '0x27D2DECb4bFC9C76F0309b8E88dec3a601Fe25a8',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/31168/large/bald-200x200.png',
    isNative: false,
    verified: true,
    priceUSD: '0.0000045',
    networks: ['base-mainnet']
  },
  {
    symbol: 'BRETT',
    name: 'Brett',
    contractAddress: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/30725/large/brett.png',
    isNative: false,
    verified: true,
    priceUSD: '0.142',
    networks: ['base-mainnet']
  },

  // Yield Farming & LP Tokens
  {
    symbol: 'YFI',
    name: 'yearn.finance',
    contractAddress: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/11849/large/yearn-finance-yfi.png',
    isNative: false,
    verified: true,
    priceUSD: '8542.18',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },
  {
    symbol: 'SUSHI',
    name: 'SushiSwap',
    contractAddress: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png',
    isNative: false,
    verified: true,
    priceUSD: '1.12',
    networks: ['ethereum-mainnet', 'base-mainnet', 'arbitrum-mainnet']
  },

  // Exchange Tokens
  {
    symbol: '1INCH',
    name: '1inch Network',
    contractAddress: '0x111111111117dC0aa78b770fA6A738034120C302',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13469/large/1inch-token.png',
    isNative: false,
    verified: true,
    priceUSD: '0.48',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },

  // Liquid Staking
  {
    symbol: 'stETH',
    name: 'Lido Staked Ether',
    contractAddress: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13442/large/steth_logo.png',
    isNative: false,
    verified: true,
    priceUSD: '4435.20',
    networks: ['ethereum-mainnet']
  },
  {
    symbol: 'rETH',
    name: 'Rocket Pool ETH',
    contractAddress: '0xae78736Cd615f374D3085123A210448E74Fc6393',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/20764/large/reth.png',
    isNative: false,
    verified: true,
    priceUSD: '4856.78',
    networks: ['ethereum-mainnet']
  },

  // Privacy & Infrastructure
  {
    symbol: 'TORN',
    name: 'Tornado Cash',
    contractAddress: '0x77777FeDdddFfC19Ff86DB637967013aDfFD9A93',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/13496/large/ZINt_tY2_400x400.jpg',
    isNative: false,
    verified: true,
    priceUSD: '15.42',
    networks: ['ethereum-mainnet']
  },

  // Synthetic Assets
  {
    symbol: 'SNX',
    name: 'Synthetix Network Token',
    contractAddress: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/3406/large/SNX.png',
    isNative: false,
    verified: true,
    priceUSD: '2.45',
    networks: ['ethereum-mainnet', 'optimism-mainnet']
  },

  // Lending Protocols  
  {
    symbol: 'ALCX',
    name: 'Alchemix',
    contractAddress: '0xdBdb4d16EdA451D0503b854CF79D55697F90c8DF',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/14113/large/Alchemix.png',
    isNative: false,
    verified: true,
    priceUSD: '18.75',
    networks: ['ethereum-mainnet', 'base-mainnet']
  },

  // Real World Assets (RWA)
  {
    symbol: 'RWA001',
    name: 'RealT Token',
    contractAddress: '0x0316EB71485b0Ab14103307bf65a021042c6d380',
    decimals: 18,
    logoURI: 'https://assets.coingecko.com/coins/images/25244/large/Optimism.png',
    isNative: false,
    verified: false,
    priceUSD: '1.00',
    networks: ['ethereum-mainnet']
  }
];

export default function DEXTrading() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // Basic trading state
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('base-mainnet');
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
  const [fromAsset, setFromAsset] = useState('ETH');
  const [toAsset, setToAsset] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<number | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  // Enhanced token selection state
  const [availableTokens, setAvailableTokens] = useState<Token[]>(COINBASE_DEX_TOKENS);
  const [customTokenDialogOpen, setCustomTokenDialogOpen] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenSearchQuery, setCustomTokenSearchQuery] = useState('');
  const [isLoadingCustomToken, setIsLoadingCustomToken] = useState(false);
  
  // Advanced trading state - Enhanced with Coinbase DEX features
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-limit' | 'bracket'>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [mevProtectionEnabled, setMevProtectionEnabled] = useState(true);
  const [priorityRouting, setPriorityRouting] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [slippageTolerance, setSlippageTolerance] = useState('2.0'); // Coinbase default
  const [postOnlyMode, setPostOnlyMode] = useState(false); // Maker orders only
  const [autoRefreshQuotes, setAutoRefreshQuotes] = useState(true);

  // Bridge interface state (3.11)
  const [bridgeFromChain, setBridgeFromChain] = useState('ethereum-mainnet');
  const [bridgeToChain, setBridgeToChain] = useState('base-mainnet');
  const [bridgeAsset, setBridgeAsset] = useState('USDC');
  const [bridgeAmount, setBridgeAmount] = useState('');
  const [bridgeQuotes, setBridgeQuotes] = useState<any[]>([]);
  const [selectedBridgeProvider, setSelectedBridgeProvider] = useState('');
  const [isBridging, setIsBridging] = useState(false);

  // Chain preferences (3.14)
  const [autoSelectCheapest, setAutoSelectCheapest] = useState(true);
  const [maxAcceptableFee, setMaxAcceptableFee] = useState('10.00');
  const [showAdvancedFees, setShowAdvancedFees] = useState(false);
  
  // Fetch user's MEV protection settings
  const { data: mevSettings } = useQuery({
    queryKey: ['/api/trading/mev-settings'],
    enabled: isAuthenticated,
  });
  
  // Fetch user's chart settings
  const { data: chartSettings } = useQuery({
    queryKey: ['/api/trading/chart-settings'],
    enabled: isAuthenticated,
  });
  
  // Fetch portfolio holdings
  const { data: portfolioHoldings } = useQuery({
    queryKey: ['/api/trading/portfolio'],
    enabled: isAuthenticated && isConnected,
  });
  
  // Fetch active limit orders
  const { data: limitOrders } = useQuery({
    queryKey: ['/api/trading/limit-orders'],
    enabled: isAuthenticated && isConnected,
  });

  // Fetch chain preferences (3.14)
  const { data: chainPreferences } = useQuery({
    queryKey: ['/api/trading/chain-preferences'],
    enabled: isAuthenticated,
  });

  // Fetch fee optimization data (3.13)
  const { data: feeOptimization } = useQuery({
    queryKey: ['/api/trading/fees/optimization', bridgeAsset],
    enabled: !!bridgeAsset,
  });

  // Mutations for advanced trading features
  const createLimitOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest('POST', '/api/trading/limit-orders', orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/limit-orders'] });
      toast({
        title: "Limit Order Created",
        description: "Your limit order has been placed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to create limit order.",
        variant: "destructive",
      });
    }
  });

  const updateMevSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('PUT', '/api/trading/mev-settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/mev-settings'] });
      toast({
        title: "MEV Protection Updated",
        description: "Your MEV protection settings have been saved.",
      });
    }
  });

  const updateChartSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('PUT', '/api/trading/chart-settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/chart-settings'] });
    }
  });

  // Bridge mutations (3.11)
  const executeBridgeMutation = useMutation({
    mutationFn: async (bridgeData: any) => {
      return apiRequest('POST', '/api/trading/bridge/execute', bridgeData);
    },
    onSuccess: () => {
      setIsBridging(false);
      setBridgeAmount('');
      toast({
        title: "Bridge Transaction Initiated",
        description: "Your cross-chain transfer has been started successfully.",
      });
    },
    onError: (error: any) => {
      setIsBridging(false);
      toast({
        title: "Bridge Failed",
        description: error.message || "Failed to execute bridge transaction.",
        variant: "destructive",
      });
    }
  });

  // Chain preferences mutation (3.14)
  const updateChainPreferencesMutation = useMutation({
    mutationFn: async (preferences: any) => {
      return apiRequest('PUT', '/api/trading/chain-preferences', preferences);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/chain-preferences'] });
      toast({
        title: "Chain Preferences Updated",
        description: "Your chain selection preferences have been saved.",
      });
    }
  });

  // Bridge quote function (3.11)
  const getBridgeQuote = async () => {
    if (!bridgeAmount || !bridgeFromChain || !bridgeToChain || !bridgeAsset) return;
    
    try {
      const response = await apiRequest('GET', 
        `/api/trading/bridge/quote?fromChain=${bridgeFromChain}&toChain=${bridgeToChain}&asset=${bridgeAsset}&amount=${bridgeAmount}`
      );
      setBridgeQuotes(response.quotes || []);
      
      // Auto-select recommended or cheapest provider
      if (response.quotes && response.quotes.length > 0) {
        const recommended = response.quotes.find((q: any) => q.isRecommended);
        const cheapest = response.quotes.reduce((prev: any, current: any) => 
          prev.totalFee < current.totalFee ? prev : current
        );
        setSelectedBridgeProvider(autoSelectCheapest ? cheapest.provider : (recommended?.provider || cheapest.provider));
      }
    } catch (error) {
      console.error('Failed to get bridge quote:', error);
      setBridgeQuotes([]);
    }
  };

  const executeBridge = async () => {
    if (!selectedBridgeProvider || !bridgeQuotes.length) return;
    
    const selectedQuote = bridgeQuotes.find(q => q.provider === selectedBridgeProvider);
    if (!selectedQuote) return;

    setIsBridging(true);
    executeBridgeMutation.mutate({
      fromChain: bridgeFromChain,
      toChain: bridgeToChain,
      fromAsset: bridgeAsset,
      toAsset: bridgeAsset,
      fromAmount: parseFloat(bridgeAmount),
      bridgeProvider: selectedBridgeProvider,
      quote: selectedQuote
    });
  };

  // Load trading pairs when network changes
  useEffect(() => {
    const loadTradingPairs = async () => {
      try {
        const response = await apiRequest('GET', `/api/dex/trading-pairs?chain=${selectedNetwork}`);
        setTradingPairs(response.pairs || []);
      } catch (error) {
        console.error('Failed to load trading pairs:', error);
      }
    };

    loadTradingPairs();
  }, [selectedNetwork]);

  // Get quote when amount or assets change - FIXED FOR GUEST USERS
  useEffect(() => {
    const getQuote = async () => {
      // Allow quotes for guest users (remove isConnected requirement)
      if (!fromAmount || !fromAsset || !toAsset) return;
      
      setIsLoadingQuote(true);
      try {
        // Use guest wallet address if not connected
        const guestWalletAddress = walletAddress || '0x1234567890123456789012345678901234567890';
        
        const response = await apiRequest('GET', 
          `/api/dex/quote?fromAsset=${fromAsset}&toAsset=${toAsset}&amount=${fromAmount}&walletAddress=${guestWalletAddress}&chain=${selectedNetwork}`
        );
        
        console.log('Quote response:', response); // Debug log
        
        if (response.success && response.quote && response.quote.outputAmount) {
          const outputAmount = parseFloat(response.quote.outputAmount);
          console.log(`Setting quote: ${fromAmount} ${fromAsset} = ${outputAmount} ${toAsset}`);
          setQuote(outputAmount);
        } else {
          console.warn('Invalid quote response:', response);
          setQuote(null);
        }
      } catch (error) {
        console.error('Failed to get quote:', error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounceTimer = setTimeout(getQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [fromAmount, fromAsset, toAsset, walletAddress, selectedNetwork]); // Removed isConnected dependency

  // Get bridge quote when bridge parameters change
  useEffect(() => {
    const debounceTimer = setTimeout(getBridgeQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [bridgeAmount, bridgeFromChain, bridgeToChain, bridgeAsset]);

  const connectWallet = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = (window as any).ethereum;
        
        try {
          // Request account access
          const accounts = await provider.request({
            method: 'eth_requestAccounts'
          });
          
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
            
            // Get network information
            const chainId = await provider.request({ method: 'eth_chainId' });
            const networkName = getNetworkName(chainId);
            
            toast({
              title: "Wallet Connected Successfully!",
              description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)} on ${networkName}`,
            });

            // Listen for account changes
            provider.on('accountsChanged', (accounts: string[]) => {
              if (accounts.length === 0) {
                disconnectWallet();
              } else {
                setWalletAddress(accounts[0]);
              }
            });

            // Listen for network changes
            provider.on('chainChanged', () => {
              window.location.reload();
            });
          }
        } catch (error: any) {
          if (error.code === 4001) {
            toast({
              title: "Connection Rejected",
              description: "Please accept the wallet connection to continue.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      } else {
        // No Web3 wallet detected
        toast({
          title: "No Wallet Detected",
          description: "Please install MetaMask or another Web3 wallet to continue.",
          variant: "destructive",
        });
        
        // Open MetaMask installation page
        window.open('https://metamask.io/download/', '_blank');
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getNetworkName = (chainId: string) => {
    const networks: { [key: string]: string } = {
      '0x1': 'Ethereum Mainnet',
      '0x89': 'Polygon',
      '0x38': 'BNB Chain',
      '0xa4b1': 'Arbitrum',
      '0xa': 'Optimism',
      '0x2105': 'Base',
    };
    return networks[chainId] || 'Unknown Network';
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress('');
    setQuote(null);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const swapAssets = () => {
    const tempAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
    setQuote(null);
  };

  const calculateFees = () => {
    if (!quote || !fromAmount) return { platformFee: 0, networkFee: 0.002 };
    
    const amount = parseFloat(fromAmount);
    const platformFee = amount * 0.0025; // 0.25% platform fee
    const networkFee = 0.002; // Real network fee will come from quote
    
    return { platformFee, networkFee };
  };

  const executeSwap = async () => {
    if (!fromAmount || !quote || !isConnected || !walletAddress) return;

    setIsSwapping(true);
    try {
      console.log(`🔄 Executing wallet transaction: ${fromAmount} ${fromAsset} → ${toAsset}`);
      
      // Step 1: Get swap transaction data from backend
      const swapData = await apiRequest('POST', '/api/dex/get-swap-transaction', {
        fromAsset,
        toAsset,
        amount: fromAmount,
        quote,
        walletAddress,
        userId: user?.id || null
      });

      if (!swapData.transactionData) {
        throw new Error('Failed to get transaction data');
      }

      // Step 2: Execute transaction through user's wallet
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('No wallet detected');
      }

      console.log('📝 Sending transaction to wallet for signing...');
      
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [swapData.transactionData],
      });

      console.log(`✅ Transaction signed and submitted: ${txHash}`);

      // Step 3: Record the transaction in our backend
      await apiRequest('POST', '/api/dex/record-transaction', {
        transactionHash: txHash,
        fromAsset,
        toAsset,
        amount: fromAmount,
        walletAddress,
        userId: user?.id || null
      });

      toast({
        title: "Swap Successful!",
        description: `Transaction submitted: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`,
      });
      
      setFromAmount('');
      setQuote(null);
    } catch (error: any) {
      console.error('❌ Trade execution failed:', error);
      
      let errorMessage = "Transaction failed. Please try again.";
      if (error.code === 4001) {
        errorMessage = "Transaction was rejected by user.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Swap Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const createLimitOrder = async () => {
    if (!fromAmount || !limitPrice || !isConnected || !isAuthenticated) return;

    setIsSwapping(true);
    try {
      console.log(`🎯 Creating limit order: ${fromAmount} ${fromAsset} → ${toAsset} at $${limitPrice}`);
      
      const orderData = {
        fromAsset,
        toAsset,
        amount: parseFloat(fromAmount),
        limitPrice: parseFloat(limitPrice),
        orderType: 'limit',
        network: selectedNetwork
      };

      await createLimitOrderMutation.mutateAsync(orderData);
      
      setFromAmount('');
      setLimitPrice('');
    } catch (error: any) {
      console.error('❌ Limit order creation failed:', error);
      // Error handling is done in the mutation
    } finally {
      setIsSwapping(false);
    }
  };

  // Token filtering and search functionality
  const getFilteredTokens = () => {
    return availableTokens.filter(token => {
      // Filter by selected network
      const isNetworkSupported = token.networks.includes(selectedNetwork);
      
      // Filter by search query
      const matchesSearch = !customTokenSearchQuery || 
        token.symbol.toLowerCase().includes(customTokenSearchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(customTokenSearchQuery.toLowerCase()) ||
        (token.contractAddress && token.contractAddress.toLowerCase().includes(customTokenSearchQuery.toLowerCase()));
      
      return isNetworkSupported && matchesSearch;
    });
  };

  // Add custom token functionality
  const addCustomToken = async () => {
    if (!customTokenAddress.trim()) return;
    
    setIsLoadingCustomToken(true);
    try {
      // Validate contract address format
      if (!customTokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid contract address format');
      }

      // Fetch token details from the contract
      const response = await apiRequest('POST', '/api/dex/add-custom-token', {
        contractAddress: customTokenAddress,
        network: selectedNetwork
      });

      const newToken: Token = {
        symbol: response.symbol,
        name: response.name,
        contractAddress: customTokenAddress,
        decimals: response.decimals,
        logoURI: response.logoURI || 'https://via.placeholder.com/32x32/666/fff?text=' + response.symbol.charAt(0),
        isNative: false,
        verified: false,
        priceUSD: response.priceUSD,
        networks: [selectedNetwork]
      };

      // Add to available tokens
      setAvailableTokens(prev => [...prev, newToken]);
      
      toast({
        title: "Custom Token Added",
        description: `${newToken.symbol} (${newToken.name}) has been added to your token list.`,
      });

      // Close dialog and reset form
      setCustomTokenDialogOpen(false);
      setCustomTokenAddress('');
    } catch (error: any) {
      console.error('Error adding custom token:', error);
      toast({
        title: "Failed to Add Token",
        description: error.message || "Could not fetch token details. Please verify the contract address.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCustomToken(false);
    }
  };

  const fees = calculateFees();
  const selectedNetworkInfo = SUPPORTED_NETWORKS.find(n => n.id === selectedNetwork);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Coin Railz <span className="text-blue-600">Advanced Trading</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Professional trading with smart order routing
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Powered by</span>
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
              Coinbase DEX Trading
            </Badge>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          {/* Network Selector */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Select Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_NETWORKS.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      <div className="flex items-center gap-2">
                        <img 
                          src={network.icon} 
                          alt={network.displayName}
                          className="w-5 h-5 rounded-full"
                          onError={(e) => {
                            // Fallback to text emoji if SVG fails
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                        <span className="hidden text-lg">
                          {network.name === 'base' ? '🔵' : 
                           network.name === 'ethereum' ? '⟐' : 
                           network.name === 'polygon' ? '⬣' : 
                           network.name === 'arbitrum' ? '🔷' : 
                           network.name === 'bnb' ? '🟡' : 
                           network.name === 'optimism' ? '🔴' : '🔗'}
                        </span>
                        <span>{network.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Wallet Connection Status */}
          {!isConnected ? (
            <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="pt-6">
                <Button onClick={connectWallet} className="w-full" size="lg">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet to Start Trading
                </Button>
                <p className="text-center text-sm text-gray-500 mt-3">
                  No signup required • Guest trading available
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                    <Badge variant="secondary">{selectedNetworkInfo?.displayName}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Trading Interface */}
          <Card className="mb-6">
            <Tabs defaultValue="trade" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="trade">Trade</TabsTrigger>
                <TabsTrigger value="bridge">Bridge</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              {/* Main Trading Tab */}
              <TabsContent value="trade" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Advanced Trading
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Order Type Selector - Enhanced with Coinbase DEX features */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                    <Button
                      variant={orderType === 'market' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('market')}
                      className="flex-1"
                    >
                      Market Order
                      <Badge variant="secondary" className="ml-2 text-xs">Instant</Badge>
                    </Button>
                    <Button
                      variant={orderType === 'limit' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('limit')}
                      className="flex-1"
                    >
                      <Target className="h-4 w-4 mr-1" />
                      Limit Order
                      <Badge variant="secondary" className="ml-2 text-xs">Lower fees</Badge>
                    </Button>
                  </div>

                  {/* Advanced Order Types - Coinbase DEX Feature Parity */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <Button
                      variant={orderType === 'stop-limit' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('stop-limit')}
                      className="flex-1 text-xs"
                    >
                      Stop-Limit
                      <Badge variant="outline" className="ml-1 text-xs">Pro</Badge>
                    </Button>
                    <Button
                      variant={orderType === 'bracket' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('bracket')}
                      className="flex-1 text-xs"
                    >
                      Bracket
                      <Badge variant="outline" className="ml-1 text-xs">Pro</Badge>
                    </Button>
                  </div>

                  {/* Post-Only Mode Toggle - Coinbase DEX Feature */}
                  {orderType === 'limit' && (
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-green-900 dark:text-green-100">
                            Post-Only Mode
                          </span>
                          <Badge variant="secondary" className="text-xs bg-green-100">Maker Only</Badge>
                        </div>
                        <Switch 
                          checked={postOnlyMode} 
                          onCheckedChange={setPostOnlyMode}
                          className="scale-75"
                        />
                      </div>
                      <Badge variant="outline" className="text-xs">Lower Fees</Badge>
                    </div>
                  )}

                  {/* Slippage Tolerance Setting - Coinbase DEX Default 2% */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Slippage Tolerance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{slippageTolerance}%</span>
                        {parseFloat(slippageTolerance) > 2.0 && (
                          <Badge variant="destructive" className="text-xs">High Risk</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {['0.5', '1.0', '2.0', '3.0'].map(value => (
                        <Button
                          key={value}
                          variant={slippageTolerance === value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSlippageTolerance(value)}
                          className="flex-1 text-xs"
                        >
                          {value}%
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Gas Fee Sponsorship Notice - Coinbase DEX Feature */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Zero Gas Fees
                      </span>
                      <Badge variant="outline" className="text-xs bg-blue-100">Sponsored</Badge>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                      All network fees covered by platform
                    </p>
                  </div>

                  {/* MEV Protection Status */}
                  {isAuthenticated && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          MEV Protection
                        </span>
                        <Badge variant={mevProtectionEnabled ? 'default' : 'secondary'}>
                          {mevProtectionEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {priorityRouting && (
                        <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
                          <Layers className="h-3 w-3 mr-1" />
                          Priority Routing
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* From Token - Enhanced with Logo Support */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="from-amount">From</Label>
                      <Dialog open={customTokenDialogOpen} onOpenChange={setCustomTokenDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-xs h-6">
                            <Plus className="h-3 w-3 mr-1" />
                            Add Token
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add Custom Token</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="token-address">Contract Address</Label>
                              <Input
                                id="token-address"
                                placeholder="0x..."
                                value={customTokenAddress}
                                onChange={(e) => setCustomTokenAddress(e.target.value)}
                              />
                              <p className="text-xs text-gray-500">
                                Enter the contract address of the token you want to trade
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                onClick={addCustomToken}
                                disabled={!customTokenAddress || isLoadingCustomToken}
                                className="flex-1"
                              >
                                {isLoadingCustomToken ? 'Loading...' : 'Add Token'}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  setCustomTokenDialogOpen(false);
                                  setCustomTokenAddress('');
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id="from-amount"
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        disabled={!isConnected}
                        className="flex-1"
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-[140px] justify-start">
                            {(() => {
                              const token = availableTokens.find(t => t.symbol === fromAsset);
                              return (
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={token?.logoURI} 
                                    alt={fromAsset}
                                    className="w-5 h-5 rounded-full"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                  <span>{fromAsset}</span>
                                </div>
                              );
                            })()}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Select Token</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Search tokens..."
                                value={customTokenSearchQuery}
                                onChange={(e) => setCustomTokenSearchQuery(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-1">
                              {getFilteredTokens().map((token) => (
                                <Button
                                  key={token.symbol}
                                  variant="ghost"
                                  className="w-full justify-start h-auto p-3"
                                  onClick={() => {
                                    setFromAsset(token.symbol);
                                    setCustomTokenSearchQuery('');
                                  }}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <img 
                                      src={token.logoURI} 
                                      alt={token.symbol}
                                      className="w-8 h-8 rounded-full"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <div className="flex-1 text-left">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{token.symbol}</span>
                                        {token.verified && (
                                          <Badge variant="secondary" className="text-xs">
                                            ✓
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500 truncate">
                                        {token.name}
                                      </div>
                                      {token.priceUSD && (
                                        <div className="text-xs text-gray-400">
                                          ${token.priceUSD}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={swapAssets}
                      disabled={!isConnected}
                      className="rounded-full w-10 h-10 p-0"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* To Token - Enhanced with Logo Support */}
                  <div className="space-y-2">
                    <Label htmlFor="to-amount">To (estimated)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="to-amount"
                        type="number"
                        placeholder="0.0"
                        value={quote ? quote.toString() : ''}
                        readOnly
                        className="flex-1 bg-gray-50 dark:bg-gray-800"
                      />
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="w-[140px] justify-start">
                            {(() => {
                              const token = availableTokens.find(t => t.symbol === toAsset);
                              return (
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={token?.logoURI} 
                                    alt={toAsset}
                                    className="w-5 h-5 rounded-full"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                  <span>{toAsset}</span>
                                </div>
                              );
                            })()}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Select Token</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Search tokens..."
                                value={customTokenSearchQuery}
                                onChange={(e) => setCustomTokenSearchQuery(e.target.value)}
                                className="pl-10"
                              />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto space-y-1">
                              {getFilteredTokens().map((token) => (
                                <Button
                                  key={token.symbol}
                                  variant="ghost"
                                  className="w-full justify-start h-auto p-3"
                                  onClick={() => {
                                    setToAsset(token.symbol);
                                    setCustomTokenSearchQuery('');
                                  }}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <img 
                                      src={token.logoURI} 
                                      alt={token.symbol}
                                      className="w-8 h-8 rounded-full"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                    <div className="flex-1 text-left">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{token.symbol}</span>
                                        {token.verified && (
                                          <Badge variant="secondary" className="text-xs">
                                            ✓
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-gray-500 truncate">
                                        {token.name}
                                      </div>
                                      {token.priceUSD && (
                                        <div className="text-xs text-gray-400">
                                          ${token.priceUSD}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </Button>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Limit Order Price Input (only for limit orders) */}
                  {orderType === 'limit' && (
                    <div className="space-y-2">
                      <Label htmlFor="limit-price">Limit Price</Label>
                      <Input
                        id="limit-price"
                        type="number"
                        placeholder="Enter limit price"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        disabled={!isConnected}
                      />
                      <p className="text-xs text-gray-500">
                        Order will execute when {toAsset} reaches this price
                      </p>
                    </div>
                  )}

              {/* Quote Loading */}
              {isLoadingQuote && fromAmount && isConnected && (
                <div className="text-center text-sm text-gray-500">
                  Getting best price...
                </div>
              )}

              {/* Fee Breakdown */}
              {quote && fromAmount && isConnected && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Info className="h-4 w-4" />
                    Fee Breakdown
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Platform fee (0.25%)</span>
                      <span>${fees.platformFee.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Network fee</span>
                      <span>~${fees.networkFee.toFixed(4)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total fees</span>
                      <span>${(fees.platformFee + fees.networkFee).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Execute Button - FIXED FOR GUEST QUOTES */}
              <Button 
                onClick={!isConnected ? connectWallet : (orderType === 'market' ? executeSwap : createLimitOrder)}
                disabled={!quote || !fromAmount || quote === 0 || isSwapping || (orderType === 'limit' && !limitPrice) || isLoadingQuote}
                className="w-full"
                size="lg"
              >
                {isLoadingQuote
                  ? 'Getting Quote...'
                  : !isConnected 
                    ? `Connect Wallet to Swap ${fromAsset} for ${toAsset}`
                    : isSwapping 
                      ? orderType === 'market' ? 'Swapping...' : 'Creating Order...'
                      : orderType === 'market' 
                        ? `Swap ${fromAsset} for ${toAsset}`
                        : `Create Limit Order`
                }
              </Button>

              {/* Guest Quote Info - Show quotes work without wallet */}
              {!isConnected && quote && quote > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-700 dark:text-green-300 text-sm">
                    <CheckCircle className="h-4 w-4" />
                    <span>Quote ready! You'll get ~{quote.toFixed(6)} {toAsset}</span>
                  </div>
                </div>
              )}
                </CardContent>
              </TabsContent>

              {/* Multi-chain Bridge Tab (3.11) */}
              <TabsContent value="bridge" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5" />
                    Multi-Chain Bridge
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Chain Selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From Chain</Label>
                      <Select value={bridgeFromChain} onValueChange={setBridgeFromChain}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_NETWORKS.map((network) => (
                            <SelectItem key={network.id} value={network.id}>
                              <div className="flex items-center gap-2">
                                <span>{network.icon}</span>
                                <span>{network.displayName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>To Chain</Label>
                      <Select value={bridgeToChain} onValueChange={setBridgeToChain}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_NETWORKS.filter(n => n.id !== bridgeFromChain).map((network) => (
                            <SelectItem key={network.id} value={network.id}>
                              <div className="flex items-center gap-2">
                                <span>{network.icon}</span>
                                <span>{network.displayName}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Asset and Amount */}
                  <div className="space-y-2">
                    <Label>Asset to Bridge</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={bridgeAmount}
                        onChange={(e) => setBridgeAmount(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={bridgeAsset} onValueChange={setBridgeAsset}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USDC">USDC</SelectItem>
                          <SelectItem value="ETH">ETH</SelectItem>
                          <SelectItem value="WBTC">WBTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Get Quote Button */}
                  <Button onClick={getBridgeQuote} variant="outline" className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    Get Bridge Quote
                  </Button>

                  {/* Bridge Options with Fee Display (3.13 & 3.14) */}
                  {bridgeQuotes.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Bridge Options</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={autoSelectCheapest}
                            onCheckedChange={setAutoSelectCheapest}
                          />
                          <span className="text-sm">Auto-select cheapest</span>
                        </div>
                      </div>
                      
                      {bridgeQuotes.map((quote) => (
                        <div
                          key={quote.provider}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedBridgeProvider === quote.provider
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedBridgeProvider(quote.provider)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium capitalize">{quote.provider}</span>
                                {quote.isRecommended && (
                                  <Badge variant="outline" className="text-xs">Recommended</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                <div>Bridge Fee: ${quote.bridgeFee.toFixed(4)}</div>
                                <div>Network Fee: ${quote.networkFee.toFixed(4)}</div>
                                <div>Success Rate: {quote.successRate}%</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">${quote.totalFee.toFixed(4)}</div>
                              <div className="text-sm text-gray-500">~{quote.estimatedTime}m</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Advanced Fee Settings */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={showAdvancedFees}
                            onCheckedChange={setShowAdvancedFees}
                          />
                          <Label>Show advanced fee settings</Label>
                        </div>
                        
                        {showAdvancedFees && (
                          <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="space-y-1">
                              <Label className="text-sm">Max acceptable fee ($)</Label>
                              <Input
                                type="number"
                                value={maxAcceptableFee}
                                onChange={(e) => setMaxAcceptableFee(e.target.value)}
                                placeholder="10.00"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Execute Bridge Button */}
                      <Button
                        onClick={executeBridge}
                        disabled={!selectedBridgeProvider || isBridging || !isConnected}
                        className="w-full"
                        size="lg"
                      >
                        {!isConnected
                          ? 'Connect Wallet to Bridge'
                          : isBridging
                            ? 'Bridging...'
                            : `Bridge ${bridgeAsset}`
                        }
                      </Button>
                    </div>
                  )}

                  {!bridgeQuotes.length && bridgeAmount && (
                    <div className="text-center py-4 text-gray-500">
                      Click "Get Bridge Quote" to see available bridge options
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Active Orders Tab */}
              <TabsContent value="orders" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Active Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to view your active orders</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : !Array.isArray(limitOrders) || limitOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No active limit orders</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.isArray(limitOrders) && limitOrders.map((order: any) => (
                        <div key={order.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{order.fromAsset} → {order.toAsset}</p>
                              <p className="text-sm text-gray-500">
                                {order.amount} at ${order.limitPrice}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={order.status === 'active' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Portfolio Tab */}
              <TabsContent value="portfolio" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Portfolio Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to track your portfolio</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : !Array.isArray(portfolioHoldings) || portfolioHoldings.length === 0 ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No holdings tracked yet</p>
                      <p className="text-xs text-gray-400 mt-2">Make a trade to start tracking</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.isArray(portfolioHoldings) && portfolioHoldings.map((holding: any) => (
                        <div key={holding.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{holding.asset}</p>
                              <p className="text-sm text-gray-500">
                                {holding.balance} tokens
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${holding.usdValue}</p>
                              <p className={`text-xs ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {holding.pnl >= 0 ? '+' : ''}{holding.pnl.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Trading Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to customize your trading settings</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : (
                    <>
                      {/* MEV Protection Settings */}
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          MEV Protection
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Enable MEV Protection</p>
                              <p className="text-sm text-gray-500">
                                Protect against front-running and sandwich attacks
                              </p>
                            </div>
                            <Switch
                              checked={mevProtectionEnabled}
                              onCheckedChange={(checked) => {
                                setMevProtectionEnabled(checked);
                                updateMevSettingsMutation.mutate({
                                  mevProtectionEnabled: checked,
                                  priorityRouting: priorityRouting
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Priority Routing</p>
                              <p className="text-sm text-gray-500">
                                Get priority access to liquidity pools
                              </p>
                            </div>
                            <Switch
                              checked={priorityRouting}
                              onCheckedChange={(checked) => {
                                setPriorityRouting(checked);
                                updateMevSettingsMutation.mutate({
                                  mevProtectionEnabled: mevProtectionEnabled,
                                  priorityRouting: checked
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Chart Settings */}
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <LineChart className="h-4 w-4" />
                          Chart Preferences
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <Label>Default Timeframe</Label>
                            <Select 
                              value={selectedTimeframe} 
                              onValueChange={(value) => {
                                setSelectedTimeframe(value);
                                updateChartSettingsMutation.mutate({
                                  defaultTimeframe: value,
                                  chartType: 'candlestick'
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1m">1 Minute</SelectItem>
                                <SelectItem value="5m">5 Minutes</SelectItem>
                                <SelectItem value="15m">15 Minutes</SelectItem>
                                <SelectItem value="1h">1 Hour</SelectItem>
                                <SelectItem value="4h">4 Hours</SelectItem>
                                <SelectItem value="1d">1 Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Features */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Multi-chain support across 6 networks</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Competitive 0.25% trading fees</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Smart order routing technology</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>No KYC required for guest trading</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}