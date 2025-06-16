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
import MainMenu from "@/pages/main-menu";

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

} from "@/lib/lazyComponents";

// Import signup flow demo directly
import SignupFlowDemo from "@/pages/signup-flow-demo";
import LegalDisclaimers from "@/pages/legal-disclaimers";
import ContactUs from "@/pages/contact-us";
import WalletManagement from "@/pages/wallet-management";
import SignUp from "@/pages/signup";
import SignIn from "@/pages/signin";
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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <>
      <Switch>
        {/* Demo routes - accessible without authentication */}
      <Route path="/demo">
        {() => <LazyLoadWrapper><DemoDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/dashboard">
        {() => <LazyLoadWrapper><DemoDashboard /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/history">
        {() => <LazyLoadWrapper><DemoTransactionHistory /></LazyLoadWrapper>}
      </Route>
      <Route path="/demo/send">
        {() => <LazyLoadWrapper><DemoSendMoney /></LazyLoadWrapper>}
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