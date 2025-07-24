import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Phone, MapPin, Calendar, Shield, Settings, Bell, Key, CreditCard } from '@/lib/minimal-icons-clean';
import { NavigationHeader } from '@/components/navigation-header';
import { useAuth } from '@/hooks/useAuth';

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const handleSaveProfile = () => {
    setIsEditing(false);
    // TODO: Implement profile save functionality
  };

  const userInitials = (user as any)?.username ? (user as any).username.slice(0, 2).toUpperCase() : 'CR';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Profile Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src="" alt="Profile" />
                  <AvatarFallback className="text-lg font-medium">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">{(user as any)?.username || 'User'}</h1>
                  <p className="text-gray-600 dark:text-gray-400">{(user as any)?.email || 'user@example.com'}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge variant="secondary" className="flex items-center">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                    <Badge variant="outline">
                      Member since {new Date().getFullYear()}
                    </Badge>
                  </div>
                </div>
                <Button 
                  variant={isEditing ? "default" : "outline"}
                  onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                >
                  {isEditing ? 'Save Changes' : 'Edit Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Profile Tabs */}
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal Info</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="payment">Payment Methods</TabsTrigger>
            </TabsList>

            {/* Personal Information */}
            <TabsContent value="personal">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Manage your personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        placeholder="Enter first name"
                        disabled={!isEditing}
                        defaultValue=""
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        placeholder="Enter last name"
                        disabled={!isEditing}
                        defaultValue=""
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex">
                      <Mail className="h-4 w-4 mt-3 mr-2 text-gray-400" />
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="Enter email address"
                        disabled={!isEditing}
                        defaultValue={(user as any)?.email || ''}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="flex">
                      <Phone className="h-4 w-4 mt-3 mr-2 text-gray-400" />
                      <Input 
                        id="phone" 
                        type="tel"
                        placeholder="Enter phone number"
                        disabled={!isEditing}
                        defaultValue=""
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <div className="flex">
                      <MapPin className="h-4 w-4 mt-3 mr-2 text-gray-400" />
                      <Input 
                        id="address" 
                        placeholder="Enter address"
                        disabled={!isEditing}
                        defaultValue=""
                        className="flex-1"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Settings */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Manage your account security and authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Key className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">Password</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Last changed 30 days ago
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Change Password
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Shield className="h-5 w-5 text-green-500" />
                        <div>
                          <h4 className="font-medium">Two-Factor Authentication</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Add an extra layer of security
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Enable 2FA
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-orange-500" />
                        <div>
                          <h4 className="font-medium">Login Sessions</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Manage active sessions
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        View Sessions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notification Settings */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Bell className="h-5 w-5 mr-2" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Control how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Transaction Alerts</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Get notified about transfers and payments
                        </p>
                      </div>
                      <input type="checkbox" className="toggle" defaultChecked />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Security Alerts</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Login attempts and security events
                        </p>
                      </div>
                      <input type="checkbox" className="toggle" defaultChecked />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Marketing Updates</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          New features and promotional offers
                        </p>
                      </div>
                      <input type="checkbox" className="toggle" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Methods */}
            <TabsContent value="payment">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Payment Methods
                  </CardTitle>
                  <CardDescription>
                    Manage your payment methods and wallet connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <span className="text-blue-600 font-bold text-sm">U</span>
                        </div>
                        <div>
                          <h4 className="font-medium">USDC Wallet</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Circle USDC wallet for instant transfers
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Connected</Badge>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                          <span className="text-orange-600 font-bold text-sm">M</span>
                        </div>
                        <div>
                          <h4 className="font-medium">MetaMask Wallet</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Connect your MetaMask for DeFi features
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                          <span className="text-blue-600 font-bold text-sm">P</span>
                        </div>
                        <div>
                          <h4 className="font-medium">PayPal Account</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Link PayPal for easy funding
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Connect
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Account Actions */}
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                Account Management
              </CardTitle>
              <CardDescription>
                Dangerous actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  Deactivate Account
                </Button>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}