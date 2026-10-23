import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  stackTrace: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', stackTrace: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown error',
      stackTrace: error.stack || '',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '', stackTrace: '' }, () => {
      if (this.props.onReset) {
        this.props.onReset();
      }
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full overflow-hidden rounded-xl border border-red-800/60 bg-gradient-to-br from-red-950/80 to-slate-950 shadow-2xl p-6 text-center">
          <div className="mb-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-900/50 border border-red-700/40 text-red-400 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-red-300 mb-2">Mission Control failed to render</h3>
          <p className="text-slate-400 mb-1 text-sm">An unexpected error stopped the dashboard from rendering. This is usually a transient load failure — retrying usually resolves it.</p>
          <p className="text-xs text-slate-500 mb-4 font-mono truncate">{this.state.errorMessage}</p>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 text-white px-5 py-2.5 text-sm font-bold shadow-lg shadow-red-900/30 transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            Retry
          </button>
          <div className="mt-4 text-xs text-slate-600">
            <details className="text-left">
              <summary className="cursor-pointer hover:text-slate-500 font-semibold">Show stack trace</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-500 bg-slate-950/60 rounded-md p-3 border border-slate-800">{this.state.stackTrace}</pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
