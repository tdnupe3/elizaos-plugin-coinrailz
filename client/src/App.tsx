import { useEffect, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import LazyLoadWrapper, { PageLoadingFallback } from "@/components/LazyLoadWrapper";
import { ChatWidget } from "@/components/ChatWidget";
import ContactWidget from "@/components/ContactWidget";

// Global error handler to prevent unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // Suppress ALL unhandled rejections during development
    console.warn('Suppressed unhandled rejection:', event.reason);
    event.preventDefault(); // Prevent the error from appearing in console
  });
}


// Critical path components (loaded immediately)
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth";
import MainMenu from "@/pages/main-menu";
import P2PTransfer from "@/pages/p2p-transfer";

// Lazy-loaded components for performance optimization
import {
  PortfolioAnalytics,
  SettingsPage,
  TransactionHistory,
  CryptoWallet,
  FundsManagement,
  BuySellPage,
  SwapPage,
  SendMoney,
  Referrals,
  CryptoTransferPage,
  DemoDashboard,
  DemoTransactionHistory,
  DemoSendMoney,
  DemoBuySell,
  DemoWalletManagement,
  DemoCryptoTransfer,
  EnhancedReferralDashboard,
  HumanReferralDashboard,
  PlatformAnalytics,
  CDPWalletPage,
  EnhancedCDPWallet,
  OnrampPreparation,

  USDCEcosystemDashboard,
  USDCBuy,
  USDCSavings,
  USDCCrossBorder,
  USDCPayments,
  USDCWallets,
  USDCDefi,
  USDCEnterprise,
  USDCOffRamp,
  USDCConversion,
  XRPEcosystemDashboard,
  XRPCrossBorderPayments,
  XRPInstantSettlements,
  XRPEscrowServices,
  XRPLiquidityProvision,
  XRPWalletManagement,
  XRPComplianceTools,
  XRPWalletTest,
  XRPWalletCreation,
  XRPBuySell,
  XRPRLUSDTrading,
  XRPNativeTokens,

  // XRP DEX Components - NEW
  XRPDEXTrading,
  XRPTokenExplorer,
  XRPLiquidityDashboard,
  XRPBridgeServices

} from "@/lib/lazyComponents";

// XRP services now use lazy loading for consistency

// Import signup flow demo directly
// Removed static imports to prevent dynamic import conflicts
import WalletManagement from "@/pages/wallet-management";
import SignUp from "@/pages/signup";
import SignIn from "@/pages/signin";
import KYCIncentivesDashboard from "@/components/kyc-incentives-dashboard";
import { lazy } from "react";

// Lazy load remaining components
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const RecruitmentTest = lazy(() => import("@/pages/RecruitmentTest"));
const ProductionDashboard = lazy(() => import("@/pages/production-dashboard"));
const ReferralDashboard = lazy(() => import("@/pages/referral-dashboard"));
const RevenueDashboard = lazy(() => import("@/pages/revenue-dashboard"));
const AIAgents = lazy(() => import("@/pages/ai-agents"));

const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const OrderManagement = lazy(() => import("@/pages/order-management"));
const SignupFlowDemo = lazy(() => import("@/pages/signup-flow-demo"));
const LegalDisclaimers = lazy(() => import("@/pages/legal-disclaimers"));
const ContactUs = lazy(() => import("@/pages/contact-us"));

