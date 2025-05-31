import { lazy } from 'react';

// Lazy load heavy components to reduce initial bundle size
export const PortfolioAnalytics = lazy(() => import('@/pages/portfolio-analytics'));
export const SettingsPage = lazy(() => import('@/pages/settings'));
export const TransactionHistory = lazy(() => import('@/pages/transaction-history'));
export const CryptoWallet = lazy(() => import('@/pages/crypto-wallet'));
export const FundsManagement = lazy(() => import('@/pages/funds-management'));
export const BuySellPage = lazy(() => import('@/pages/buy-sell'));
export const SwapPage = lazy(() => import('@/pages/swap'));
export const SendMoney = lazy(() => import('@/pages/send-money'));
export const Referrals = lazy(() => import('@/pages/referrals'));
export const CryptoTransferPage = lazy(() => import('@/pages/crypto-transfer'));

// Demo components (can be lazy loaded since they're not critical path)
export const DemoDashboard = lazy(() => import('@/pages/demo-dashboard'));
export const DemoTransactionHistory = lazy(() => import('@/pages/demo-transaction-history'));
export const DemoSendMoney = lazy(() => import('@/pages/demo-send-money'));
export const DemoBuySell = lazy(() => import('@/pages/demo-buy-sell'));
export const DemoWalletManagement = lazy(() => import('@/pages/demo-wallet-management'));
export const DemoCryptoTransfer = lazy(() => import('@/pages/demo-crypto-transfer'));

// Heavy components that are rarely used immediately
export const MfaSetup = lazy(() => import('@/components/MfaSetup'));