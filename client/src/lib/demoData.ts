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
    toEmail: "sarah.smith@email.com", 
    date: "2025-01-29T10:15:00Z", 
    message: "Lunch split", 
    status: "completed",
    platform: "PayPal",
    fee: "0.75"
  },
  { 
    id: 3, 
    type: "receive", 
    amount: "250.00", 
    currency: "USD",
    fromEmail: "alex.wilson@email.com",
    toEmail: "demo@coinrailz.com", 
    date: "2025-01-28T16:45:00Z", 
    message: "Freelance work", 
    status: "completed",
    platform: "Internal",
    fee: "0.00"
  }
];

export const DEMO_FUNDING_TRANSACTIONS = [
  {
    id: 1,
    type: "deposit",
    method: "bank_transfer",
    amount: "1000.00",
    currency: "USD",
    status: "completed",
    bankAccount: "****1234",
    platformFee: "0.00",
    createdAt: "2025-01-25T09:00:00Z",
    completedAt: "2025-01-25T09:00:00Z"
  },
  {
    id: 2,
    type: "withdrawal",
    method: "bank_transfer", 
    amount: "500.00",
    currency: "USD",
    status: "completed",
    bankAccount: "****5678",
    platformFee: "2.50",
    createdAt: "2025-01-20T14:30:00Z",
    completedAt: "2025-01-22T10:15:00Z"
  }
];

export const DEMO_CRYPTO_TRANSACTIONS = [
  { 
    id: 1, 
    type: "buy", 
    coinSymbol: "BTC", 
    coinName: "Bitcoin",
    amount: "0.02000000", 
    price: 44500, 
    date: "2025-01-29T12:00:00Z", 
    total: 890.00,
    fee: "8.90",
    status: "completed"
  },
  { 
    id: 2, 
    type: "sell", 
    coinSymbol: "ETH", 
    coinName: "Ethereum",
    amount: "0.50000000", 
    price: 3150, 
    date: "2025-01-28T15:30:00Z", 
    total: 1575.00,
    fee: "23.63",
    status: "completed"
  },
  { 
    id: 3, 
    type: "swap", 
    fromCoin: "USDC", 
    toCoin: "DOT", 
    fromAmount: "1000.00", 
    toAmount: "39.84", 
    date: "2025-01-26T11:20:00Z",
    fee: "5.00",
    status: "completed"
  }
];

export const DEMO_CRYPTO_PRICES = {
  BTC: { price: 45000, change: 5.2, symbol: "₿" },
  ETH: { price: 3200, change: -2.1, symbol: "Ξ" },
  ADA: { price: 0.85, change: 1.8, symbol: "₳" },
  DOT: { price: 25.30, change: 3.4, symbol: "●" },
  SOL: { price: 180.50, change: 4.7, symbol: "◎" },
  XRP: { price: 0.62, change: -1.2, symbol: "✕" },
  USDC: { price: 1.00, change: 0.0, symbol: "$" },
  USDT: { price: 1.00, change: 0.0, symbol: "$" }
};

export const DEMO_CRYPTO_HOLDINGS = [
  { id: 1, coinSymbol: "BTC", coinName: "Bitcoin", amount: "0.05673421", value: 2536.70 },
  { id: 2, coinSymbol: "ETH", coinName: "Ethereum", amount: "1.23456789", value: 3950.62 },
  { id: 3, coinSymbol: "SOL", coinName: "Solana", amount: "15.75000000", value: 2842.88 },
  { id: 4, coinSymbol: "ADA", coinName: "Cardano", amount: "2847.50000000", value: 2420.38 },
  { id: 5, coinSymbol: "DOT", coinName: "Polkadot", amount: "95.30000000", value: 2411.09 },
  { id: 6, coinSymbol: "USDC", coinName: "USD Coin", amount: "500.00000000", value: 500.00 },
  { id: 7, coinSymbol: "USDT", coinName: "Tether", amount: "750.00000000", value: 750.00 }
];

export const SOLANA_SUPPORTED_TOKENS = [
  { symbol: "SOL", name: "Solana", network: "Solana", decimals: 9 },
  { symbol: "USDC", name: "USD Coin", network: "Solana", decimals: 6 },
  { symbol: "USDT", name: "Tether", network: "Solana", decimals: 6 },
  { symbol: "RAY", name: "Raydium", network: "Solana", decimals: 6 },
  { symbol: "SRM", name: "Serum", network: "Solana", decimals: 6 }
];l: "₮" }
};

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