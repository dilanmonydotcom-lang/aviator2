import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error && parsed.operationType) {
        readable = `Database ${parsed.operationType} error on ${parsed.path ?? 'collection'}: ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('DroidVault ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-xl p-8">
          <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight mb-2">
            Something interrupted this view
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed mb-6 break-words">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-zinc-950 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reload DroidVault
          </button>
        </div>
      </div>
    );
  }
}
