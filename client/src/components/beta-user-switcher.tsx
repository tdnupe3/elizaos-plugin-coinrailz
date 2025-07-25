import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function BetaUserSwitcher() {
  const [currentUser, setCurrentUser] = useState(
    window.location.search.includes('user=testuser') ? 'testuser' : 'a1digital'
  );

  const switchUser = (userType: string) => {
    setCurrentUser(userType);
    // Reload page with user parameter to switch authentication
    window.location.href = `/?user=${userType}`;
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 mb-2">
              Beta Testing Mode
            </Badge>
            <p className="text-sm font-medium text-yellow-800">User Isolation Test</p>
            <p className="text-xs text-yellow-600">
              Switch users to verify individual balance isolation
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              size="sm" 
              variant={currentUser === 'a1digital' ? 'default' : 'outline'}
              onClick={() => switchUser('a1digital')}
              className={currentUser === 'a1digital' ? 'bg-green-600 text-white' : ''}
            >
              A1Digital ($50.00)
            </Button>
            <Button 
              size="sm" 
              variant={currentUser === 'testuser' ? 'default' : 'outline'}
              onClick={() => switchUser('testuser')}
              className={currentUser === 'testuser' ? 'bg-green-600 text-white' : ''}
            >
              Test User ($0.00)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}