const AgentDashboard = lazy(() => import("@/pages/agent-dashboard"));
const AIAgentRegistration = lazy(() => import("@/pages/ai-agent-registration"));
const AgentOrderManagement = lazy(() => import("@/pages/agent-order-management"));
const CustomerOrderDashboard = lazy(() => import("@/pages/customer-order-dashboard"));
const MarketplaceCheckout = lazy(() => import("@/pages/marketplace-checkout"));
const CryptoSignalsAgent = lazy(() => import("@/pages/crypto-signals-agent"));
const FeeStructure = lazy(() => import("@/pages/FeeStructure"));
const Documentation = lazy(() => import("@/pages/Documentation"));
const CryptoPrices = lazy(() => import("@/pages/crypto-prices"));
const BalanceCheck = lazy(() => import("@/pages/balance-check"));
const BetaBalanceDemo = lazy(() => import("@/pages/beta-balance-demo"));
const BalanceDisplay = lazy(() => import("@/pages/balance-display"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const BankConnectivity = lazy(() => import("@/components/bank-connectivity"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  return (
    <>
      <Switch>
        {/* Authentication routes - always accessible */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/login" component={AuthPage} />
        <Route path="/signup" component={AuthPage} />
        <Route path="/sign-in" component={SignIn} />
        <Route path="/sign-up" component={SignUp} />

        {/* Public routes - accessible without authentication */}
        <Route path="/demo">
          {() => <LazyLoadWrapper><DemoDashboard /></LazyLoadWrapper>}
        </Route>
      <Route path="/demo/dashboard">
        {() => <LazyLoadWrapper><DemoDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo-dashboard">
        {() => <LazyLoadWrapper><DemoDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/history">
        {() => <LazyLoadWrapper><DemoTransactionHistory /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/send">
        {() => <LazyLoadWrapper><DemoSendMoney /></LazyLoadWrapper>}
      </Route>
      <Route path="/p2p-transfer">
        <P2PTransfer />
      </Route>
      <Route path="/balance-check">
        {() => <LazyLoadWrapper><BalanceCheck /></LazyLoadWrapper>}
      </Route>
      <Route path="/beta-balance">
        {() => <LazyLoadWrapper><BetaBalanceDemo /></LazyLoadWrapper>}
      </Route>
      <Route path="/balance-display">
        {() => <LazyLoadWrapper><BalanceDisplay /></LazyLoadWrapper>}
      </Route>
      <Route path="/bank-connectivity">
        {() => <LazyLoadWrapper><BankConnectivity /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/buy-sell">
        {() => <LazyLoadWrapper><DemoBuySell /></LazyLoadWrapper>}
      </Route>
      <Route path="/portfolio-analytics">
        {() => <LazyLoadWrapper><PortfolioAnalytics /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo-crypto-transfer">
        {() => <LazyLoadWrapper><DemoCryptoTransfer /></LazyLoadWrapper>}
      </Route>
      <Route path="/swap">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex-aggregator">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/ai-agents">
        {() => <LazyLoadWrapper><AIAgents /></LazyLoadWrapper>}
      </Route>

      <Route path="/ai-marketplace">
        {() => <LazyLoadWrapper><AIAgents /></LazyLoadWrapper>}
      </Route>
      
      <Route path="/marketplace/checkout/:serviceId">
        {() => <LazyLoadWrapper><MarketplaceCheckout /></LazyLoadWrapper>}
      </Route>
      
      <Route path="/marketplace/payment-success">
        {() => <LazyLoadWrapper><PaymentSuccess /></LazyLoadWrapper>}
      </Route>
      
      <Route path="/order-management">
        {() => <LazyLoadWrapper><OrderManagement /></LazyLoadWrapper>}
      </Route>
      
      <Route path="/marketplace-dashboard">
        {() => {
          const MarketplaceDashboard = lazy(() => import("@/pages/marketplace-dashboard"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <MarketplaceDashboard />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/free-agent-registration">
        {() => {
          const FreeAgentRegistration = lazy(() => import("@/pages/free-agent-registration"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <FreeAgentRegistration />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/ai-agent-registration">
        {() => <LazyLoadWrapper><AIAgentRegistration /></LazyLoadWrapper>}
      </Route>
      <Route path="/revenue-dashboard">
        {() => <LazyLoadWrapper><RevenueDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/referral-dashboard">
        {() => <LazyLoadWrapper><ReferralDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/enhanced-referral-dashboard">
        {() => <LazyLoadWrapper><EnhancedReferralDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/crypto-signals-agent">
        {() => <LazyLoadWrapper><CryptoSignalsAgent /></LazyLoadWrapper>}
      </Route>
      <Route path="/recruitment-test">
        {() => <LazyLoadWrapper><RecruitmentTest /></LazyLoadWrapper>}
      </Route>
      <Route path="/transfer">
        {() => <LazyLoadWrapper><CryptoTransferPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/crypto-prices">
        {() => <LazyLoadWrapper><CryptoPrices /></LazyLoadWrapper>}
      </Route>
      <Route path="/prices">
        {() => <LazyLoadWrapper><CryptoPrices /></LazyLoadWrapper>}
      </Route>
      {/* USDC Ecosystem Hub */}
      <Route path="/usdc-ecosystem">
        {() => <LazyLoadWrapper><USDCEcosystemDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-ecosystem-dashboard">
        {() => <LazyLoadWrapper><USDCEcosystemDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-buy">
        {() => <LazyLoadWrapper><USDCBuy /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-savings">
        {() => <LazyLoadWrapper><USDCSavings /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-cross-border">
        {() => <LazyLoadWrapper><USDCCrossBorder /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-payments">
        {() => <LazyLoadWrapper><USDCPayments /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-wallets">
        {() => <LazyLoadWrapper><USDCWallets /></LazyLoadWrapper>}
      </Route>
      <Route path="/cdp-wallet">
        {() => <LazyLoadWrapper><CDPWalletPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/enhanced-cdp-wallet">
        {() => <LazyLoadWrapper><EnhancedCDPWallet /></LazyLoadWrapper>}
      </Route>
      <Route path="/onramp-preparation">
        {() => <LazyLoadWrapper><OnrampPreparation /></LazyLoadWrapper>}
      </Route>
      <Route path="/coinbase-cdp">
        {() => <LazyLoadWrapper><CDPWalletPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-defi">
        {() => <LazyLoadWrapper><USDCDefi /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-enterprise">
        {() => <LazyLoadWrapper><USDCEnterprise /></LazyLoadWrapper>}
      </Route>
      <Route path="/send-money">
        {() => <LazyLoadWrapper><SendMoney /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-conversion">
        {() => <LazyLoadWrapper><USDCConversion /></LazyLoadWrapper>}
      </Route>

      {/* XRP Ecosystem Hub */}
      <Route path="/xrp-ecosystem">
        {() => <LazyLoadWrapper><XRPEcosystemDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-wallet-test">
        {() => <LazyLoadWrapper><XRPWalletTest /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-wallet-creation">
        {() => <LazyLoadWrapper><XRPWalletCreation /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-buy-sell">
        {() => <LazyLoadWrapper><XRPBuySell /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-rlusd-trading">
        {() => <LazyLoadWrapper><XRPRLUSDTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-native-tokens">
        {() => <LazyLoadWrapper><XRPNativeTokens /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-cross-border-payments">
        {() => <LazyLoadWrapper><XRPCrossBorderPayments /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-instant-settlements">
        {() => <LazyLoadWrapper><XRPInstantSettlements /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-escrow-services">
        {() => <LazyLoadWrapper><XRPEscrowServices /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-liquidity-provision">
        {() => <LazyLoadWrapper><XRPLiquidityProvision /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-wallet-management">
        {() => <LazyLoadWrapper><XRPWalletManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-compliance-tools">
        {() => <LazyLoadWrapper><XRPComplianceTools /></LazyLoadWrapper>}
      </Route>

      {/* XRP DEX Services - Simplified Interface */}
      <Route path="/xrp-dex-trading">
        {() => {
          const XRPDEXSimple = lazy(() => import("./pages/xrp-dex-simple"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <XRPDEXSimple />
            </Suspense>
          );
        }}
      </Route>
      {/* Advanced DEX Trading */}
      <Route path="/xrp-dex-advanced">
        {() => <LazyLoadWrapper><XRPDEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-token-explorer">
        {() => <LazyLoadWrapper><XRPTokenExplorer /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-liquidity-dashboard">
        {() => <LazyLoadWrapper><XRPLiquidityDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/xrp-bridge-services">
        {() => <LazyLoadWrapper><XRPBridgeServices /></LazyLoadWrapper>}
      </Route>
      
      {/* KYC Incentives Dashboard */}
      <Route path="/kyc-incentives">
        {() => {
          const { user: authData } = useAuth();
          if (!authData) {
            return <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <p className="text-lg mb-4">Please sign in to access KYC incentives</p>
                <a href="/signin" className="text-blue-600 hover:underline">Sign In</a>
              </div>
            </div>;
          }
          return <KYCIncentivesDashboard />;
        }}
      </Route>

      <Route path="/signup" component={SignUp} />
      <Route path="/signin" component={SignIn} />
      <Route path="/signup-flow">
        {() => <LazyLoadWrapper><SignupFlowDemo /></LazyLoadWrapper>}
      </Route>
      <Route path="/legal-disclaimers">
        {() => <LazyLoadWrapper><LegalDisclaimers /></LazyLoadWrapper>}
      </Route>
      <Route path="/contact-us">
        {() => <LazyLoadWrapper><ContactUs /></LazyLoadWrapper>}
      </Route>

      {/* Legal pages - accessible to all users */}
      <Route path="/terms-of-service">
        {() => <LazyLoadWrapper><TermsOfServicePage /></LazyLoadWrapper>}
      </Route>
      <Route path="/privacy-policy">
        {() => <LazyLoadWrapper><PrivacyPolicyPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/docs">
        {() => <LazyLoadWrapper><Documentation /></LazyLoadWrapper>}
      </Route>
      <Route path="/documentation">
        {() => <LazyLoadWrapper><Documentation /></LazyLoadWrapper>}
      </Route>

      {/* Production dashboard for monitoring */}
      <Route path="/production">
        {() => <LazyLoadWrapper><ProductionDashboard /></LazyLoadWrapper>}
      </Route>

      {/* AI Marketplace Management Routes */}
      <Route path="/agent-orders">
        {() => <LazyLoadWrapper><AgentOrderManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/agent-dashboard">
        {() => <LazyLoadWrapper><AgentOrderManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/my-orders">
        {() => <LazyLoadWrapper><CustomerOrderDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/customer-orders">
        {() => <LazyLoadWrapper><CustomerOrderDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/marketplace-checkout">
        {() => <LazyLoadWrapper><MarketplaceCheckout /></LazyLoadWrapper>}
      </Route>
      <Route path="/checkout">
        {() => <LazyLoadWrapper><MarketplaceCheckout /></LazyLoadWrapper>}
      </Route>

      {/* Authenticated routes */}
      <Route path="/wallet-management" component={WalletManagement} />
      <Route path="/profile">
        {() => <LazyLoadWrapper><ProfilePage /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-off-ramp">
        {() => <LazyLoadWrapper><USDCOffRamp /></LazyLoadWrapper>}
      </Route>
      <Route path="/send">
        {() => <LazyLoadWrapper><SendMoney /></LazyLoadWrapper>}
      </Route>
      <Route path="/buy">
        {() => <LazyLoadWrapper><BuySellPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/sell">
        {() => <LazyLoadWrapper><BuySellPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/swap">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex-aggregator">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>

      {/* Main route - conditional based on auth */}
      <Route path="/">
        {() => isLoading || !isAuthenticated ? <Landing /> : <MainMenu />}
      </Route>
      
      {/* Dashboard route - redirect to main menu for now */}
      <Route path="/dashboard">
        {() => isAuthenticated ? <MainMenu /> : <Dashboard />}
      </Route>
      
      {/* Authenticated routes */}
      <Route path="/crypto">
        {() => <LazyLoadWrapper><CryptoWallet /></LazyLoadWrapper>}
      </Route>
      <Route path="/history">
        {() => <LazyLoadWrapper><TransactionHistory /></LazyLoadWrapper>}
      </Route>
      <Route path="/funds">
        {() => <LazyLoadWrapper><FundsManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/add-funds">
        {() => <LazyLoadWrapper><FundsManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/referrals">
        {() => <LazyLoadWrapper><Referrals /></LazyLoadWrapper>}
      </Route>
      <Route path="/human-referrals">
        {() => <LazyLoadWrapper><HumanReferralDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/human-referral-dashboard">
        {() => <LazyLoadWrapper><HumanReferralDashboard /></LazyLoadWrapper>}
      </Route>

      <Route path="/settings">
        {() => <LazyLoadWrapper><SettingsPage /></LazyLoadWrapper>}
      </Route>
      <Route component={NotFound} />
      </Switch>

      {/* AI Agent Chat Widget - Available on all pages */}
      <ChatWidget isDemo={window.location.pathname.includes('/demo')} />
      
      {/* Contact Support Widget - Available on all pages */}
      <ContactWidget />
    </>
  );
}

function App() {
  // App component initialization
  useEffect(() => {
    console.log('Coin Railz platform initialized');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Suspense fallback={<PageLoadingFallback />}>
            <Router />
          </Suspense>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;