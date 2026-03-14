import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-red-700">Une erreur est survenue</h2>
            <p className="text-sm text-red-600 max-w-md">
              {this.state.error?.message || 'Une erreur inattendue s\'est produite dans ce composant.'}
            </p>
          </div>
          <Button 
            variant="outline" 
            className="bg-white border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => (this as any).setState({ hasError: false, error: null })}
          >
            Réessayer
          </Button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
