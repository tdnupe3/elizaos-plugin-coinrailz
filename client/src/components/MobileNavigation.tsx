import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { 
  Menu, 
  Home, 
  CreditCard, 
  Send, 
  Wallet, 
  BarChart3, 
  Settings,
  ShoppingBag,
  Users,
  Bot,
  X
} from 'lucide-react';

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  badge?: string;
  category: 'main' | 'marketplace' | 'crypto' | 'admin';
}

const navigationItems: NavigationItem[] = [
  // Main Platform
  { label: 'Dashboard', href: '/dashboard', icon: Home, category: 'main' },
  { label: 'Send Money', href: '/send-money', icon: Send, category: 'main' },
  { label: 'Wallet', href: '/wallet-management', icon: Wallet, category: 'main' },
  { label: 'Portfolio', href: '/portfolio-analytics', icon: BarChart3, category: 'main' },
  
  // AI Marketplace
  { label: 'AI Marketplace', href: '/ai-marketplace', icon: ShoppingBag, category: 'marketplace' },
  { label: 'Agent Dashboard', href: '/agent-dashboard', icon: Bot, category: 'marketplace' },
  { label: 'Marketplace Analytics', href: '/marketplace-dashboard', icon: BarChart3, category: 'marketplace' },
  
  // Crypto Services
  { label: 'Buy/Sell Crypto', href: '/buy-sell', icon: CreditCard, category: 'crypto' },
  { label: 'Crypto Swap', href: '/swap', icon: CreditCard, category: 'crypto' },
  { label: 'XRP Ecosystem', href: '/xrp-ecosystem', icon: Wallet, category: 'crypto' },
  { label: 'USDC Services', href: '/usdc-ecosystem', icon: CreditCard, category: 'crypto' },
  
  // Admin/Settings
  { label: 'Referrals', href: '/referrals', icon: Users, category: 'admin' },
  { label: 'Settings', href: '/settings', icon: Settings, category: 'admin' },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const categorizedItems = navigationItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, NavigationItem[]>);

  const categoryLabels = {
    main: 'Platform',
    marketplace: 'AI Marketplace',
    crypto: 'Crypto Services',
    admin: 'Account'
  };

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 bg-white shadow-lg border"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-80 p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-blue-600">Coin Railz</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-auto py-4">
              {Object.entries(categorizedItems).map(([category, items]) => (
                <div key={category} className="mb-6">
                  <h3 className="px-6 mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </h3>
                  
                  <nav className="space-y-1 px-3">
                    {items.map((item) => {
                      const isActive = location === item.href;
                      const Icon = item.icon;
                      
                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className={`w-full justify-start gap-3 h-12 ${
                              isActive 
                                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                            onClick={() => setIsOpen(false)}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.badge && (
                              <Badge variant="secondary" className="ml-auto">
                                {item.badge}
                              </Badge>
                            )}
                          </Button>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t p-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">CR</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Coin Railz Platform</p>
                  <p className="text-xs text-gray-500">AI-Powered Fintech</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default MobileNavigation;