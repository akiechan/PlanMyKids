'use client';

import { useEffect } from 'react';

export default function AddProviderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Add Provider page error:', error);
  }, [error]);

  const handleHardReset = () => {
    // Clear any corrupted cache and reload
    if (typeof window !== 'undefined') {
      // Clear localStorage cache for this page
      try {
        localStorage.removeItem('planmykids-add-program');
      } catch (e) {
        console.error('Failed to clear localStorage:', e);
      }
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-xl shadow-md p-8 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Something went wrong!
        </h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'An error occurred while loading this page.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={handleHardReset}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Cache & Reload
          </button>
        </div>
      </div>
    </div>
  );
}
