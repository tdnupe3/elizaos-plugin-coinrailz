import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, LogOut, Settings, User } from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";

export function UserAuthMenu() {
  const { user, isAuthenticated, authProvider, kycLevel } = useAuth();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    // Redirect to logout endpoint
    window.location.href = "/api/logout";
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider) {
      case 'coinbase':
        return 'bg-blue-600 text-white';
      case 'replit':
        return 'bg-orange-600 text-white';
      case 'google':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getKycBadgeColor = (level: string) => {
    switch (level) {
      case 'complete':
        return 'bg-green-600 text-white';
      case 'basic':
        return 'bg-yellow-600 text-white';
      case 'pending':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Get display name from user data
  const displayName = user?.email?.split('@')[0] || 
                      user?.username || 
                      user?.firstName || 
                      user?.name || 
                      'User';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="max-w-32 truncate">{displayName}</span>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email || 'No email'}
            </p>
            <div className="flex gap-1 mt-2">
              <Badge 
                className={`text-xs ${getProviderBadgeColor(authProvider)}`}
              >
                {authProvider?.charAt(0).toUpperCase() + authProvider?.slice(1)}
              </Badge>
              <Badge 
                className={`text-xs ${getKycBadgeColor(kycLevel)}`}
              >
                KYC: {kycLevel?.charAt(0).toUpperCase() + kycLevel?.slice(1)}
              </Badge>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowLogoutDialog(true)}
            className="text-red-600 focus:text-red-600"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}