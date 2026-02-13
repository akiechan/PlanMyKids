'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Program, ProgramLocation } from '@/types/database';
import SaveButton from '@/components/SaveButton';

type CampWithLocations = Program & {
  program_locations?: ProgramLocation[];
};

const SEASON_LABELS: Record<string, string> = {
  summer: 'Summer Camp',
  spring: 'Spring Break Camp',
  fall: 'Fall Camp',
  winter: 'Winter Camp',
};

const SEASON_EMOJI: Record<string, string> = {
  summer: '☀️',
  spring: '🌸',
  fall: '🍂',
  winter: '❄️',
};

// Format time from 24h to 12h format
const formatTime = (time: string | null) => {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`;
};

export default function CampDetailPage() {
  const params = useParams();
  const campId = params?.id as string;

  const [camp, setCamp] = useState<CampWithLocations | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (campId) {
      fetchCampDetails();
    }
  }, [campId]);

  // Load Google Maps
  useEffect(() => {
    if (!camp?.program_locations?.[0]?.latitude || !camp?.program_locations?.[0]?.longitude) return;

    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let initTimeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const initMap = () => {
      if (isCancelled || mapInstanceRef.current) return;

      const mapElement = mapRef.current;

      // Strict validation
      if (!mapElement || !(mapElement instanceof HTMLElement)) {
        return;
      }

      if (!document.body.contains(mapElement) || !mapElement.isConnected) {
        return;
      }

      // Ensure element has dimensions
      const rect = mapElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        initTimeoutId = setTimeout(() => {
          if (!isCancelled) initMap();
        }, 200);
        return;
      }

      const location = {
        lat: camp.program_locations![0].latitude,
        lng: camp.program_locations![0].longitude,
      };

      try {
        // Final validation before creating map
        if (!mapRef.current || !document.body.contains(mapRef.current)) {
          return;
        }

        const map = new window.google!.maps.Map(mapRef.current, {
          center: location,
          zoom: 15,
          mapId: 'planmykids-map',
          styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
        });
        mapInstanceRef.current = map;
        setMapReady(true);

        // Use AdvancedMarkerElement if available, fall back to Marker
        if (window.google?.maps?.marker?.AdvancedMarkerElement) {
          new window.google.maps.marker.AdvancedMarkerElement({
            position: location,
            map,
            title: camp.name,
          });
        } else {
          new window.google!.maps.Marker({
            position: location,
            map,
            title: camp.name,
          });
        }
      } catch (err) {
        console.error('Error initializing map:', err);
      }
    };

    const waitForGoogleMaps = () => {
      if (window.google?.maps?.Map) {
        // Delay to ensure DOM is fully ready
        initTimeoutId = setTimeout(initMap, 300);
        return;
      }

      intervalId = setInterval(() => {
        if (isCancelled) {
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (window.google?.maps?.Map) {
          if (intervalId) clearInterval(intervalId);
          initTimeoutId = setTimeout(initMap, 300);
        }
      }, 100);

      timeoutId = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
      }, 10000);
    };

    // Delay initial check to ensure component is fully mounted
    const mountDelay = setTimeout(() => {
      if (isCancelled) return;

      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        script.async = true;
        script.defer = true;
        script.onload = waitForGoogleMaps;
        document.head.appendChild(script);
      } else {
        waitForGoogleMaps();
      }
    }, 100);

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      if (initTimeoutId) clearTimeout(initTimeoutId);
      clearTimeout(mountDelay);
    };
  }, [camp]);

  const fetchCampDetails = async () => {
    try {
      const response = await fetch(`/api/camps/${campId}`);
      const result = await response.json();

      if (result.error) throw new Error(result.error);
      setCamp(result.camp);
    } catch (error) {
      console.error('Error fetching camp:', error);
    } finally {
      setLoading(false);
    }
  };

  const displayPrice = () => {
    if (!camp) return null;
    if (camp.price_min === 0 && (camp.price_max === 0 || camp.price_max == null)) {
      return <span className="text-2xl font-bold text-green-600">Free</span>;
    }
    // Handle unknown price
    if (camp.price_min == null && camp.price_max == null) {
      return <span className="text-gray-500 italic">Contact for pricing</span>;
    }
    const priceStr = camp.price_min != null && camp.price_max != null && camp.price_min !== camp.price_max
      ? `$${camp.price_min} - $${camp.price_max}`
      : `$${camp.price_min ?? camp.price_max}`;
    return (
      <span className="text-2xl font-bold text-gray-900">
        {priceStr}
        {camp.price_unit && <span className="text-base font-normal text-gray-600 ml-1">{camp.price_unit}</span>}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading camp details...</p>
        </div>
      </div>
    );
  }

  if (!camp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏕️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Camp Not Found</h1>
          <p className="text-gray-600 mb-4">The camp you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/camps" className="text-green-600 hover:text-green-700 font-medium">
            ← Back to Camps
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/camps"
          className="inline-flex items-center text-green-600 hover:text-green-700 font-medium"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Camps
        </Link>
      </div>

      {/* Featured Banner */}
      {camp.is_featured && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 rounded-xl mb-6 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <span className="font-semibold text-lg">Featured Camp</span>
              <p className="text-amber-100 text-sm">Premium Partner</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Tags */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {camp.camp_season && (
                <span className="text-sm px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                  {SEASON_EMOJI[camp.camp_season]} {SEASON_LABELS[camp.camp_season]}
                </span>
              )}
              {camp.camp_days_format && (
                <span className="text-sm px-3 py-1 rounded-full bg-green-50 text-green-600">
                  {camp.camp_days_format === 'weekly' ? '📅 Week-by-Week' : '📆 Daily Drop-in'}
                </span>
              )}
              {camp.category.map((cat) => (
                <span
                  key={cat}
                  className="text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600"
                >
                  {cat}
                </span>
              ))}
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{camp.name}</h1>
            <SaveButton program={camp} variant="detail" />
            {camp.provider_name && camp.provider_name !== camp.name && (
              <p className="text-gray-600 mt-3">by <span className="font-medium">{camp.provider_name}</span></p>
            )}
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About This Camp</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {camp.description}
            </p>
          </div>

          {/* Location & Map */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Location</h2>
            {camp.program_locations && camp.program_locations.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900">{camp.program_locations[0].address || camp.program_locations[0].neighborhood}</p>
                  {camp.program_locations[0].neighborhood && camp.program_locations[0].address && (
                    <p className="text-sm text-gray-600 mt-1">{camp.program_locations[0].neighborhood}</p>
                  )}
                </div>
                {camp.program_locations[0].latitude && camp.program_locations[0].longitude && (
                  <div className="relative">
                    <div ref={mapRef} className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden" />
                    {!mapReady && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm bg-gray-100 rounded-lg">
                        Loading map...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No location information available</p>
            )}
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 lg:sticky lg:top-20">
            <div className="space-y-4">
              {/* Price */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Price</p>
                {displayPrice()}
              </div>

              {/* Camp Dates */}
              {(camp.start_date || camp.end_date) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Camp Dates</p>
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                    <span className="text-lg">📅</span>
                    <span className="font-semibold">
                      {camp.start_date && camp.end_date
                        ? `${new Date(camp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(camp.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : camp.start_date
                        ? `Starts ${new Date(camp.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : `Ends ${new Date(camp.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Hours - moved higher for visibility */}
              {(camp.hours_start || camp.hours_end || camp.before_care || camp.after_care) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Hours</p>
                  {(camp.hours_start || camp.hours_end) && (
                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg mb-2">
                      <span className="text-lg">🕐</span>
                      <span className="font-semibold">
                        {camp.hours_start && camp.hours_end
                          ? `${formatTime(camp.hours_start)} - ${formatTime(camp.hours_end)}`
                          : camp.hours_start
                          ? `Starts ${formatTime(camp.hours_start)}`
                          : `Ends ${formatTime(camp.hours_end)}`}
                      </span>
                    </div>
                  )}

                  {/* Before/After Care */}
                  {(camp.before_care || camp.after_care) && (
                    <div className="space-y-2">
                      {camp.before_care && (
                        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                          <span className="text-lg">🌅</span>
                          <div>
                            <span className="font-medium">Before Care</span>
                            {camp.before_care_start && (
                              <span className="text-sm ml-1">starts at {formatTime(camp.before_care_start)}</span>
                            )}
                          </div>
                        </div>
                      )}
                      {camp.after_care && (
                        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-lg">
                          <span className="text-lg">🌆</span>
                          <div>
                            <span className="font-medium">After Care</span>
                            {camp.after_care_end && (
                              <span className="text-sm ml-1">until {formatTime(camp.after_care_end)}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Age Range */}
              {(camp.age_min != null || camp.age_max != null) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Age Range</p>
                  <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-3 py-2 rounded-lg">
                    <span className="text-lg">👶</span>
                    <span className="font-semibold">
                      {camp.age_min != null && camp.age_max != null
                        ? `Ages ${camp.age_min} - ${camp.age_max}`
                        : camp.age_min != null
                        ? `Ages ${camp.age_min}+`
                        : `Up to age ${camp.age_max}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Registration Dates */}
              {(camp.re_enrollment_date || camp.new_registration_date) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Registration Opens</p>
                  <div className="space-y-2">
                    {camp.re_enrollment_date && (
                      <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                        <span className="text-lg">🔄</span>
                        <div>
                          <span className="font-medium">Returning Families</span>
                          <span className="text-sm ml-1">{new Date(camp.re_enrollment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    )}
                    {camp.new_registration_date && (
                      <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                        <span className="text-lg">✨</span>
                        <div>
                          <span className="font-medium">New Families</span>
                          <span className="text-sm ml-1">{new Date(camp.new_registration_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Registration */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Registration</p>
                {camp.registration_url ? (
                  <a
                    href={camp.registration_url.startsWith('http') ? camp.registration_url : `https://${camp.registration_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white w-full block text-center py-3 rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all"
                  >
                    Register Now
                  </a>
                ) : (
                  <p className="text-sm text-gray-500 italic">Contact provider for registration</p>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700">Contact</p>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📞</span>
                  {camp.contact_phone ? (
                    <a href={`tel:${camp.contact_phone}`} className="text-green-600 hover:text-green-700 text-sm">
                      {camp.contact_phone}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400">✉️</span>
                  {camp.contact_email ? (
                    <a href={`mailto:${camp.contact_email}`} className="text-green-600 hover:text-green-700 text-sm break-all">
                      {camp.contact_email}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🌐</span>
                  {camp.provider_website ? (
                    <a
                      href={camp.provider_website.startsWith('http') ? camp.provider_website : `https://${camp.provider_website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 text-sm break-all"
                    >
                      {camp.provider_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

              </div>

              {/* Google Reviews */}
              {camp.google_rating && (
                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">Google Reviews</p>
                    {camp.google_reviews_url && (
                      <a
                        href={camp.google_reviews_url.startsWith('http') ? camp.google_reviews_url : `https://${camp.google_reviews_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-700 text-xs font-medium flex items-center gap-1"
                      >
                        View on Google
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <span className="text-yellow-500 text-3xl">⭐</span>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-900">{camp.google_rating}</span>
                        <span className="text-sm text-gray-600">out of 5</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Based on {camp.google_review_count} Google review{camp.google_review_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
