'use client';

import { useCompare } from '@/contexts/CompareContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function CompareBar() {
  const { programs, count, removeProgram, clearAll, isFull, maxPrograms, userTier } = useCompare();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Handle hydration mismatch - localStorage is only available on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render on family planning dashboard, compare page, or admin pages
  const hiddenPaths = ['/familyplanning', '/compare', '/admin'];
  const shouldHide = hiddenPaths.some(path => pathname?.startsWith(path));

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted || count === 0 || shouldHide) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded view - program previews */}
      {isExpanded && (
        <div className="bg-white border-t border-gray-200 shadow-lg px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {programs.map(({ program }) => (
                <div
                  key={program.id}
                  className="flex-shrink-0 flex items-center gap-2 bg-gray-50 rounded-lg p-2 pr-3"
                >
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">
                      {program.category?.[0]?.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                      {program.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]">
                      {program.category?.[0] || 'Program'}
                    </p>
                  </div>
                  <button
                    onClick={() => removeProgram(program.id)}
                    className="ml-2 text-gray-400 hover:text-red-500 transition-colors text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main bar */}
      <div className="bg-primary-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 hover:bg-primary-700 rounded-lg px-3 py-1 transition-colors"
          >
            <span className="bg-white text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
              {count}
            </span>
            <span className="font-medium">
              {count === 1 ? 'Program' : 'Programs'} selected
            </span>
            <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▲
            </span>
          </button>

          <div className="flex items-center gap-3">
            {isFull && userTier === 'free' && (
              <Link
                href="/familyplanning/billing"
                className="text-xs text-primary-100 hover:text-white transition-colors hidden sm:block"
              >
                Max {maxPrograms} reached. Upgrade for more →
              </Link>
            )}
            <button
              onClick={clearAll}
              className="text-primary-100 hover:text-white text-sm transition-colors"
            >
              Clear all
            </button>
            {count >= 2 ? (
              <Link
                href="/compare"
                className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors"
              >
                Compare ({count})
              </Link>
            ) : (
              <span className="bg-white/50 text-primary-200 px-4 py-2 rounded-lg font-medium cursor-not-allowed">
                Compare (min 2)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
