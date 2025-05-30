import { Bell, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface NavigationHeaderProps {
  isDemo?: boolean;
}

export function NavigationHeader({ isDemo = false }: NavigationHeaderProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase() || "U";
  };

  const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/send", label: "Send Money" },
    { path: "/crypto", label: "Crypto Wallet" },
    { path: "/history", label: "History" },
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
              <span className="text-xl font-bold text-neutral-800">Money Railz</span>
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
            <Button variant="ghost" size="sm" className="p-2 rounded-lg hover:bg-neutral-100 relative">
              <Bell className="w-4 h-4 text-neutral-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium hover:bg-purple-700"
            >
              {getInitials(user?.firstName, user?.lastName)}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
