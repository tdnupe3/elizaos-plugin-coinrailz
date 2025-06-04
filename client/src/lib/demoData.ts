// Demo mode data - completely isolated from real APIs
export const DEMO_USER = {
  id: "demo-user-001",
  firstName: "Demo",
  lastName: "User",
  email: "demo@coinrailz.com",
  profileImageUrl: null,
  kycVerified: true,
  referralCode: "DEMO123",
  referralCount: 3,
  totalReferralEarnings: "45.00"
};

export const DEMO_WALLET_BALANCES = [
  {
    id: 1,
    currency: "USD",
    balance: "2847.50",
    available: 2647.50,
    frozen: 200.00
  }
];

export const DEMO_CRYPTO_HOLDINGS = [
  { id: 101, coinSymbol: "BTC", coinName: "Bitcoin", amount: "0.05673421", currentPrice: 45000, value: 2553.04 },
  { id: 102, coinSymbol: "ETH", coinName: "Ethereum", amount: "1.23456789", currentPrice: 3200, value: 3950.62 },
  { id: 103, coinSymbol: "ADA", coinName: "Cardano", amount: "2847.50000000", currentPrice: 0.85, value: 2420.38 },
  { id: 104, coinSymbol: "DOT", coinName: "Polkadot", amount: "45.67890123", currentPrice: 25.30, value: 1155.18 },
  { id: 105, coinSymbol: "USDC", coinName: "USD Coin", amount: "500.00000000", currentPrice: 1.00, value: 500.00 }
];

export const DEMO_TRANSACTIONS = [
  { 
    id: 201, 
    type: "receive", 
    amount: "150.00", 
    currency: "USD",
    fromEmail: "john.doe@email.com", 
    toEmail: "demo@coinrailz.com",
    date: "2025-01-30T14:30:00Z", 
    message: "Coffee payment", 
    status: "completed",
    platform: "Zelle",
    fee: "0.00"
  },
  { 
    id: 202, 
    type: "send", 
    amount: "75.00", 
    currency: "USD",
    fromEmail: "demo@coinrailz.com", 
    toEmail: "jane.smith@email.com",
    date: "2025-01-29T09:15:00Z", 
    message: "Lunch split", 
    status: "completed",
    platform: "Venmo",
    fee: "2.25"
  },
  { 
    id: 203, 
    type: "send", 
    amount: "200.00", 
    currency: "USD",
    fromEmail: "demo@coinrailz.com", 
    toEmail: "mike.wilson@email.com",
    date: "2025-01-28T16:45:00Z", 
    message: "Rent contribution", 
    status: "pending",
    platform: "Cash App",
    fee: "6.00"
  }
];

export const DEMO_CRYPTO_TRANSACTIONS = [
  {
    id: 301,
    type: "buy",
    coinSymbol: "BTC",
    coinName: "Bitcoin",
    amount: "0.01000000",
    price: 45000,
    value: 450.00,
    fee: 4.50,
    status: "completed",
    date: "2025-01-29T11:20:00Z",
    network: "Bitcoin"
  },
  {
    id: 302,
    type: "sell",
    coinSymbol: "ETH",
    coinName: "Ethereum",
    amount: "0.50000000",
    price: 3200,
    value: 1600.00,
    fee: 16.00,
    status: "completed",
    date: "2025-01-28T15:30:00Z",
    network: "Ethereum"
  }
];

export const DEMO_FUNDING_TRANSACTIONS = [
  {
    id: 401,
    type: "bank_transfer",
    amount: "500.00",
    currency: "USD",
    status: "completed",
    date: "2025-01-27T10:00:00Z",
    bankName: "Chase Bank",
    accountLast4: "4567"
  },
  {
    id: 402,
    type: "debit_card",
    amount: "250.00",
    currency: "USD",
    status: "pending",
    date: "2025-01-30T14:20:00Z",
    cardLast4: "8901"
  }
];

export const DEMO_PORTFOLIO_DATA = [
  { date: "2025-01-24", value: 12500 },
  { date: "2025-01-25", value: 12750 },
  { date: "2025-01-26", value: 12600 },
  { date: "2025-01-27", value: 13100 },
  { date: "2025-01-28", value: 13350 },
  { date: "2025-01-29", value: 13200 },
  { date: "2025-01-30", value: 13621 }
];

export const DEMO_CRYPTO_PRICES = {
  BTC: { price: 45000, change: 2.3, symbol: "₿" },
  ETH: { price: 3200, change: -1.5, symbol: "Ξ" },
  SOL: { price: 180.5, change: 4.7, symbol: "◎" },
  ADA: { price: 0.85, change: -0.8, symbol: "₳" },
  DOT: { price: 25.30, change: 1.2, symbol: "●" },
  MATIC: { price: 1.15, change: 3.4, symbol: "⬟" },
  AVAX: { price: 42.80, change: -2.1, symbol: "🔺" },
  LINK: { price: 28.90, change: 0.7, symbol: "🔗" },
  XRP: { price: 0.62, change: -1.2, symbol: "✕" },
  USDC: { price: 1.00, change: 0.0, symbol: "$" },
  USDT: { price: 1.00, change: 0.0, symbol: "$" }
};

export const SOLANA_SUPPORTED_TOKENS = [
  { symbol: "SOL", name: "Solana", network: "Solana", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", network: "Solana", decimals: 6 },
  { symbol: "USDT", name: "Tether", network: "Solana", decimals: 6 },
  { symbol: "RAY", name: "Raydium", network: "Solana", decimals: 6 },
  { symbol: "SRM", name: "Serum", network: "Solana", decimals: 6 }
];

export const DEMO_REFERRALS = [
  {
    id: 1,
    refereeEmail: "friend1@email.com",
    status: "completed", 
    bonus: "15.00",
    joinedAt: "2025-01-15T10:00:00Z"
  },
  {
    id: 2,
    refereeEmail: "friend2@email.com", 
    status: "completed",
    bonus: "15.00", 
    joinedAt: "2025-01-10T14:30:00Z"
  },
  {
    id: 3,
    refereeEmail: "friend3@email.com",
    status: "pending",
    bonus: "15.00",
    joinedAt: "2025-01-28T16:45:00Z"
  }
];

// Mock API responses with delays to simulate real API calls
export const mockApiCall = async <T>(data: T, delay: number = 500): Promise<T> => {
  await new Promise(resolve => setTimeout(resolve, delay));
  return data;
};

// Demo fee calculations (no real API calls)
export const calculateDemoFee = (amount: number, type: string): number => {
  switch (type) {
    case 'send_money':
      return Math.max(amount * 0.01, 0.32);
    case 'crypto_transaction':
      return Math.max(amount * 0.015, 1.40);
    case 'swap':
      return Math.max(amount * 0.005, 0.40);
    default:
      return 0;
  }
};

// Demo success/error simulation
export const simulateTransactionResult = (successRate: number = 0.95): boolean => {
  return Math.random() < successRate;
};