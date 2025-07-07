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
  
  // Password validation helper
  const validatePassword = (password: string) => {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return {
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar,
      hasMinLength,
      isValid: hasUppercase && hasLowercase && hasNumber && hasSpecialChar && hasMinLength
    };
  };
  
  const passwordValidation = mode === 'signup' ? validatePassword(formData.password) : null;

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
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Password requirements:</p>
                <div className="space-y-1 text-xs">
                  <div className={`flex items-center space-x-2 ${passwordValidation?.hasMinLength ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{passwordValidation?.hasMinLength ? '✓' : '✗'}</span>
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${passwordValidation?.hasUppercase ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{passwordValidation?.hasUppercase ? '✓' : '✗'}</span>
                    <span>One uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${passwordValidation?.hasLowercase ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{passwordValidation?.hasLowercase ? '✓' : '✗'}</span>
                    <span>One lowercase letter (a-z)</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${passwordValidation?.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{passwordValidation?.hasNumber ? '✓' : '✗'}</span>
                    <span>One number (0-9)</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${passwordValidation?.hasSpecialChar ? 'text-green-600' : 'text-red-600'}`}>
                    <span>{passwordValidation?.hasSpecialChar ? '✓' : '✗'}</span>
                    <span>One special character (@$!%*?&)</span>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded p-2">
                  <p className="text-xs text-blue-800 font-medium">Examples that work:</p>
                  <p className="text-xs text-blue-600">MyPass123! • SecureKey2025@ • CoinRailz$123</p>
                </div>
                {passwordValidation?.isValid && (
                  <p className="text-green-600 font-medium text-xs">✓ Password meets all requirements!</p>
                )}
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