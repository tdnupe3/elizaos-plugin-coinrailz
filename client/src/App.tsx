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
import { ProgressiveWebApp } from "@/components/progressive-web-app";
import { usePerformanceTracking } from "@/lib/performance-monitor";
import { initGA, trackWebVitals } from "@/lib/analytics";
import { useAnalytics } from "@/hooks/use-analytics";

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
import X402DocsPage from "@/pages/X402DocsPage";
import BundlesPage from "@/pages/BundlesPage";
import BundleCheckoutPage from "@/pages/BundleCheckoutPage";
import SubscriptionManagementPage from "@/pages/SubscriptionManagementPage";
import TelegramApp from "@/pages/telegram/TelegramApp";

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
  EnhancedReferralDashboard,
  HumanReferralDashboard,
  PlatformAnalytics,
  CDPWalletPage,
  PlatformIntegrationPage,
  AIMarketplace,

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
import AuthOptions from "@/pages/auth-options";
import KYCIncentivesDashboard from "@/components/kyc-incentives-dashboard";
import { lazy } from "react";

// Import report landing page directly for critical path
import ReportLandingPage from "@/pages/ReportLandingPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { CheckoutSuccessPage } from "@/pages/CheckoutSuccessPage";
// Token launcher disabled - research showed 98.6% failure rate, not profitable
// import TokenLauncher from "@/pages/token-launcher";

// Lazy load remaining components
const TermsOfServicePage = lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy-policy"));
const RecruitmentTest = lazy(() => import("@/pages/RecruitmentTest"));
const ProductionDashboard = lazy(() => import("@/pages/production-dashboard"));
const ReferralDashboard = lazy(() => import("@/pages/referral-dashboard"));
const RevenueDashboard = lazy(() => import("@/pages/revenue-dashboard"));
const AIAgents = lazy(() => import("@/pages/ai-agents"));

const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const GptPurchaseSuccess = lazy(() => import("@/pages/gpt-purchase-success"));
const PaySessionPage = lazy(() => import("@/pages/pay-session"));
const OrderManagement = lazy(() => import("@/pages/order-management"));
const OnrampPage = lazy(() => import("@/pages/onramp"));
const BuyOnramp = lazy(() => import("@/pages/BuyOnramp"));
const EnterprisePage = lazy(() => import("@/pages/enterprise"));
const LegalDisclaimers = lazy(() => import("@/pages/legal-disclaimers"));
const ContactUs = lazy(() => import("@/pages/contact-us"));
const WalletAccess = lazy(() => import("@/pages/WalletAccess"));

