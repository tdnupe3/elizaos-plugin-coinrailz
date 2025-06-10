
import { lazy } from 'react';

// Critical path components that should load immediately
export const criticalComponents = [
  'landing',
  'dashboard',
  'auth-guard'
];

// Dynamic import optimization for Radix UI components
export const loadRadixComponent = (componentName: string) => {
  return lazy(() => import(`@radix-ui/react-${componentName}`));
};

// Optimize icon imports to reduce bundle size
export const optimizedIcons = {
  // Only import icons that are actually used
  Activity: lazy(() => import('lucide-react').then(module => ({ default: module.Activity }))),
  Users: lazy(() => import('lucide-react').then(module => ({ default: module.Users }))),
  DollarSign: lazy(() => import('lucide-react').then(module => ({ default: module.DollarSign }))),
  TrendingUp: lazy(() => import('lucide-react').then(module => ({ default: module.TrendingUp }))),
  Bot: lazy(() => import('lucide-react').then(module => ({ default: module.Bot }))),
  Network: lazy(() => import('lucide-react').then(module => ({ default: module.Network }))),
  Globe: lazy(() => import('lucide-react').then(module => ({ default: module.Globe }))),
  Zap: lazy(() => import('lucide-react').then(module => ({ default: module.Zap }))),
  Send: lazy(() => import('lucide-react').then(module => ({ default: module.Send }))),
  CreditCard: lazy(() => import('lucide-react').then(module => ({ default: module.CreditCard }))),
  Repeat: lazy(() => import('lucide-react').then(module => ({ default: module.Repeat }))),
  Shield: lazy(() => import('lucide-react').then(module => ({ default: module.Shield })))
};

// Code splitting configuration for different route groups
export const routeGroups = {
  public: ['landing', 'legal-disclaimers', 'terms-of-service', 'privacy-policy'],
  auth: ['dashboard', 'send-money', 'transaction-history'],
  aiAgent: ['ai-agent-marketplace', 'ai-agent-registration', 'ai-agents'],
  admin: ['system-dashboard', 'revenue-dashboard'],
  demo: ['demo-dashboard', 'demo-send-money', 'demo-transaction-history']
};
