import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, LogOut, Shield } from '@/lib/minimal-icons-clean';
import { useUserSession } from '@/hooks/useUserSession';

// Demo users for testing authentication isolation
const DEMO_USERS = [
  { email: 'a1digitalllc@gmail.com', id: 'user_a1digital', name: 'A1 Digital LLC' },
  { email: 'stell.mary@yahoo.com', id: 'user_mary', name: 'Mary Stell' },
  { email: 'cleophus.harrison@example.com', id: 'user_cleophus', name: 'Cleophus Harrison' },
  { email: 'demo@example.com', id: 'user_demo', name: 'Demo User' }
];

export function UserSessionManager() {
  const { session, login, logout, switchUser, isAuthenticated } = useUserSession();

  const handleUserSwitch = (userEmail: string) => {
    const user = DEMO_USERS.find(u => u.email === userEmail);
    if (user) {
      switchUser(user.email, user.id);
    }
  };

  if (!isAuthenticated || !session) {
    return (
      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <Shield className="w-5 h-5" />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-yellow-700 mb-4">
            Please select a user to test the secure authentication system:
          </p>
          <Select onValueChange={handleUserSwitch}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a user to login as..." />
            </SelectTrigger>
            <SelectContent>
              {DEMO_USERS.map((user) => (
                <SelectItem key={user.id} value={user.email}>
                  {user.name} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-800">
            <User className="w-5 h-5" />
            Logged in as: {session.email}
          </div>
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Authenticated
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-sm text-green-700">
            You can only see your own balance and transaction data.
          </p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={handleUserSwitch} value={session.email}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEMO_USERS.map((user) => (
                <SelectItem key={user.id} value={user.email}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={logout} variant="outline" size="sm">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}