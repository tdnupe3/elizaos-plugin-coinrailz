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

  USDCEcosystemDashboard,
  USDCBuy,
  USDCSavings,
  USDCCrossBorder,
  USDCPayments,
  USDCWallets,
  USDCDefi,
  USDCEnterprise,
  XRPEcosystemDashboard,
  XRPCrossBorderPayments,
  XRPInstantSettlements,
  XRPEscrowServices,
  XRPLiquidityProvision,
  XRPWalletManagement,
  XRPComplianceTools,

  // XRP DEX Components - NEW
  XRPDEXTrading,
  XRPTokenExplorer,
  XRPLiquidityDashboard,
  XRPBridgeServices

} from "@/lib/lazyComponents";

// XRP services now use lazy loading for consistency

// Import signup flow demo directly
import SignupFlowDemo from "@/pages/signup-flow-demo";
import LegalDisclaimers from "@/pages/legal-disclaimers";
import ContactUs from "@/pages/contact-us";
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
const AIAgentMarketplace = lazy(() => import("@/pages/ai-agent-marketplace"));
const AIMarketplace = lazy(() => import("@/pages/ai-marketplace"));
const AIAgentRegistration = lazy(() => import("@/pages/ai-agent-registration"));
const CryptoSignalsAgent = lazy(() => import("@/pages/crypto-signals-agent"));
const FeeStructure = lazy(() => import("@/pages/FeeStructure"));
const Documentation = lazy(() => import("@/pages/Documentation"));
const CryptoPrices = lazy(() => import("@/pages/crypto-prices"));

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
      <Route path="/ai-agent-marketplace">
        {() => <LazyLoadWrapper><AIAgentMarketplace /></LazyLoadWrapper>}
      </Route>
      <Route path="/ai-marketplace">
        {() => <LazyLoadWrapper><AIMarketplace /></LazyLoadWrapper>}
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
      <Route path="/usdc-defi">
        {() => <LazyLoadWrapper><USDCDefi /></LazyLoadWrapper>}
      </Route>
      <Route path="/usdc-enterprise">
        {() => <LazyLoadWrapper><USDCEnterprise /></LazyLoadWrapper>}
      </Route>

      {/* XRP Ecosystem Hub */}
      <Route path="/xrp-ecosystem">
        {() => <LazyLoadWrapper><XRPEcosystemDashboard /></LazyLoadWrapper>}
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

      {/* XRP DEX Services - NEW */}
      <Route path="/xrp-dex-trading">
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
          const { data: authData } = useAuth();
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
      <Route path="/signup-flow" component={SignupFlowDemo} />
      <Route path="/legal-disclaimers" component={LegalDisclaimers} />
      <Route path="/contact-us" component={ContactUs} />

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

      {/* Authenticated routes */}
      <Route path="/wallet-management" component={WalletManagement} />
      <Route path="/send">
        {() => <LazyLoadWrapper><SendMoney /></LazyLoadWrapper>}
      </Route>
      <Route path="/buy">
        {() => <LazyLoadWrapper><BuySellPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/sell">
        {() => <LazyLoadWrapper><BuySellPage /></LazyLoadWrapper>}
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
      <Route path="/analytics">
        {() => <LazyLoadWrapper><PlatformAnalytics /></LazyLoadWrapper>}
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