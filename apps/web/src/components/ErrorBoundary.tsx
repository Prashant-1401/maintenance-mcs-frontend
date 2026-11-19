import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="mb-2 text-lg font-semibold text-red-700">Something went wrong</h1>
            <p className="mb-4 text-sm text-gray-600">
              The page crashed. This is usually caused by a corrupted local cache. Clearing it often fixes it.
            </p>
            <pre className="mb-4 max-h-40 overflow-auto rounded bg-red-50 p-3 text-xs text-red-800">
              {this.state.error?.message}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Clear cache & reload
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
