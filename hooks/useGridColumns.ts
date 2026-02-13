'use client';

import { useState, useEffect, useCallback } from 'react';

type SectionKey = 'programs' | 'camps' | 'considering' | 'enrolled';

const DEFAULTS: Record<SectionKey, number> = {
  programs: 3,
  camps: 3,
  considering: 3,
  enrolled: 1,
};

const LS_PREFIX = 'planmykids-grid-cols-';

function getMaxColumns(): number {
  if (typeof window === 'undefined') return 5;
  if (window.innerWidth >= 1024) return 5;
  if (window.innerWidth >= 768) return 3;
  return 2;
}

export function useGridColumns(section: SectionKey) {
  const [columns, setColumns] = useState(DEFAULTS[section]);
  const [maxCols, setMaxCols] = useState(5);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const max = getMaxColumns();
    setMaxCols(max);

    const stored = localStorage.getItem(LS_PREFIX + section);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        setColumns(Math.min(parsed, max));
      }
    } else {
      // Clamp default to current screen max
      setColumns(Math.min(DEFAULTS[section], max));
    }

    const handleResize = () => {
      const newMax = getMaxColumns();
      setMaxCols(newMax);
      setColumns(prev => Math.min(prev, newMax));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [section]);

  const increment = useCallback(() => {
    setColumns(prev => {
      const next = Math.min(prev + 1, maxCols);
      localStorage.setItem(LS_PREFIX + section, String(next));
      return next;
    });
  }, [section, maxCols]);

  const decrement = useCallback(() => {
    setColumns(prev => {
      const next = Math.max(prev - 1, 1);
      localStorage.setItem(LS_PREFIX + section, String(next));
      return next;
    });
  }, [section]);

  return {
    columns: mounted ? columns : DEFAULTS[section],
    increment,
    decrement,
    canIncrement: columns < maxCols,
    canDecrement: columns > 1,
    gridStyle: { gridTemplateColumns: `repeat(${mounted ? columns : DEFAULTS[section]}, minmax(0, 1fr))` } as React.CSSProperties,
  };
}
