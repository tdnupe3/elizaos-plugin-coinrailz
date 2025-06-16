import { Component } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from '@/lib/icons';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

interface ErrorFallbackProps {
  error?: Error;
  resetError: () => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <CardTitle className="text-red-900">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
          </p>
          {error && (
            <details className="text-left text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <summary className="cursor-pointer font-medium">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap">{error.message}</pre>
            </details>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={resetError} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again
            </Button>
            <Button onClick={() => window.location.href = '/'} size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NetworkErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center p-6 space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-orange-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">Connection problem</h3>
        <p className="text-gray-600 text-sm mt-1">
          Unable to connect to our servers. Please check your internet connection.
        </p>
      </div>
      <Button onClick={onRetry} size="sm">
        <RefreshCw className="w-4 h-4 mr-2" />
        Retry
      </Button>
    </div>
  );
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center p-8 space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <Icon className="w-6 h-6 text-gray-500" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-gray-600 text-sm mt-1">{description}</p>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}