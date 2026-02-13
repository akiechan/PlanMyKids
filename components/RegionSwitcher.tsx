'use client';

import { useRegion } from '@/contexts/RegionContext';

export default function RegionSwitcher() {
  const { region, setRegion, regions } = useRegion();

  // Don't show if only one region
  if (regions.length <= 1) return null;

  return (
    <select
      value={region.slug}
      onChange={(e) => {
        const selected = regions.find(r => r.slug === e.target.value);
        if (selected) setRegion(selected);
      }}
      className="text-sm text-gray-700 bg-transparent border border-gray-300 rounded-md px-2 py-1 hover:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
      aria-label="Select region"
    >
      {regions.map(r => (
        <option key={r.slug} value={r.slug}>
          {r.short_name}
        </option>
      ))}
    </select>
  );
}
