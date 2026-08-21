import { useRouteError, Link } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export function ErrorBoundaryPage() {
  const error = useRouteError();
  const errorMessage =
    error?.message || error?.statusText || 'An unexpected error occurred while rendering this page.';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card p-8 max-w-lg text-center shadow-lg border border-red-100 dark:border-red-950/40">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 break-words">
          {errorMessage}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Reload Page
          </button>
          <Link to="/dashboard" className="btn-primary btn-sm flex items-center gap-1.5">
            <Home className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundaryPage;
