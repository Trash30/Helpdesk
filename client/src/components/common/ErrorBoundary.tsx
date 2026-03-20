import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Une erreur inattendue est survenue</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Un probleme est survenu lors de l'affichage de cette page. Veuillez reessayer.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reessayer
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                this.handleReset();
                window.location.href = '/dashboard';
              }}
            >
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
