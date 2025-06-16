import { Home, Send, Coins, History } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function MobileNavigation() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Dashboard" },
    { path: "/send", icon: Send, label: "Send" },
    { path: "/crypto", icon: Coins, label: "Crypto" },
    { path: "/history", icon: History, label: "History" },
  ];

  return (
    <div className="md:hidden bg-white border-t border-neutral-200 fixed bottom-0 left-0 right-0 z-50">
      <div className="flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          
          return (
            <Button
              key={item.path}
              variant="ghost"
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center py-2 px-3 ${
                isActive ? "text-blue-600" : "text-neutral-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs mt-1">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
