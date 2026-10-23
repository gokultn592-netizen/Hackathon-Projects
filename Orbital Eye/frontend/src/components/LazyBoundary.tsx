import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Human-readable name of the panel, e.g. "Service Health Checker". */
  label: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Scoped error boundary for lazily loaded panels.
 *
 * Without this, a single failed dynamic import (transient network blip, dev
 * server restart) propagated to the root boundary and took down the whole
 * mission-control dashboard — the 3D globe, the sidebar and every control
 * disappeared, and the root boundary reported "Encounter display failed",
 * which misidentified the cause.
 *
 * With this boundary in place, a failed chunk degrades only the panel that
 * needs it, and the rest of the application keeps running.
 */
export default class LazyBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error?.message || 'Unknown error',
    };
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-700/50 bg-amber-950/40 p-6 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-600/50 bg-amber-900/40 text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-amber-300">{this.props.label} unavailable</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              This panel could not be loaded. The rest of Mission Control is still operational.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
