/**
 * Production Authentication Form
 * Handles both sign up and sign in with proper validation
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

interface AuthFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
}

export function AuthForm({ mode, onSuccess }: AuthFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = mode === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'signup' 
        ? formData 
        : { email: formData.email, password: formData.password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store authentication token for login
        if (mode === 'signin' && data.token) {
          localStorage.setItem('auth_token', data.token);
          // Invalidate auth cache to refetch user data
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        }

        toast({
          title: mode === 'signup' ? "Account Created" : "Welcome Back",
          description: data.message,
        });
        
        if (onSuccess) {
          onSuccess();
        } else {
          setLocation('/dashboard');
        }
      } else {
        // Handle specific validation errors
        if (data.message && data.message.includes('Password must contain')) {
          setError('Password does not meet requirements. Please check the password rules below.');
        } else {
          setError(data.message || `${mode === 'signup' ? 'Registration' : 'Login'} failed`);
        }
      }
    } catch (error) {
      setError(`${mode === 'signup' ? 'Registration' : 'Login'} failed. Please try again.`);
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(''); // Clear error when user starts typing
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl text-center">
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
            {mode === 'signup' && (
              <div className="text-sm text-gray-500 space-y-1">
                <p className="font-medium">Password requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>At least 8 characters long</li>
                  <li>Must contain uppercase letter (A-Z)</li>
                  <li>Must contain lowercase letter (a-z)</li>
                  <li>Must contain number (0-9)</li>
                  <li>Must contain special character (@$!%*?&)</li>
                </ul>
                <p className="text-green-600 font-medium text-xs">Example: MyPass123!</p>
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading 
              ? (mode === 'signup' ? 'Creating Account...' : 'Signing In...') 
              : (mode === 'signup' ? 'Create Account' : 'Sign In')
            }
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => setLocation(mode === 'signup' ? '/signin' : '/signup')}
            className="text-sm"
          >
            {mode === 'signup' 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}