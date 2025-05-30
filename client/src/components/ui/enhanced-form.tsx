import { useState } from 'react';
import { Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Label } from './label';

interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  helperText?: string;
  showPasswordToggle?: boolean;
}

export function EnhancedInput({
  label,
  error,
  success,
  helperText,
  showPasswordToggle,
  type,
  className,
  ...props
}: EnhancedInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const inputType = showPasswordToggle && type === 'password' 
    ? (showPassword ? 'text' : 'password') 
    : type;

  const hasError = !!error;
  const hasSuccess = success && !hasError;

  return (
    <div className="space-y-2">
      {label && (
        <Label 
          htmlFor={props.id}
          className={cn(
            "text-sm font-medium transition-colors",
            hasError && "text-red-600",
            hasSuccess && "text-green-600",
            isFocused && !hasError && !hasSuccess && "text-blue-600"
          )}
        >
          {label}
        </Label>
      )}
      <div className="relative">
        <Input
          {...props}
          type={inputType}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={cn(
            "transition-all duration-200",
            hasError && "border-red-500 focus:border-red-500 focus:ring-red-500",
            hasSuccess && "border-green-500 focus:border-green-500 focus:ring-green-500",
            isFocused && !hasError && !hasSuccess && "border-blue-500 focus:border-blue-500 focus:ring-blue-500",
            (hasError || hasSuccess) && "pr-10",
            showPasswordToggle && "pr-10",
            className
          )}
        />
        
        {/* Success/Error Icons */}
        {(hasError || hasSuccess) && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {hasError && <AlertCircle className="w-4 h-4 text-red-500" />}
            {hasSuccess && <Check className="w-4 h-4 text-green-500" />}
          </div>
        )}

        {/* Password Toggle */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      
      {/* Helper text and error messages */}
      {(error || helperText) && (
        <div className="text-xs space-y-1">
          {error && (
            <p className="text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </p>
          )}
          {helperText && !error && (
            <p className={cn(
              "text-gray-500",
              hasSuccess && "text-green-600"
            )}>
              {helperText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function FormSection({ 
  title, 
  description, 
  children 
}: { 
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

export function ProgressIndicator({ 
  steps, 
  currentStep 
}: { 
  steps: string[];
  currentStep: number;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
              index < currentStep ? "bg-green-500 text-white" :
              index === currentStep ? "bg-blue-500 text-white" :
              "bg-gray-200 text-gray-600"
            )}>
              {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={cn(
                "w-16 h-0.5 mx-2 transition-colors",
                index < currentStep ? "bg-green-500" : "bg-gray-200"
              )} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-gray-900">{steps[currentStep]}</p>
      </div>
    </div>
  );
}