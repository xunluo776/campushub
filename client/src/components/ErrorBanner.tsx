import type { JSX } from 'react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

// Red alert box used by every component when a request fails.
function ErrorBanner({ message, onRetry }: ErrorBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 font-medium text-red-900 underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export default ErrorBanner;
