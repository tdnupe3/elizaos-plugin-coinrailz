import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import SendMoney from "@/pages/send-money";
import CryptoWallet from "@/pages/crypto-wallet";
import TransactionHistory from "@/pages/transaction-history";
import FundsManagement from "@/pages/funds-management";
import DemoDashboard from "@/pages/demo-dashboard";
import MainMenu from "@/pages/main-menu";
import SwapPage from "@/pages/swap";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Guest-accessible routes */}
      <Route path="/swap" component={SwapPage} />
      <Route path="/demo" component={DemoDashboard} />
      
      {/* Regular routes */}
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={MainMenu} />
          <Route path="/send" component={SendMoney} />
          <Route path="/buy" component={CryptoWallet} />
          <Route path="/sell" component={CryptoWallet} />
          <Route path="/crypto" component={CryptoWallet} />
          <Route path="/history" component={TransactionHistory} />
          <Route path="/funds" component={FundsManagement} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
