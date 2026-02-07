/**
 * ErrorBoundary
 *
 * Catches unhandled React render errors per route and displays a
 * user-friendly fallback UI with a "Try Again" recovery action.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ErrorBoundary fallback={<MyError />}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI. Receives error and resetErrorBoundary. */
  fallback?: ReactNode | ((props: { error: Error; reset: () => void }) => ReactNode);
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            reset: this.resetErrorBoundary,
          });
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Empty>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <EmptyTitle>Something went wrong</EmptyTitle>
              <EmptyDescription className="mb-4">
                {this.state.error.message || 'An unexpected error occurred while rendering this view.'}
              </EmptyDescription>
              <Button
                variant="outline"
                size="sm"
                onClick={this.resetErrorBoundary}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
            </Empty>
            {import.meta.env.DEV && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
