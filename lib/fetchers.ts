import { supabase } from '@/lib/supabase';

// SWR fetcher for active programs list (with locations JOIN)
// When regionId is provided, post-filters to programs with at least one location in that region
export const programsFetcher = async (key: string, regionId?: string) => {
  const { data, error } = await supabase
    .from('programs')
    .select('*, program_locations(*)')
    .eq('status', 'active')
    .eq('program_type', 'program')
    .is('merged_into', null)
    .order('google_rating', { ascending: false });
  if (error) throw error;

  let programs = data || [];
  if (regionId) {
    programs = programs.filter((p: any) =>
      p.program_locations?.some((loc: any) => loc.region_id === regionId)
    );
  }
  return programs;
};

// SWR fetcher for camps via API route (benefits from server-side cache)
export const campsFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const result = await res.json();
  return result.camps || [];
};

// Generic API route fetcher
export const apiFetcher = (url: string) =>
  fetch(url).then(r => {
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    return r.json();
  });

// Validate that program IDs still exist in the database
export const validateProgramIdsFetcher = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('programs')
    .select('id')
    .in('id', ids)
    .eq('status', 'active');
  return data?.map(p => p.id) || [];
};
