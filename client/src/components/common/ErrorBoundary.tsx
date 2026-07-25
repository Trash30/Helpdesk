import React, { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation('common');
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <AlertTriangle className="h-12 w-12 text-orange-500 mb-4" />
      <h2 className="text-lg font-semibold mb-2">{t('errorBoundary.title')}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {t('errorBoundary.description')}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('errorBoundary.retry')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onReset();
            window.location.href = '/dashboard';
          }}
        >
          {t('errorBoundary.backToDashboard')}
        </Button>
      </div>
    </div>
  );
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

      return <DefaultErrorFallback onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
