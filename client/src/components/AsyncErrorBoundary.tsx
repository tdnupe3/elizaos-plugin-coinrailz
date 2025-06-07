import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Comprehensive async error boundary that catches unhandled promise rejections
 * and React component errors at the root level
 */
export class AsyncErrorBoundary extends Component<Props, State> {
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AsyncErrorBoundary caught an error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidMount() {
    // Set up unhandled promise rejection handler
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection caught by boundary:', event.reason);
      
      // Check if this is a real application error vs browser extension error
      const reason = event.reason;
      const isAppError = reason && 
        typeof reason === 'object' && 
        !String(reason).includes('ChromeTransport') &&
        !String(reason).includes('MetaMask') &&
        !String(reason).includes('vite');

      if (isAppError) {
        this.setState({ 
          hasError: true, 
          error: reason instanceof Error ? reason : new Error(String(reason))
        });
      }
      
      // Prevent the error from bubbling up
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', this.rejectionHandler);
  }

  componentWillUnmount() {
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Application Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-gray-600">
                An unexpected error occurred. This has been logged for investigation.
              </p>
              {this.state.error && (
                <details className="bg-gray-100 p-3 rounded text-sm">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}