import { Bell, Zap, ChevronDown, Settings, User, LogOut } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { LanguageSwitcher } from "./language-switcher";

interface NavigationHeaderProps {
  isDemo?: boolean;
}

export function NavigationHeader({ isDemo = false }: NavigationHeaderProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "U";
  };

  const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/send", label: "Send Money" },
    { path: "/crypto", label: "Crypto Wallet" },
    { path: "/history", label: "History" },
    { path: "/ai-agents", label: "AI Agents" },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="flex items-center space-x-2 p-0"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-neutral-800">Coin Railz</span>
            </Button>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                onClick={() => setLocation(item.path)}
                className={`text-neutral-500 hover:text-blue-600 transition-colors ${
                  location === item.path ? "text-blue-600" : ""
                }`}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" className="p-2 rounded-lg hover:bg-neutral-100 relative">
              <Bell className="w-4 h-4 text-neutral-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </Button>
            
            {/* User Profile with Dropdown */}
            <div className="relative group">
              <Button
                variant="ghost"
                className="flex items-center space-x-2 hover:bg-neutral-100 px-3 py-2 rounded-lg"
              >
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {getInitials(user?.firstName, user?.lastName)}
                </div>
                <span className="text-sm text-neutral-700 hidden md:block">
                  {user?.firstName || "User"}
                </span>
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              </Button>
              
              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => setLocation('/settings')}
                    className="w-full justify-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-none"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setLocation('/profile')}
                    className="w-full justify-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-none"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <Button
                      variant="ghost"
                      onClick={handleLogout}
                      className="w-full justify-start px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-none"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}