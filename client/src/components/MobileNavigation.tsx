import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { 
  Menu, 
  Home, 
  Send, 
  TrendingUp, 
  ArrowLeftRight, 
  BarChart3, 
  Users, 
  Settings, 
  Shield,
  LogOut,
  X,
  Smartphone
} from "@/lib/minimal-icons";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavigationItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  badge?: string;
}

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Haptic feedback for mobile interactions
  const triggerHaptic = () => {
    if ('vibrate' in navigator && isMobile) {
      navigator.vibrate(10); // Short vibration
    }
  };

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: Home,
      route: '/',
    },
    {
      id: 'send',
      title: 'Send Money',
      icon: Send,
      route: '/send',
    },
    {
      id: 'buy-sell',
      title: 'Buy/Sell',
      icon: TrendingUp,
      route: '/buy',
    },
    {
      id: 'swap',
      title: 'Swap',
      icon: ArrowLeftRight,
      route: '/swap',
    },
    {
      id: 'analytics',
      title: 'Portfolio Analytics',
      icon: BarChart3,
      route: '/portfolio-analytics',
    },
    {
      id: 'referrals',
      title: 'Referrals',
      icon: Users,
      route: '/referrals',
      badge: 'Commission',
    },
  ];

  const handleNavigation = (route: string) => {
    triggerHaptic();
    setLocation(route);
    setIsOpen(false);
  };

  return (
    <div className="lg:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open navigation menu</span>
          </Button>
        </SheetTrigger>
        
        <SheetContent side="left" className="w-80 p-0 touch-pan-y">
          <div className="flex flex-col h-full overscroll-contain">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">CR</span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Coin Railz</h2>
                  <p className="text-xs text-gray-500">
                    {user ? 'Authenticated User' : 'Guest User'}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 overflow-auto py-4">
              <nav className="space-y-2 px-4">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.route)}
                    className="w-full flex items-center space-x-3 px-4 py-4 text-left rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-all duration-150 group touch-manipulation min-h-[48px]"
                  >
                    <item.icon className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                    <span className="flex-1 text-gray-700 group-hover:text-gray-900 font-medium">
                      {item.title}
                    </span>
                    {item.badge && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                ))}
              </nav>

              {/* Divider */}
              <div className="my-4 mx-4 border-t border-gray-200" />

              {/* Settings & Security */}
              <nav className="space-y-2 px-4">
                <button
                  onClick={() => handleNavigation('/security')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <Shield className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                  <span className="flex-1 text-gray-700 group-hover:text-gray-900 font-medium">
                    Security
                  </span>
                </button>

                <button
                  onClick={() => handleNavigation('/settings')}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <Settings className="h-5 w-5 text-gray-600 group-hover:text-blue-600" />
                  <span className="flex-1 text-gray-700 group-hover:text-gray-900 font-medium">
                    Settings
                  </span>
                </button>

                <button
                  onClick={() => window.location.href = "/api/logout"}
                  className="w-full flex items-center space-x-3 px-3 py-3 text-left rounded-lg hover:bg-red-50 transition-colors group border-t border-gray-200 mt-2 pt-4"
                >
                  <LogOut className="h-5 w-5 text-red-600" />
                  <span className="flex-1 text-red-600 font-medium">
                    Sign Out
                  </span>
                </button>
              </nav>
            </div>

            {/* Footer */}
            <div className="border-t p-4">
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => window.location.href = "/api/logout"}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}