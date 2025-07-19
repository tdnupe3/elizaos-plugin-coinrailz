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
export const DemoDashboard = lazy(() => import('@/pages/demo-dashboard').then(module => ({ default: module.default })));
export const DemoTransactionHistory = lazy(() => import('@/pages/demo-transaction-history'));
export const DemoSendMoney = lazy(() => import('@/pages/demo-send-money'));
export const DemoBuySell = lazy(() => import('@/pages/demo-buy-sell'));
export const DemoWalletManagement = lazy(() => import('@/pages/demo-wallet-management'));
export const DemoCryptoTransfer = lazy(() => import('@/pages/demo-crypto-transfer'));

// AI Agent components
export const AIAgents = lazy(() => import('@/pages/ai-agents'));
export const AIAgentMarketplace = lazy(() => import('@/pages/ai-agent-marketplace'));
export const AIAgentRegistration = lazy(() => import('@/pages/ai-agent-registration'));
export const EnhancedAIAgentMarketplace = lazy(() => import('@/pages/enhanced-ai-agent-marketplace'));
export const CryptoSignalsAgent = lazy(() => import('@/pages/crypto-signals-agent'));

// Revenue and Analytics components
export const RevenueDashboard = lazy(() => import('@/pages/revenue-dashboard'));
export const ReferralDashboard = lazy(() => import('@/pages/referral-dashboard'));
export const EnhancedReferralDashboard = lazy(() => import('@/pages/enhanced-referral-dashboard'));
export const HumanReferralDashboard = lazy(() => import('@/pages/human-referral-dashboard'));
export const PlatformAnalytics = lazy(() => import('@/pages/platform-analytics'));

// USDC Ecosystem Components
export const USDCEcosystemDashboard = lazy(() => import('@/pages/usdc-ecosystem-dashboard'));
export const USDCBuy = lazy(() => import('@/pages/usdc-buy'));
export const USDCSavings = lazy(() => import('@/pages/usdc-savings'));
export const USDCCrossBorder = lazy(() => import('@/pages/usdc-cross-border'));
export const USDCPayments = lazy(() => import('@/pages/usdc-payments'));
export const USDCWallets = lazy(() => import('@/pages/usdc-wallets'));
export const USDCDefi = lazy(() => import('@/pages/usdc-defi'));
export const USDCEnterprise = lazy(() => import('@/pages/usdc-enterprise'));
export const USDCConversion = lazy(() => import('@/pages/usdc-conversion'));

// XRP Ecosystem Components
export const XRPEcosystemDashboard = lazy(() => import('@/pages/xrp-ecosystem-dashboard'));
export const XRPCrossBorderPayments = lazy(() => import('@/pages/xrp-cross-border-payments'));
export const XRPInstantSettlements = lazy(() => import('@/pages/xrp-instant-settlements'));
export const XRPEscrowServices = lazy(() => import('@/pages/xrp-escrow-services'));
export const XRPLiquidityProvision = lazy(() => import('@/pages/xrp-liquidity-provision'));
export const XRPWalletManagement = lazy(() => import('@/pages/xrp-wallet-management'));
export const XRPComplianceTools = lazy(() => import('@/pages/xrp-compliance-tools'));

// XRP DEX Ecosystem Components - NEW
export const XRPDEXTrading = lazy(() => import('@/pages/xrp-dex-trading'));
export const XRPTokenExplorer = lazy(() => import('@/pages/xrp-token-explorer'));
export const XRPLiquidityDashboard = lazy(() => import('@/pages/xrp-liquidity-dashboard'));
export const XRPBridgeServices = lazy(() => import('@/pages/xrp-bridge-services'));

export const SystemDashboard = lazy(() => import('@/pages/system-dashboard'));

// Heavy components that are rarely used immediately
export const MfaSetup = lazy(() => import('@/components/MfaSetup'));
export const SignupFlowDemo = lazy(() => import('@/pages/signup-flow-demo'));
export const LegalDisclaimers = lazy(() => import('@/pages/legal-disclaimers'));
export const ContactUs = lazy(() => import('@/pages/contact-us'));
export const TermsOfService = lazy(() => import('@/pages/terms-of-service'));
export const PrivacyPolicy = lazy(() => import('@/pages/privacy-policy'));