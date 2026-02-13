'use client';

import { useCompare } from '@/contexts/CompareContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import DateInput from '@/components/DateInput';
import { supabase } from '@/lib/supabase';

// Session cache for map data
const MAP_CACHE_KEY = 'planmykids-map-cache';

interface Kid {
  id: string;
  name: string;
  age: number;
  avatar: string;
}

interface CachedMapData {
  programIds: string[];
  locations: Array<{
    lat: number;
    lng: number;
    name: string;
    address: string;
  }>;
  center: { lat: number; lng: number };
}

function getMapCache(): CachedMapData | null {
  try {
    const cached = sessionStorage.getItem(MAP_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setMapCache(data: CachedMapData): void {
  try {
    sessionStorage.setItem(MAP_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

export default function ComparePage() {
  const { programs, removeProgram, updateCustomization, clearAll } = useCompare();
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [kids, setKids] = useState<Kid[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const initializedProgramsRef = useRef<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Handle hydration + load kids from DB
  useEffect(() => {
    setMounted(true);

    if (!user) return;

    const loadKids = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('planner_kids')
          .select('id, name, birthday, avatar')
          .eq('user_id', session.user.id)
          .order('sort_order');

        if (error) {
          console.error('Error loading kids:', error);
          return;
        }

        if (data) {
          setKids(data.map(k => {
            let age = 0;
            if (k.birthday) {
              const today = new Date();
              const birth = new Date(k.birthday + 'T00:00:00');
              age = today.getFullYear() - birth.getFullYear();
              if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
            }
            return { id: k.id, name: k.name, age, avatar: k.avatar || '' };
          }));
        }
      } catch (err) {
        console.error('Error loading kids:', err);
      }
    };

    loadKids();
  }, [user]);

  // Memoize program IDs to detect changes
  const programIdsKey = useMemo(() =>
    programs.map(p => p.program.id).sort().join(','),
    [programs]
  );

  // Initialize map after mount - with caching
  const initializeMap = useCallback(() => {
    const mapElement = mapRef.current;
    if (!mapElement || !window.google?.maps?.Map) return;

    // Strict validation: must be a real HTMLElement and connected to DOM
    if (!(mapElement instanceof HTMLElement) || !document.body.contains(mapElement) || !mapElement.isConnected) {
      return;
    }

    // Skip if already initialized for this exact set of programs
    if (mapInstanceRef.current && initializedProgramsRef.current === programIdsKey) {
      return;
    }

    // Check cache first
    const cache = getMapCache();
    const currentProgramIds = programs.map(p => p.program.id).sort();

    let locations: CachedMapData['locations'];
    let center: { lat: number; lng: number };

    // Use cached data if program set matches
    if (cache &&
        cache.programIds.length === currentProgramIds.length &&
        cache.programIds.every((id, i) => id === currentProgramIds[i])) {
      locations = cache.locations;
      center = cache.center;
    } else {
      // Compute locations from program data
      locations = programs
        .filter(p => p.program.program_locations?.[0]?.latitude && p.program.program_locations?.[0]?.longitude)
        .map(p => ({
          lat: p.program.program_locations![0].latitude as number,
          lng: p.program.program_locations![0].longitude as number,
          name: p.program.name,
          address: p.program.program_locations![0].address || '',
        }));

      if (locations.length === 0) return;

      center = {
        lat: locations.reduce((sum, l) => sum + l.lat, 0) / locations.length,
        lng: locations.reduce((sum, l) => sum + l.lng, 0) / locations.length,
      };

      // Cache the computed data
      setMapCache({ programIds: currentProgramIds, locations, center });
    }

    if (locations.length === 0) return;

    try {
      // Double check element is still valid before creating map
      if (!mapRef.current || !document.body.contains(mapRef.current)) {
        return;
      }
      const map = new window.google.maps.Map(mapElement, {
        center,
        zoom: 12,
        styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
      });
      mapInstanceRef.current = map;
      initializedProgramsRef.current = programIdsKey;
      setMapReady(true);

      locations.forEach((location, index) => {
        const marker = new window.google!.maps.Marker({
          position: { lat: location.lat, lng: location.lng },
          map,
          title: location.name,
          label: { text: String(index + 1), color: 'white', fontWeight: 'bold' },
        });

        const infoWindow = new window.google!.maps.InfoWindow({
          content: `<div style="padding:8px"><strong>${location.name}</strong><br/><span style="color:#666">${location.address}</span></div>`,
        });

        marker.addListener('click', () => infoWindow.open(map, marker));
      });
    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Failed to load map');
    }
  }, [programs, programIdsKey]);

  // Load Google Maps script and initialize
  useEffect(() => {
    if (!mounted || programs.length === 0) return;

    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const safeInitialize = () => {
      if (isCancelled) return;
      if (!mapRef.current || !document.body.contains(mapRef.current)) return;
      initializeMap();
    };

    const waitForGoogleMaps = () => {
      if (window.google?.maps?.Map) {
        safeInitialize();
        return;
      }

      intervalId = setInterval(() => {
        if (isCancelled) {
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (window.google?.maps?.Map) {
          if (intervalId) clearInterval(intervalId);
          safeInitialize();
        }
      }, 100);

      timeoutId = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
      }, 10000);
    };

    // Load script if not already loaded
    if (!document.getElementById('google-maps-script')) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        setMapError('API key not configured');
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onerror = () => setMapError('Failed to load Google Maps');
      document.head.appendChild(script);
    }

    waitForGoogleMaps();

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      mapInstanceRef.current = null;
      initializedProgramsRef.current = null;
      setMapReady(false);
    };
  }, [mounted, programs, initializeMap]);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) {
      router.push('/login?next=/compare');
      return;
    }

    setSaving(true);

    try {
      // Save each program via API (handles limit checks server-side)
      const results = await Promise.allSettled(
        programs.map(async ({ program, customization }) => {
          const originalId = program.id.includes('_dup_') ? program.id.split('_dup_')[0] : program.id;
          const selectedDays = customization.selectedDays || [];

          const kidAssignments = customization.assignedKids || [];
          const isAllKids = kidAssignments.includes('all');

          const res = await fetch('/api/planner/programs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              program_id: originalId,
              status: 'considering',
              assign_all_kids: isAllKids,
              kid_ids: isAllKids ? [] : kidAssignments,
              schedule_days: selectedDays.map(d => d.day),
              schedule_times: selectedDays,
              cost_per_session: customization.costPerSession ?? null,
              override_new_registration_date: customization.registrationDate || null,
            }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (res.status === 409) return; // Already saved — skip
            throw new Error(body.error || 'Failed to save');
          }
        })
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0 && failures.length === programs.length) {
        throw new Error('Failed to save programs');
      }

      setSaveSuccess(true);
      clearAll();

      setTimeout(() => {
        setSaveSuccess(false);
        router.push('/familyplanning/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error saving programs:', error);
      alert('Failed to save programs. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDayToggle = (programId: string, day: string) => {
    const program = programs.find(p => p.program.id === programId);
    if (!program) return;

    const selectedDays = program.customization.selectedDays || [];
    const isSelected = selectedDays.some(d => d.day === day);

    if (isSelected) {
      updateCustomization(programId, {
        selectedDays: selectedDays.filter(d => d.day !== day),
      });
    } else {
      updateCustomization(programId, {
        selectedDays: [...selectedDays, { day, time: '17:00' }],
      });
    }
  };

  const handleTimeChange = (programId: string, day: string, time: string) => {
    const program = programs.find(p => p.program.id === programId);
    if (!program) return;

    const selectedDays = program.customization.selectedDays || [];
    updateCustomization(programId, {
      selectedDays: selectedDays.map(d => d.day === day ? { ...d, time } : d),
    });
  };

  const handleKidToggle = (programId: string, kidId: string) => {
    const program = programs.find(p => p.program.id === programId);
    if (!program) return;

    const assignedKids = program.customization.assignedKids || [];

    if (kidId === 'all') {
      updateCustomization(programId, {
        assignedKids: assignedKids.includes('all') ? [] : ['all'],
      });
    } else {
      const withoutAll = assignedKids.filter(k => k !== 'all');
      const hasKid = withoutAll.includes(kidId);
      updateCustomization(programId, {
        assignedKids: hasKid ? withoutAll.filter(k => k !== kidId) : [...withoutAll, kidId],
      });
    }
  };

  // Show loading state during hydration
  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-gray-600">Loading comparison...</p>
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">No Programs to Compare</h1>
        <p className="text-gray-600 mb-8">
          Add programs to compare by clicking the + button on program cards.
        </p>
        <Link href="/programs" className="btn-primary">
          Browse Programs
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-primary-50 to-white min-h-screen pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/programs" className="text-primary-600 hover:text-primary-700 text-sm mb-2 inline-block">
            ← Back to Programs
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Compare Programs</h1>
          <p className="text-gray-600 mt-1">
            Comparing {programs.length} program{programs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Save Section */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to track these programs?</h2>
          <p className="text-gray-600 mb-4 max-w-xl mx-auto">
            Save your comparison to the Family Planner dashboard. Track registration dates,
            assign programs to your kids, and get reminders when it's time to sign up.
          </p>
          <button
            onClick={handleSave}
            disabled={saveSuccess || saving}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-lg transition-all ${
              saveSuccess
                ? 'bg-green-500 text-white cursor-default'
                : 'btn-primary'
            }`}
          >
            {saveSuccess ? (
              <>
                <span>✓</span>
                <span>Saved! Redirecting to dashboard...</span>
              </>
            ) : (
              <span>Save to Family Planner</span>
            )}
          </button>
        </div>

        {/* Map Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Locations</h2>
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-48 md:h-64 bg-gray-100 rounded-xl overflow-hidden"
            />
            {(mapError || !mapReady) && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-100 rounded-xl">
                {mapError || 'Loading map...'}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="overflow-x-auto pb-4">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${programs.length}, minmax(320px, 1fr))`,
              minWidth: programs.length > 2 ? `${programs.length * 340}px` : 'auto'
            }}
          >
            {programs.map(({ program, customization }, index) => {
              const selectedDays = customization.selectedDays || [];
              const assignedKids = customization.assignedKids || [];

              return (
                <div key={program.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                  {/* Header */}
                  <div className="h-2 bg-gradient-to-r from-primary-500 to-primary-600" />
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 line-clamp-2">{program.name}</h3>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remove "${program.name}" from comparison?`)) {
                            removeProgram(program.id);
                          }
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors text-xl"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Key Fields */}
                  <div className="p-4 space-y-4">
                    {/* Apply to which kid - only show if kids exist */}
                    {kids.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          Assign to
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => handleKidToggle(program.id, 'all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                              assignedKids.includes('all')
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            All Kids
                          </button>
                          {kids.map(kid => (
                            <button
                              key={kid.id}
                              onClick={() => handleKidToggle(program.id, kid.id)}
                              disabled={assignedKids.includes('all')}
                              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all ${
                                assignedKids.includes('all') || assignedKids.includes(kid.id)
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              } ${assignedKids.includes('all') ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              <span className="text-sm">{kid.avatar}</span>
                              <span>{kid.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Registration Date - only show if program has date or user entered one */}
                    {(program.new_registration_date || program.re_enrollment_date || customization.registrationDate) && (
                      <DateInput
                        label="Registration Date"
                        value={customization.registrationDate || program.new_registration_date || program.re_enrollment_date || ''}
                        onChange={(v) => updateCustomization(program.id, { registrationDate: v || null })}
                        size="sm"
                        futureMonths={18}
                      />
                    )}

                    {/* Sign up day & time */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        🗓️ Sign up day & time
                      </label>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {DAYS_OF_WEEK.map(({ key, label }) => {
                          const isSelected = selectedDays.some(d => d.day === key);

                          return (
                            <button
                              key={key}
                              onClick={() => handleDayToggle(program.id, key)}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                isSelected
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                      {selectedDays.length > 0 && (
                        <div className="space-y-1">
                          {DAYS_OF_WEEK.filter(d => selectedDays.some(s => s.day === d.key)).map(({ key, label }) => {
                            const daySelection = selectedDays.find(d => d.day === key);
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="w-10 text-xs text-gray-600">{label}</span>
                                <input
                                  type="time"
                                  value={daySelection?.time || '17:00'}
                                  onChange={(e) => handleTimeChange(program.id, key, e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-xs"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Cost */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        💰 Cost per session
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={customization.costPerSession ?? ''}
                          onChange={(e) => updateCustomization(program.id, {
                            costPerSession: e.target.value ? parseFloat(e.target.value) : null
                          })}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="0.00"
                        />
                        {program.price_unit && (
                          <span className="text-xs text-gray-500">{program.price_unit}</span>
                        )}
                      </div>
                      {/* Monthly estimate */}
                      {customization.costPerSession && selectedDays.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
                          Est. monthly: <span className="font-semibold">
                            ${(customization.costPerSession * selectedDays.length * 4).toFixed(0)} - ${(customization.costPerSession * selectedDays.length * 5).toFixed(0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {(program.registration_url || program.provider_website) && (
                    <div className="p-4 border-t border-gray-100 space-y-2">
                      {program.registration_url && (
                        <a
                          href={program.registration_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary w-full block text-center text-sm"
                        >
                          Apply →
                        </a>
                      )}
                      {program.provider_website && (
                        <a
                          href={program.provider_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-primary-600 hover:text-primary-700 text-center truncate"
                        >
                          {program.provider_website.replace(/^https?:\/\//, '').split('/')[0]}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Save Button */}
        <div className="mt-8 text-center">
          <button
            onClick={handleSave}
            disabled={saveSuccess || saving}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-lg transition-all ${
              saveSuccess
                ? 'bg-green-500 text-white cursor-default'
                : 'btn-primary'
            }`}
          >
            {saveSuccess ? (
              <>
                <span>✓</span>
                <span>Saved! Redirecting to dashboard...</span>
              </>
            ) : (
              <span>Save to Family Planner</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
