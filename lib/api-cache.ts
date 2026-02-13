// Shared in-memory cache for API routes
// Survives across requests in the same Node.js process (dev server / warm Vercel instance)

// Camps cache keyed by region slug
const campsCacheMap = new Map<string, { data: any; ts: number }>();
const CAMPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCampsCache(regionSlug: string = 'sf-bay-area') {
  const entry = campsCacheMap.get(regionSlug);
  if (entry && Date.now() - entry.ts < CAMPS_CACHE_TTL) {
    return entry.data;
  }
  if (entry) campsCacheMap.delete(regionSlug);
  return null;
}

export function setCampsCache(data: any, regionSlug: string = 'sf-bay-area') {
  campsCacheMap.set(regionSlug, { data, ts: Date.now() });
}

export function clearCampsCache(regionSlug?: string) {
  if (regionSlug) {
    campsCacheMap.delete(regionSlug);
  } else {
    campsCacheMap.clear();
  }
}