const AgentDashboard = lazy(() => import("@/pages/agent-dashboard"));
const AIAgentRegistration = lazy(() => import("@/pages/ai-agent-registration"));
const AgentOrderManagement = lazy(() => import("@/pages/agent-order-management"));
const CustomerOrderDashboard = lazy(() => import("@/pages/customer-order-dashboard"));
const SmartContractAudit = lazy(() => import("@/pages/SmartContractAudit"));
const AuditStatus = lazy(() => import("@/pages/AuditStatus"));
const MarketplaceCheckout = lazy(() => import("@/pages/marketplace-checkout"));
const BotPortal = lazy(() => import("@/pages/BotPortal"));
const ConsolePage = lazy(() => import("@/pages/console"));
const CryptoSignalsAgent = lazy(() => import("@/pages/crypto-signals-agent"));
const FeeStructure = lazy(() => import("@/pages/FeeStructure"));
const Documentation = lazy(() => import("@/pages/Documentation"));
const CryptoPrices = lazy(() => import("@/pages/crypto-prices"));
const BalanceCheck = lazy(() => import("@/pages/balance-check"));
const DEXTrading = lazy(() => import("@/pages/dex-trading"));
const AIAgentStore = lazy(() => import("@/pages/AIAgentStore"));
const BalanceDisplay = lazy(() => import("@/pages/balance-display"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const BankConnectivity = lazy(() => import("@/components/bank-connectivity"));
const CoinbaseWallet = lazy(() => import("@/pages/coinbase-wallet"));

// Enhancement Components - NEW
const ReferralDashboardNew = lazy(() => import("@/pages/referral-dashboard"));
const EnterprisePortal = lazy(() => import("@/pages/enterprise-portal"));
const AdminAnalytics = lazy(() => import("@/pages/admin-analytics"));
const AdminObservability = lazy(() => import("@/pages/admin-observability"));
const SocialLoginPage = lazy(() => import("@/components/social-login"));
const SecurityDashboard = lazy(() => import("@/components/enhanced-security"));
const SubscriptionPage = lazy(() => import("@/pages/subscription"));
const SubscriptionDashboard = lazy(() => import("@/pages/subscription-dashboard"));
const CustomerDashboard = lazy(() => import("@/pages/CustomerDashboard"));
const EnterpriseOutreach = lazy(() => import("@/pages/EnterpriseOutreach"));
const OutreachPage = lazy(() => import("@/pages/OutreachPage"));
const AutoJoinerPage = lazy(() => import("@/pages/AutoJoinerPage"));
const CryptoJoinerPro = lazy(() => import("@/pages/CryptoJoinerPro"));
const SubscriptionSuccess = lazy(() => import("@/pages/SubscriptionSuccess"));
const FreelanceDeveloperServices = lazy(() => import("@/pages/FreelanceDeveloperServices"));
const IoTPaymentsPage = lazy(() => import("@/pages/IoTPaymentsPage"));
const FleetTelematicsPage = lazy(() => import("@/pages/FleetTelematicsPage"));
const WeatherDataPage = lazy(() => import("@/pages/WeatherDataPage"));
const SatelliteDataPage = lazy(() => import("@/pages/SatelliteDataPage"));
const PredictionMarketsPage = lazy(() => import("@/pages/PredictionMarketsPage"));
const FleetDemoPage = lazy(() => import("@/pages/FleetDemoPage"));
const WeatherDemoPage = lazy(() => import("@/pages/WeatherDemoPage"));
const IoTDashboardPage = lazy(() => import("@/pages/IoTDashboardPage"));
const IoTHubPage = lazy(() => import("@/pages/IoTHubPage"));
const IoTAnalyticsPage = lazy(() => import("@/pages/IoTAnalyticsPage"));
const PilotOnboardingPage = lazy(() => import("@/pages/PilotOnboardingPage"));
const PilotCreditsPage = lazy(() => import("@/pages/PilotCreditsPage"));
const PilotCreditsSuccessPage = lazy(() => import("@/pages/PilotCreditsSuccessPage"));
const EmergencyConsulting = lazy(() => import("@/pages/EmergencyConsulting"));
const Whitepaper = lazy(() => import("@/pages/Whitepaper"));
const DevelopersPage = lazy(() => import("@/pages/DevelopersPage"));
const CreditsPage = lazy(() => import("@/pages/CreditsPage"));
const APIKeysPage = lazy(() => import("@/pages/APIKeysPage"));
const SolanaPayPage = lazy(() => import("@/pages/solana-pay"));
const ProofOfExecution = lazy(() => import("@/pages/proof-of-execution"));
const ServiceDetailPage = lazy(() => import("@/pages/ServiceDetailPage"));
const McpIntegrationPage = lazy(() => import("@/pages/McpIntegrationPage"));
const BuyerAnalysis = lazy(() => import("@/pages/BuyerAnalysis"));

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Track page views for Google Analytics
  useAnalytics();

  if (isLoading) {
    return <PageLoadingFallback />;
  }

  return (
    <>
      <Switch>
        {/* Authentication routes - always accessible */}
        <Route path="/auth" component={AuthOptions} />
        <Route path="/login" component={AuthOptions} />
        <Route path="/sign-in" component={AuthOptions} />
        <Route path="/signin" component={SignIn} />
        <Route path="/signup" component={SignUp} />
        <Route path="/sign-up" component={SignUp} />

        {/* Public routes - accessible without authentication */}
      <Route path="/p2p-transfer">
        <P2PTransfer />
      </Route>
      <Route path="/balance-check">
        {() => <LazyLoadWrapper><BalanceCheck /></LazyLoadWrapper>}
      </Route>

      {/* DEX Trading - Available to all users (guest and authenticated) */}
      <Route path="/dex-trading">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/trading">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/swap">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/balance-display">
        {() => <LazyLoadWrapper><BalanceDisplay /></LazyLoadWrapper>}
      </Route>
      <Route path="/bank-connectivity">
        {() => <LazyLoadWrapper><BankConnectivity /></LazyLoadWrapper>}
      </Route>
      <Route path="/portfolio-analytics">
        {() => <LazyLoadWrapper><PortfolioAnalytics /></LazyLoadWrapper>}
      </Route>
      {/* Redirect old swap routes to new DEX trading page (4.2) */}
      <Route path="/swap">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex-aggregator">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/ai-agents">
        {() => <LazyLoadWrapper><AIAgents /></LazyLoadWrapper>}
      </Route>
      <Route path="/ai-agent-store">
        {() => <LazyLoadWrapper><AIAgentStore /></LazyLoadWrapper>}
      </Route>

      <Route path="/ai-marketplace">
        {() => <LazyLoadWrapper><AIMarketplace /></LazyLoadWrapper>}
      </Route>

      {/* Service detail pages - SEO indexable marketing pages for each x402 service */}
      <Route path="/services/:slug">
        {() => <LazyLoadWrapper><ServiceDetailPage /></LazyLoadWrapper>}
      </Route>

      {/* Streamlined onramp flow */}
      <Route path="/onramp">
        {() => <LazyLoadWrapper><OnrampPage /></LazyLoadWrapper>}
      </Route>
      
      {/* x402 Service Documentation */}
      <Route path="/x402">
        {() => <X402DocsPage />}
      </Route>
      
      {/* Service Bundles Marketplace */}
      <Route path="/bundles">
        {() => <BundlesPage />}
      </Route>
      
      {/* Bundle Checkout */}
      <Route path="/checkout/:bundleId/:tier">
        {() => <BundleCheckoutPage />}
      </Route>
      
      {/* Subscription Management */}
      <Route path="/subscriptions">
        {() => <SubscriptionManagementPage />}
      </Route>
      
      {/* Developer API Documentation - x402 Protocol */}
      <Route path="/developers">
        {() => <LazyLoadWrapper><DevelopersPage /></LazyLoadWrapper>}
      </Route>

      {/* SDK Quickstart Guide - Developer Onboarding */}
      <Route path="/quickstart">
        {() => {
          const QuickstartPage = lazy(() => import("@/pages/QuickstartPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <QuickstartPage />
            </Suspense>
          );
        }}
      </Route>

      {/* Solana Actions Showcase - Dialect Blinks Registry */}
      <Route path="/solana-showcase">
        {() => {
          const SolanaShowcasePage = lazy(() => import("@/pages/SolanaShowcasePage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SolanaShowcasePage />
            </Suspense>
          );
        }}
      </Route>

      {/* Prepaid Credits System - Conversion Optimization */}
      <Route path="/credits">
        {() => <LazyLoadWrapper><CreditsPage /></LazyLoadWrapper>}
      </Route>

      {/* GPT Purchase Success - In-Chat Credit Purchase Flow */}
      <Route path="/gpt-purchase-success">
        {() => <LazyLoadWrapper><GptPurchaseSuccess /></LazyLoadWrapper>}
      </Route>

      {/* Stripe Elements embedded payment page */}
      <Route path="/pay/:sessionId">
        {(params) => <LazyLoadWrapper><PaySessionPage /></LazyLoadWrapper>}
      </Route>

      {/* Product Pages - Revenue Generation */}
      <Route path="/products/ai-agent-bundle">
        {() => {
          const AIAgentBundlePage = lazy(() => import("@/pages/AIAgentBundlePage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <AIAgentBundlePage />
            </Suspense>
          );
        }}
      </Route>

      <Route path="/api-keys">
        {() => <LazyLoadWrapper><APIKeysPage /></LazyLoadWrapper>}
      </Route>
      
      {/* Backward compatibility redirect for old SDK documentation links */}
      <Route path="/dashboard/api-keys">
        {() => {
          window.location.replace('/api-keys');
          return null;
        }}
      </Route>
      
      
      {/* Enterprise section - separate from consumer platform */}
      <Route path="/enterprise">
        {() => <LazyLoadWrapper><EnterprisePage /></LazyLoadWrapper>}
      </Route>
      
      {/* IoT Payments - Fleet Telematics & Weather Data Monetization */}
      <Route path="/iot">
        {() => <LazyLoadWrapper><IoTHubPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/iot/dashboard">
        {() => <LazyLoadWrapper><IoTDashboardPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/iot/analytics">
        {() => <LazyLoadWrapper><IoTAnalyticsPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/pilot/onboard">
        {() => <LazyLoadWrapper><PilotOnboardingPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/pilots/buy">
        {() => <LazyLoadWrapper><PilotCreditsPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/pilots/success">
        {() => <LazyLoadWrapper><PilotCreditsSuccessPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/fleet">
        {() => <LazyLoadWrapper><FleetTelematicsPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/fleet/demo">
        {() => <LazyLoadWrapper><FleetDemoPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/weather">
        {() => <LazyLoadWrapper><WeatherDataPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/weather/demo">
        {() => <LazyLoadWrapper><WeatherDemoPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/satellite">
        {() => <LazyLoadWrapper><SatelliteDataPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/predictions">
        {() => <LazyLoadWrapper><PredictionMarketsPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/credits/proof">
        {() => {
          const CreditsProofPage = lazy(() => import("@/pages/CreditsProofPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <CreditsProofPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/partner">
        {() => {
          const X402PartnerPage = lazy(() => import("@/pages/X402PartnerPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <X402PartnerPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/partners">
        {() => {
          const PartnerProgramPage = lazy(() => import("@/pages/PartnerProgramPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <PartnerProgramPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/integrate">
        {() => {
          const IntegrationGuidePage = lazy(() => import("@/pages/IntegrationGuidePage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <IntegrationGuidePage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/admin/pilots">
        {() => {
          const PilotTrackingPage = lazy(() => import("@/pages/PilotTrackingPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <PilotTrackingPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/circle-evidence">
        {() => {
          const CircleEvidencePage = lazy(() => import("@/pages/CircleEvidencePage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <CircleEvidencePage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/case-studies">
        {() => {
          const CaseStudiesPage = lazy(() => import("@/pages/CaseStudiesPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <CaseStudiesPage />
            </Suspense>
          );
        }}
      </Route>
      
      {/* SDK Enterprise Pages - $2K-$200K Market */}
      <Route path="/sdk-landing">
        {() => {
          const SDKLandingPage = lazy(() => import("@/pages/SDKLandingPage"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SDKLandingPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/sdk-enterprise-signup">
        {() => {
          const SDKEnterpriseSignup = lazy(() => import("@/pages/SDKEnterpriseSignup"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SDKEnterpriseSignup />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/sdk-subscription-success">
        {() => {
          const SDKSubscriptionSuccess = lazy(() => import("@/pages/SDKSubscriptionSuccess"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SDKSubscriptionSuccess />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/sdk-documentation">
        {() => {
          const SDKDocumentation = lazy(() => import("@/pages/SDKDocumentation"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SDKDocumentation />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/enterprise-outreach">
        {() => {
          const EnterpriseOutreach = lazy(() => import("@/pages/EnterpriseOutreach"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <EnterpriseOutreach />
            </Suspense>
          );
        }}
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
      <Route path="/platform-integration">
        {() => <LazyLoadWrapper><PlatformIntegrationPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/cdp-wallet">
        {() => {
          const CDPWalletPage = lazy(() => import("./pages/cdp-wallet"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <CDPWalletPage />
            </Suspense>
          );
        }}
      </Route>
      <Route path="/coinbase-cdp">
        {() => {
          const CDPWalletPage = lazy(() => import("./pages/cdp-wallet"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <CDPWalletPage />
            </Suspense>
          );
        }}
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
      <Route path="/solana-pay">
        {() => <LazyLoadWrapper><SolanaPayPage /></LazyLoadWrapper>}
      </Route>
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
      <Route path="/checkout/:paymentIntentId" component={CheckoutPage} />
      <Route path="/checkout/success" component={CheckoutSuccessPage} />
      <Route path="/legal-disclaimers">
        {() => <LazyLoadWrapper><LegalDisclaimers /></LazyLoadWrapper>}
      </Route>
      <Route path="/contact-us">
        {() => <LazyLoadWrapper><ContactUs /></LazyLoadWrapper>}
      </Route>
      <Route path="/wallet-access">
        {() => <LazyLoadWrapper><WalletAccess /></LazyLoadWrapper>}
      </Route>

      {/* Report Landing Page - Public Access */}
      <Route path="/report" component={ReportLandingPage} />

      {/* Legal pages - accessible to all users */}
      <Route path="/terms-of-service">
        {() => <LazyLoadWrapper><TermsOfServicePage /></LazyLoadWrapper>}
      </Route>
      <Route path="/privacy-policy">
        {() => <LazyLoadWrapper><PrivacyPolicyPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/whitepaper">
        {() => <LazyLoadWrapper><Whitepaper /></LazyLoadWrapper>}
      </Route>
      <Route path="/docs">
        {() => <LazyLoadWrapper><Documentation /></LazyLoadWrapper>}
      </Route>
      <Route path="/documentation">
        {() => <LazyLoadWrapper><Documentation /></LazyLoadWrapper>}
      </Route>
      <Route path="/proof-of-execution">
        {() => <LazyLoadWrapper><ProofOfExecution /></LazyLoadWrapper>}
      </Route>
      <Route path="/telemetry">
        {() => <LazyLoadWrapper><ProofOfExecution /></LazyLoadWrapper>}
      </Route>

      {/* Bot API Portal */}
      <Route path="/bots">
        {() => <LazyLoadWrapper><BotPortal /></LazyLoadWrapper>}
      </Route>

      {/* API Console - for testing API endpoints */}
      <Route path="/console">
        {() => <LazyLoadWrapper><ConsolePage /></LazyLoadWrapper>}
      </Route>

      {/* Production dashboard for monitoring */}
      <Route path="/production">
        {() => <LazyLoadWrapper><ProductionDashboard /></LazyLoadWrapper>}
      </Route>

      {/* Token Launcher disabled - research showed 98.6% failure rate, not profitable
      <Route path="/token-launcher">
        {() => <TokenLauncher />}
      </Route>
      */}

      {/* AI Marketplace Management Routes */}
      <Route path="/agent-orders">
        {() => <LazyLoadWrapper><AgentOrderManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/agent-order-management">
        {() => <LazyLoadWrapper><AgentOrderManagement /></LazyLoadWrapper>}
      </Route>
      <Route path="/agent-dashboard">
        {() => <LazyLoadWrapper><AgentDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/credits">
        {() => <LazyLoadWrapper><CreditsPage /></LazyLoadWrapper>}
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
        {() => <LazyLoadWrapper><BuyOnramp /></LazyLoadWrapper>}
      </Route>
      <Route path="/buy-crypto">
        {() => <LazyLoadWrapper><BuyOnramp /></LazyLoadWrapper>}
      </Route>
      <Route path="/sell">
        {() => <LazyLoadWrapper><BuySellPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/swap">
        {() => <LazyLoadWrapper><SwapPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/advanced-trading">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>
      <Route path="/dex-trading">
        {() => <LazyLoadWrapper><DEXTrading /></LazyLoadWrapper>}
      </Route>

      {/* Main route - conditional based on auth */}
      <Route path="/">
        {() => isLoading || !isAuthenticated ? <Landing /> : <MainMenu />}
      </Route>

      {/* Telegram Mini-App route - MUST be unauthenticated */}
      <Route path="/telegram">
        <TelegramApp />
      </Route>
      
      {/* Dashboard route - redirect to main menu for now */}
      <Route path="/dashboard">
        {() => isAuthenticated ? <MainMenu /> : <Dashboard />}
      </Route>
      
      {/* Authenticated routes */}
      <Route path="/crypto">
        {() => <LazyLoadWrapper><CryptoWallet /></LazyLoadWrapper>}
      </Route>
      <Route path="/wallet">
        {() => {
          const WalletPage = lazy(() => import("@/pages/wallet"));
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <WalletPage />
            </Suspense>
          );
        }}
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

      {/* NEW ENHANCEMENT ROUTES */}
      <Route path="/referral-dashboard">
        {() => <LazyLoadWrapper><ReferralDashboardNew /></LazyLoadWrapper>}
      </Route>
      <Route path="/enterprise-portal">
        {() => <LazyLoadWrapper><EnterprisePortal /></LazyLoadWrapper>}
      </Route>
      <Route path="/admin-analytics">
        {() => <LazyLoadWrapper><AdminAnalytics /></LazyLoadWrapper>}
      </Route>
      <Route path="/admin/observability">
        {() => <LazyLoadWrapper><AdminObservability /></LazyLoadWrapper>}
      </Route>
      <Route path="/social-login">
        {() => <LazyLoadWrapper><SocialLoginPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/security">
        {() => <LazyLoadWrapper><SecurityDashboard /></LazyLoadWrapper>}
      </Route>

      {/* Subscription Management */}
      <Route path="/subscription">
        {() => <LazyLoadWrapper><SubscriptionPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/subscription-dashboard">
        {() => <LazyLoadWrapper><SubscriptionDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/my-subscription">
        {() => <LazyLoadWrapper><SubscriptionDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/plans">
        {() => <LazyLoadWrapper><SubscriptionPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/pricing">
        {() => <LazyLoadWrapper><SubscriptionPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/customer-dashboard">
        {() => <LazyLoadWrapper><CustomerDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/sdk-dashboard">
        {() => <LazyLoadWrapper><CustomerDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/enterprise-outreach">
        {() => <LazyLoadWrapper><EnterpriseOutreach /></LazyLoadWrapper>}
      </Route>
      <Route path="/outreach">
        {() => <LazyLoadWrapper><OutreachPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/telegram-outreach">
        {() => <LazyLoadWrapper><OutreachPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/auto-joiner">
        {() => <LazyLoadWrapper><AutoJoinerPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/telegram-auto-joiner">
        {() => <LazyLoadWrapper><AutoJoinerPage /></LazyLoadWrapper>}
      </Route>
      <Route path="/crypto-joiner-pro">
        {() => <LazyLoadWrapper><CryptoJoinerPro /></LazyLoadWrapper>}
      </Route>
      <Route path="/subscription-success">
        {() => <LazyLoadWrapper><SubscriptionSuccess /></LazyLoadWrapper>}
      </Route>
      <Route path="/freelance-developer">
        {() => <LazyLoadWrapper><FreelanceDeveloperServices /></LazyLoadWrapper>}
      </Route>
      <Route path="/emergency-consulting">
        {() => <LazyLoadWrapper><EmergencyConsulting /></LazyLoadWrapper>}
      </Route>

      {/* Smart Contract Audit Service */}
      <Route path="/audit">
        {() => <LazyLoadWrapper><SmartContractAudit /></LazyLoadWrapper>}
      </Route>
      <Route path="/smart-contract-audit">
        {() => <LazyLoadWrapper><SmartContractAudit /></LazyLoadWrapper>}
      </Route>
      <Route path="/audit-status">
        {() => <LazyLoadWrapper><AuditStatus /></LazyLoadWrapper>}
      </Route>

      <Route path="/mcp-integration-guide">
        {() => <LazyLoadWrapper><McpIntegrationPage /></LazyLoadWrapper>}
      </Route>

      <Route path="/buyer-analysis">
        {() => <LazyLoadWrapper><BuyerAnalysis /></LazyLoadWrapper>}
      </Route>

      <Route component={NotFound} />
      </Switch>

      {/* AI Agent Chat Widget - Available on all pages */}
      <ChatWidget />
      
      {/* Contact Support Widget - Available on all pages */}
      <ContactWidget />
    </>
  );
}

function App() {
  // Initialize performance tracking
  usePerformanceTracking();
  
  // App component initialization
  useEffect(() => {
    console.log('Coin Railz platform initialized');
    
    // Initialize Google Analytics
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing required Google Analytics key: VITE_GA_MEASUREMENT_ID');
    } else {
      initGA();
      trackWebVitals();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <ProgressiveWebApp />
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