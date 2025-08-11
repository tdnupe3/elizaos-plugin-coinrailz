import { Button } from '@/components/ui/button';
import { Chrome } from 'lucide-react';

interface GoogleAuthButtonProps {
  mode?: 'signin' | 'signup';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GoogleAuthButton({ mode = 'signin', size = 'md', className = '' }: GoogleAuthButtonProps) {
  const handleGoogleAuth = () => {
    // Redirect to Google OAuth endpoint
    window.location.href = '/auth/google';
  };

  const buttonText = mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google';
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <Button
      onClick={handleGoogleAuth}
      variant="outline"
      className={`flex items-center gap-2 border-gray-300 hover:bg-gray-50 transition-colors ${sizeClasses[size]} ${className}`}
    >
      <Chrome className="w-4 h-4 text-red-500" />
      {buttonText}
    </Button>
  );
}