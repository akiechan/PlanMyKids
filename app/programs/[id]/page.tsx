'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Program, ProgramLocation } from '@/types/database';
import SaveButton from '@/components/SaveButton';

type ProgramWithLocations = Program & {
  program_locations?: ProgramLocation[];
};

export default function ProgramDetailPage() {
  const params = useParams();
  const programId = params?.id as string;

  const [program, setProgram] = useState<ProgramWithLocations | null>(null);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMap | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (programId) {
      fetchProgramDetails();
    }
  }, [programId]);

  // Load Google Maps and initialize map
  useEffect(() => {
    if (!program?.program_locations?.[0]?.latitude || !program?.program_locations?.[0]?.longitude) return;

    let intervalId: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const initMap = () => {
      if (isCancelled || !mapRef.current || mapInstanceRef.current) return;
      // Extra safety: check if the element is still in the document
      if (!document.body.contains(mapRef.current)) return;

      const location = {
        lat: program.program_locations![0].latitude,
        lng: program.program_locations![0].longitude,
      };

      try {
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
            title: program.name,
          });
        } else {
          // Fallback for older API versions
          new window.google!.maps.Marker({
            position: location,
            map,
            title: program.name,
          });
        }
      } catch (err) {
        console.error('Error initializing map:', err);
      }
    };

    const waitForGoogleMaps = () => {
      if (window.google?.maps?.Map) {
        initMap();
        return;
      }

      intervalId = setInterval(() => {
        if (isCancelled) {
          if (intervalId) clearInterval(intervalId);
          return;
        }
        if (window.google?.maps?.Map) {
          if (intervalId) clearInterval(intervalId);
          initMap();
        }
      }, 100);

      timeoutId = setTimeout(() => {
        if (intervalId) clearInterval(intervalId);
      }, 10000);
    };

    // Load script if not already loaded
    if (!document.getElementById('google-maps-script')) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
      if (!apiKey) return;

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    waitForGoogleMaps();

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
      mapInstanceRef.current = null;
      setMapReady(false);
    };
  }, [program]);

  const fetchProgramDetails = async () => {
    try {
      // Fetch program with locations
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select(`
          *,
          program_locations(*)
        `)
        .eq('id', programId)
        .single();

      if (programError) throw programError;

      setProgram(programData);
    } catch (error) {
      console.error('Error fetching program details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 h-96 w-full rounded-xl" />
          <div className="bg-gray-200 h-8 w-3/4 rounded" />
          <div className="bg-gray-200 h-4 w-full rounded" />
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Program Not Found</h1>
        <Link href="/programs" className="text-primary-600 hover:underline">
          ← Back to all programs
        </Link>
      </div>
    );
  }

  const displayPrice = () => {
    // If no price info or price is 0, show contact message
    if (program.price_min == null && program.price_max == null) {
      return <span className="text-sm sm:text-base text-gray-500">Contact for pricing</span>;
    }
    if (program.price_min === 0 && (program.price_max === 0 || program.price_max == null)) {
      return <span className="text-sm sm:text-base text-gray-500">Contact for pricing</span>;
    }
    return (
      <div>
        <span className="text-gray-900 font-bold text-xl sm:text-2xl">
          {program.price_min != null && program.price_max != null && program.price_min !== program.price_max
            ? `$${program.price_min} - $${program.price_max}`
            : `$${program.price_min ?? program.price_max}`}
        </span>
        {program.price_unit && (
          <span className="text-sm sm:text-base text-gray-600 ml-1.5 sm:ml-2">{program.price_unit}</span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
      {/* Back Button */}
      <div className="mb-4 sm:mb-6">
        <Link
          href="/programs"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors min-h-[44px] sm:min-h-0"
        >
          ← Back to Programs
        </Link>
      </div>

      {/* Featured Banner */}
      {program.is_featured && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl mb-4 sm:mb-6 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xl sm:text-2xl">⭐</span>
            <div>
              <span className="font-semibold text-base sm:text-lg">Featured Program</span>
              <p className="text-amber-100 text-xs sm:text-sm">Premium Partner</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Categories */}
          <div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              {program.category.map((cat) => (
                <span
                  key={cat}
                  className={`text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-full ${
                    program.is_featured
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-primary-100 text-primary-700'
                  }`}
                >
                  {cat}
                </span>
              ))}
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{program.name}</h1>
            <SaveButton program={program} variant="detail" />
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">About This Program</h2>
            <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
              {program.description}
            </p>
          </div>

          {/* Location & Map */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Location</h2>
            {program.program_locations && program.program_locations.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-gray-900">{program.program_locations[0].address || program.program_locations[0].neighborhood}</p>
                  {program.program_locations[0].neighborhood && program.program_locations[0].address && (
                    <p className="text-sm text-gray-600 mt-1">{program.program_locations[0].neighborhood}</p>
                  )}
                  {program.program_locations.length > 1 && (
                    <p className="text-xs text-primary-600 mt-1">
                      + {program.program_locations.length - 1} more location{program.program_locations.length > 2 ? 's' : ''}
                    </p>
                  )}
                </div>
                {program.program_locations[0].latitude && program.program_locations[0].longitude && (
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
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Info Card */}
          <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 lg:sticky lg:top-20">
            <div className="space-y-3 sm:space-y-4">
              {/* Price */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Price</p>
                {displayPrice()}
              </div>

              {/* Registration */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200">
                <p className="text-xs sm:text-sm text-gray-600 mb-2">Registration</p>
                {program.re_enrollment_date && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">Current Students</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {new Date(program.re_enrollment_date + 'T00:00:00').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
                {program.new_registration_date && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500">New Students</p>
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {new Date(program.new_registration_date + 'T00:00:00').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
                {!program.re_enrollment_date && !program.new_registration_date && (
                  <p className="text-xs sm:text-sm text-gray-500 italic mb-2">
                    Registration dates not yet available
                  </p>
                )}
                {program.registration_url ? (
                  <a
                    href={program.registration_url.startsWith('http') ? program.registration_url : `https://${program.registration_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary w-full block text-center mt-3"
                  >
                    Register Now
                  </a>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-500 italic">
                    Contact provider for registration details
                  </p>
                )}
              </div>

              {/* Contact Information */}
              <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-gray-200">
                <p className="text-xs sm:text-sm font-medium text-gray-700">Contact</p>

                {/* Phone */}
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <span className="text-gray-400">📞</span>
                  {program.contact_phone ? (
                    <a
                      href={`tel:${program.contact_phone}`}
                      className="text-primary-600 hover:text-primary-700 active:text-primary-800 text-sm"
                    >
                      {program.contact_phone}
                    </a>
                  ) : (
                    <span className="text-xs sm:text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <span className="text-gray-400">✉️</span>
                  {program.contact_email ? (
                    <div className="flex-1 min-w-0">
                      <a
                        href={`mailto:${program.contact_email}`}
                        className="text-primary-600 hover:text-primary-700 active:text-primary-800 text-sm break-all"
                      >
                        {program.contact_email}
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs sm:text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

                {/* Website */}
                <div className="flex items-center gap-2 min-h-[44px] sm:min-h-0">
                  <span className="text-gray-400">🌐</span>
                  {program.provider_website ? (
                    <a
                      href={program.provider_website.startsWith('http') ? program.provider_website : `https://${program.provider_website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 active:text-primary-800 text-sm break-all"
                    >
                      {program.provider_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  ) : (
                    <span className="text-xs sm:text-sm text-gray-400 italic">Not available</span>
                  )}
                </div>

              </div>

              {/* Google Reviews */}
              {program.google_rating && (
                <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm font-medium text-gray-700">Google Reviews</p>
                    {program.google_reviews_url && (
                      <a
                        href={program.google_reviews_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center gap-1"
                      >
                        View on Google
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 p-3 bg-yellow-50 rounded-lg">
                    <span className="text-yellow-500 text-2xl sm:text-3xl">⭐</span>
                    <div>
                      <div className="flex items-baseline gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-gray-900">{program.google_rating}</span>
                        <span className="text-xs sm:text-sm text-gray-600">out of 5</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Based on {program.google_review_count} Google review{program.google_review_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Suggest Edit Button */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <Link
          href={`/programs/${programId}/edit`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Suggest Edit
        </Link>
      </div>
    </div>
  );
}
