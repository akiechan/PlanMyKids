'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Region } from '@/types/database';

const STORAGE_KEY = 'planmykids-region';

// Default SF region used before DB fetch completes
const SF_REGION: Region = {
  id: '',
  slug: 'sf-bay-area',
  name: 'San Francisco Bay Area',
  short_name: 'SF Bay Area',
  center_lat: 37.7749,
  center_lng: -122.4194,
  default_zoom: 12,
  is_active: true,
  created_at: '',
};

interface RegionContextValue {
  region: Region;
  setRegion: (region: Region) => void;
  regions: Region[];
  isLoading: boolean;
}

const RegionContext = createContext<RegionContextValue>({
  region: SF_REGION,
  setRegion: () => {},
  regions: [SF_REGION],
  isLoading: true,
});

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegionState] = useState<Region>(() => {
    if (typeof window === 'undefined') return SF_REGION;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return SF_REGION;
  });
  const [regions, setRegions] = useState<Region[]>([SF_REGION]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch active regions from API
  useEffect(() => {
    fetch('/api/regions')
      .then(res => res.json())
      .then(data => {
        if (data.regions && data.regions.length > 0) {
          setRegions(data.regions);
          // If current region has no ID (using fallback), update it from DB
          if (!region.id) {
            const dbRegion = data.regions.find((r: Region) => r.slug === region.slug);
            if (dbRegion) {
              setRegionState(dbRegion);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(dbRegion));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRegion = (newRegion: Region) => {
    setRegionState(newRegion);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newRegion));
  };

  return (
    <RegionContext.Provider value={{ region, setRegion, regions, isLoading }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
