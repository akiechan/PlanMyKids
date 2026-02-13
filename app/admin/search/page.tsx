'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAdminLogger } from '@/hooks/useAdminLogger';
import { useRegion } from '@/contexts/RegionContext';

interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface HistoryPlace {
  id: string;
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number | null;
  user_ratings_total: number;
  place_types: string[];
  search_query: string;
  added_to_programs: boolean;
  created_at: string;
}

function HistoryDisplay({ filter, onAddPlace }: {
  filter: 'all' | 'not_added';
  onAddPlace: (place: HistoryPlace) => void;
}) {
  const [history, setHistory] = useState<HistoryPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('google_places_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter === 'not_added') {
        query = query.eq('added_to_programs', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        {filter === 'not_added'
          ? 'No places found that haven\'t been added yet.'
          : 'No search history yet. Try searching for places first.'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((place) => (
        <div
          key={place.id}
          className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{place.name}</h3>
                {place.added_to_programs && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    ✓ Added
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">{place.formatted_address}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                {place.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-medium">{place.rating}</span>
                    <span>({place.user_ratings_total} reviews)</span>
                  </div>
                )}
                <span>Query: "{place.search_query}"</span>
                <span>{new Date(place.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            {!place.added_to_programs && (
              <button
                onClick={() => onAddPlace(place)}
                className="btn-primary text-sm whitespace-nowrap"
              >
                Add This Place
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    weekday_text?: string[];
  };
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

// Helper function to scrape website for additional info
async function scrapeWebsiteForInfo(websiteUrl: string): Promise<{
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  registration_url: string | null;
} | null> {
  try {
    console.log('Scraping website for additional info:', websiteUrl);
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteUrl,
        crawl: true,
        maxPages: 3,
        maxDepth: 1,
      }),
    });

    if (!response.ok) {
      console.log('Scrape failed:', response.status);
      return null;
    }

    const result = await response.json();
    if (result.error || !result.data) {
      console.log('Scrape returned error:', result.error);
      return null;
    }

    console.log('Scrape successful, got data:', Object.keys(result.data));
    return {
      contact_email: result.data.contact_email || null,
      contact_phone: result.data.contact_phone || null,
      description: result.data.description || null,
      price_min: result.data.price_min || null,
      price_max: result.data.price_max || null,
      price_unit: result.data.price_unit || null,
      registration_url: result.data.registration_url || null,
    };
  } catch (err) {
    console.error('Error scraping website:', err);
    return null;
  }
}

interface ScrapedData {
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;
  registration_url: string | null;
}

function SearchResultCard({
  place,
  isSelected,
  onToggleSelect,
  onQuickApprove,
  onEditApprove,
  submitting,
  fetchPlaceDetails,
}: {
  place: GooglePlace;
  isSelected: boolean;
  onToggleSelect: () => void;
  onQuickApprove: () => void;
  onEditApprove: () => void;
  submitting: boolean;
  fetchPlaceDetails: (placeId: string) => Promise<PlaceDetails | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [scrapingWebsite, setScrapingWebsite] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !details) {
      setLoadingDetails(true);
      const fetchedDetails = await fetchPlaceDetails(place.place_id);
      setDetails(fetchedDetails);
      setLoadingDetails(false);

      // Also scrape the website if available
      if (fetchedDetails?.website && !scrapedData) {
        setScrapingWebsite(true);
        const scraped = await scrapeWebsiteForInfo(fetchedDetails.website);
        setScrapedData(scraped);
        setScrapingWebsite(false);
      }
    }
    setExpanded(!expanded);
  };

  // Extract place types for display
  const displayTypes = (place.types || [])
    .filter(t => !['point_of_interest', 'establishment', 'geocode', 'premise'].includes(t))
    .slice(0, 3)
    .map(t => t.replace(/_/g, ' '));

  const formatPrice = () => {
    if (!scrapedData?.price_min && !scrapedData?.price_max) return null;
    if (scrapedData.price_min && scrapedData.price_max) {
      return `$${scrapedData.price_min} - $${scrapedData.price_max}${scrapedData.price_unit ? ` ${scrapedData.price_unit}` : ''}`;
    }
    if (scrapedData.price_min) {
      return `From $${scrapedData.price_min}${scrapedData.price_unit ? ` ${scrapedData.price_unit}` : ''}`;
    }
    return `Up to $${scrapedData.price_max}${scrapedData.price_unit ? ` ${scrapedData.price_unit}` : ''}`;
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-primary-300'
      }`}
    >
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5 mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                {place.name}
              </h3>
              <p className="text-sm text-gray-600 mb-2 truncate">{place.formatted_address}</p>

              {/* Rating and Types Row */}
              <div className="flex flex-wrap items-center gap-3 text-sm mb-2">
                {place.rating && (
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">⭐</span>
                    <span className="font-medium">{place.rating}</span>
                    <span className="text-gray-500">
                      ({place.user_ratings_total} reviews)
                    </span>
                  </div>
                )}
                {displayTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {displayTypes.map(type => (
                      <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Expand/Collapse Details */}
              <button
                onClick={handleExpand}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                {loadingDetails ? (
                  'Loading details...'
                ) : expanded ? (
                  <>Hide details ▲</>
                ) : (
                  <>Show website & contact ▼</>
                )}
              </button>

              {/* Expanded Details */}
              {expanded && details && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3 text-sm">
                  {/* Google Places Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="font-medium text-gray-700">Website:</span>{' '}
                      {details.website ? (
                        <a
                          href={details.website.startsWith('http') ? details.website : `https://${details.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 truncate inline-block max-w-[200px] align-bottom"
                          title={details.website}
                        >
                          {details.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Phone:</span>{' '}
                      {details.formatted_phone_number ? (
                        <a href={`tel:${details.formatted_phone_number}`} className="text-blue-600 hover:text-blue-800">
                          {details.formatted_phone_number}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>

                  {details.opening_hours?.weekday_text && (
                    <div>
                      <span className="font-medium text-gray-700">Hours (Google):</span>
                      <div className="mt-1 text-xs text-gray-600 grid grid-cols-2 gap-1">
                        {details.opening_hours.weekday_text.map((day, i) => (
                          <span key={i}>{day}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scraped Data Section */}
                  {details.website && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-purple-700">From Website Scrape:</span>
                        {scrapingWebsite && (
                          <span className="text-xs text-purple-600 flex items-center gap-1">
                            <span className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                            Scraping...
                          </span>
                        )}
                      </div>

                      {scrapedData ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-purple-50 rounded-lg p-3">
                          <div>
                            <span className="font-medium text-gray-700">Email:</span>{' '}
                            {scrapedData.contact_email ? (
                              <a href={`mailto:${scrapedData.contact_email}`} className="text-blue-600 hover:text-blue-800">
                                {scrapedData.contact_email}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Phone:</span>{' '}
                            {scrapedData.contact_phone ? (
                              <span className="text-gray-900">{scrapedData.contact_phone}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Price:</span>{' '}
                            {formatPrice() ? (
                              <span className="text-green-700 font-medium">{formatPrice()}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Registration:</span>{' '}
                            {scrapedData.registration_url ? (
                              <a
                                href={scrapedData.registration_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Link →
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                          {scrapedData.description && (
                            <div className="sm:col-span-2">
                              <span className="font-medium text-gray-700">Description:</span>
                              <p className="text-gray-600 text-xs mt-1 line-clamp-3">
                                {scrapedData.description}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : !scrapingWebsite ? (
                        <div className="text-xs text-gray-500 italic">
                          No additional data found from website
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {expanded && !details && !loadingDetails && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
                  Failed to load details
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={onQuickApprove}
                disabled={submitting}
                className="btn-primary text-sm whitespace-nowrap disabled:opacity-50"
              >
                Quick Create
              </button>
              <button
                onClick={onEditApprove}
                disabled={submitting}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                Edit & Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSearchPage() {
  const { logAction } = useAdminLogger();
  const { region } = useRegion();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<GooglePlace[]>([]);
  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchMode, setSearchMode] = useState<'first20' | 'all60'>('first20');
  const [currentPage, setCurrentPage] = useState(1); // Track which page we're on
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table'); // Default to table for review
  const [editingPlace, setEditingPlace] = useState<PlaceDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bulk approval state
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [bulkCategories, setBulkCategories] = useState<string[]>([]);
  const [bulkProgramType, setBulkProgramType] = useState<'program' | 'camp'>('program');
  const [bulkCampSeason, setBulkCampSeason] = useState<'summer' | 'spring' | 'fall' | 'winter' | null>(null);
  const [bulkCampDaysFormat, setBulkCampDaysFormat] = useState<'daily' | 'weekly' | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    skipped: 0,
    failed: 0,
    currentProgram: '',
  });

  // Duplicate detection state
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [pendingSubmission, setPendingSubmission] = useState<{type: 'direct' | 'edited', data: any} | null>(null);
  const [merging, setMerging] = useState(false);

  // Merge field selection state
  const [showMergeFieldSelection, setShowMergeFieldSelection] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<any>(null);
  const [mergeFieldChoices, setMergeFieldChoices] = useState<Record<string, 'existing' | 'google' | 'scraped'>>({});
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [scrapingForMerge, setScrapingForMerge] = useState(false);

  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'not_added'>('not_added');

  const [formData, setFormData] = useState({
    name: '',
    category: [] as string[],
    description: '',
    neighborhood: '',
    address: '',
    age_min: 0,
    age_max: 18,
    age_description: '',
    price_min: null as number | null,
    price_max: null as number | null,
    price_unit: 'per class',
    provider_name: '',
    provider_website: '',
    contact_email: '',
    contact_phone: '',
    registration_url: '',
    re_enrollment_date: '',
    new_registration_date: '',
    latitude: region.center_lat,
    longitude: region.center_lng,
    program_type: 'program' as 'program' | 'camp',
    camp_season: null as 'summer' | 'spring' | 'fall' | 'winter' | null,
    camp_days_format: null as 'daily' | 'weekly' | null,
  });

  const DEFAULT_CATEGORIES = [
    'swimming', 'art', 'chess', 'soccer', 'music', 'dance',
    'martial-arts', 'technology', 'academic', 'science', 'creative', 'sports'
  ];

  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Fetch unique categories from database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from('programs')
          .select('category');

        if (data) {
          const allCats = data.flatMap(p => p.category || []);
          const uniqueCats = [...new Set(allCats)].filter(Boolean);
          const newCats = uniqueCats.filter(c => !DEFAULT_CATEGORIES.includes(c.toLowerCase()));
          setDbCategories(newCats);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  const allCategories = [...DEFAULT_CATEGORIES, ...dbCategories, ...customCategories].filter(
    (cat, idx, arr) => arr.indexOf(cat) === idx
  );

  const addCustomCategory = () => {
    const trimmed = newCategoryInput.trim().toLowerCase();
    if (trimmed && !allCategories.includes(trimmed)) {
      setCustomCategories([...customCategories, trimmed]);
      setNewCategoryInput('');
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  };

  const checkDuplicates = async (programName: string, providerName: string, categories: string[]) => {
    try {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'active')
        .is('merged_into', null);

      if (error) throw error;

      const programNameLower = programName.toLowerCase().trim();
      const providerNameLower = providerName.toLowerCase().trim();

      const potentialDuplicates = (data || []).filter((program) => {
        const existingNameLower = program.name.toLowerCase().trim();
        const nameSimilarity = calculateSimilarity(programNameLower, existingNameLower);
        const providerSimilarity = calculateSimilarity(
          providerNameLower,
          program.provider_name.toLowerCase()
        );

        const programCategories = new Set<string>(program.category || []);
        const formCategories = new Set<string>(categories || []);
        const categoryOverlap = [...programCategories].filter((c: string) => formCategories.has(c)).length;
        const categoryScore = categoryOverlap > 0 ? categoryOverlap / Math.max(programCategories.size, formCategories.size) : 0;

        const sameProvider = program.provider_name.toLowerCase() === providerNameLower;

        const words1 = existingNameLower.split(/\s+/);
        const words2 = programNameLower.split(/\s+/);
        let commonPrefixWords = 0;
        for (let i = 0; i < Math.min(words1.length, words2.length); i++) {
          if (words1[i] === words2[i]) {
            commonPrefixWords++;
          } else {
            break;
          }
        }
        const commonPrefix = words1.slice(0, commonPrefixWords).join(' ');
        const hasSignificantPrefix = commonPrefixWords >= 3 || commonPrefix.length >= 15;

        const shorterName = programNameLower.length < existingNameLower.length ? programNameLower : existingNameLower;
        const longerName = programNameLower.length < existingNameLower.length ? existingNameLower : programNameLower;
        const containsMatch = longerName.includes(shorterName) || longerName.startsWith(shorterName);

        if (hasSignificantPrefix) return true;
        if (containsMatch && shorterName.length >= 10) {
          if (shorterName.length >= 15) return true;
          if (sameProvider) return true;
          if (categoryScore > 0.3) return true;
        }
        if (sameProvider && nameSimilarity > 0.5) return true;
        if (providerSimilarity > 0.8 && nameSimilarity > 0.55) return true;
        if (nameSimilarity > 0.65 && categoryScore > 0.3) return true;
        if (nameSimilarity > 0.75) return true;

        return false;
      });

      return potentialDuplicates;
    } catch (err) {
      console.error('Error checking duplicates:', err);
      return [];
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);
    setSelectedPlaceIds(new Set());
    setNextPageToken(null);
    setCurrentPage(1);

    try {
      const response = await fetch('/api/google-places-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          fetchAll: searchMode === 'all60'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      const searchResults = data.results || [];
      setResults(searchResults);
      setNextPageToken(data.nextPageToken || null);

      // Save search results to database
      if (searchResults.length > 0) {
        try {
          const historyRecords = searchResults.map((place: GooglePlace) => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            place_types: place.types || [],
            search_query: searchQuery,
          }));

          await supabase.from('google_places_history').insert(historyRecords);
          console.log(`Saved ${historyRecords.length} places to history`);
        } catch (historyErr) {
          console.error('Error saving search history:', historyErr);
          // Don't fail the search if history save fails
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Failed to search');
    } finally {
      setSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;

    setLoadingMore(true);
    setError('');

    try {
      const response = await fetch('/api/google-places-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pageToken: nextPageToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load more results');
      }

      const newResults = data.results || [];
      setResults(prev => [...prev, ...newResults]);
      setNextPageToken(data.nextPageToken || null);
      setCurrentPage(prev => prev + 1);

      // Save new results to history
      if (newResults.length > 0) {
        try {
          const historyRecords = newResults.map((place: GooglePlace) => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            place_types: place.types || [],
            search_query: searchQuery,
          }));

          await supabase.from('google_places_history').insert(historyRecords);
          console.log(`Saved ${historyRecords.length} additional places to history`);
        } catch (historyErr) {
          console.error('Error saving search history:', historyErr);
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more results');
    } finally {
      setLoadingMore(false);
    }
  };

  // Load all remaining pages (for "Load 21-60" or "Load 41-60")
  const handleLoadAllRemaining = async () => {
    if (!nextPageToken) return;

    setLoadingMore(true);
    setError('');
    let currentToken = nextPageToken;
    let allNewResults: GooglePlace[] = [];
    let pageNum = currentPage;

    try {
      while (currentToken && pageNum < 3) {
        const response = await fetch('/api/google-places-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageToken: currentToken }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load more results');

        const newResults = data.results || [];
        allNewResults = [...allNewResults, ...newResults];
        currentToken = data.nextPageToken || null;
        pageNum++;

        // Google requires delay between page requests
        if (currentToken && pageNum < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setResults(prev => [...prev, ...allNewResults]);
      setNextPageToken(currentToken);
      setCurrentPage(pageNum);

      // Save to history
      if (allNewResults.length > 0) {
        try {
          const historyRecords = allNewResults.map((place: GooglePlace) => ({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            rating: place.rating || null,
            user_ratings_total: place.user_ratings_total || 0,
            place_types: place.types || [],
            search_query: searchQuery,
          }));
          await supabase.from('google_places_history').insert(historyRecords);
        } catch (historyErr) {
          console.error('Error saving search history:', historyErr);
        }
      }
    } catch (err) {
      console.error('Load all remaining error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more results');
    } finally {
      setLoadingMore(false);
    }
  };

  const markPlaceAsAdded = async (placeId: string) => {
    try {
      await supabase
        .from('google_places_history')
        .update({
          added_to_programs: true,
          added_at: new Date().toISOString()
        })
        .eq('place_id', placeId);
      console.log(`Marked place ${placeId} as added to programs`);
    } catch (err) {
      console.error('Error marking place as added:', err);
    }
  };

  const fetchPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
    try {
      const response = await fetch('/api/google-place-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeId }),
      });

      const data = await response.json();

      if (response.ok && data.result) {
        return data.result;
      }
      return null;
    } catch (err) {
      console.error('Error fetching place details:', err);
      return null;
    }
  };

  const toggleSelectPlace = (placeId: string) => {
    const newSelected = new Set(selectedPlaceIds);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaceIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedPlaceIds.size === results.length) {
      setSelectedPlaceIds(new Set());
    } else {
      setSelectedPlaceIds(new Set(results.map(p => p.place_id)));
    }
  };

  const toggleBulkCategory = (category: string) => {
    setBulkCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedPlaceIds.size === 0) {
      setError('Please select at least one program');
      return;
    }

    if (bulkCategories.length === 0) {
      setError('Please select at least one category for bulk creation');
      return;
    }

    setBulkApproving(true);
    setError('');

    const selectedPlaces = results.filter(p => selectedPlaceIds.has(p.place_id));
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const failedPrograms: { name: string; reason: string }[] = [];
    const skippedPrograms: { name: string; duplicateOf: string }[] = [];

    // Initialize progress
    setBulkProgress({
      current: 0,
      total: selectedPlaces.length,
      success: 0,
      skipped: 0,
      failed: 0,
      currentProgram: '',
    });

    for (let i = 0; i < selectedPlaces.length; i++) {
      const place = selectedPlaces[i];

      // Update progress
      setBulkProgress(prev => ({
        ...prev,
        current: i + 1,
        currentProgram: place.name,
      }));

      try {
        // Fetch detailed information
        const details = await fetchPlaceDetails(place.place_id);
        if (!details) {
          console.error(`Failed to fetch details for ${place.name}`);
          failedPrograms.push({ name: place.name, reason: 'Failed to fetch Google Places details' });
          errorCount++;
          setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
          continue;
        }

        // Check for duplicates before inserting
        const foundDuplicates = await checkDuplicates(details.name, details.name, bulkCategories);
        if (foundDuplicates.length > 0) {
          console.log(`Skipping ${place.name} - found ${foundDuplicates.length} potential duplicate(s)`);
          skippedPrograms.push({ name: place.name, duplicateOf: foundDuplicates[0].name });
          duplicateCount++;
          setBulkProgress(prev => ({ ...prev, skipped: prev.skipped + 1 }));
          continue;
        }

        // Extract neighborhood from address
        const addressParts = details.formatted_address.split(',');
        const neighborhood = addressParts.length > 2 ? addressParts[1].trim() : region.short_name;

        // Scrape website for additional info (email, description, etc.)
        let scrapedData: Awaited<ReturnType<typeof scrapeWebsiteForInfo>> = null;
        if (details.website) {
          console.log(`Scraping website for ${place.name}...`);
          scrapedData = await scrapeWebsiteForInfo(details.website);
        }

        // Insert program
        const { data: insertedProgram, error: programError } = await supabase
          .from('programs')
          .insert([
            {
              name: details.name,
              category: bulkCategories,
              description: scrapedData?.description || details.name,
              age_min: 0,
              age_max: 18,
              age_description: null,
              price_min: scrapedData?.price_min || null,
              price_max: scrapedData?.price_max || null,
              price_unit: scrapedData?.price_unit || null,
              provider_name: details.name,
              provider_website: details.website || null,
              contact_email: scrapedData?.contact_email || null,
              contact_phone: scrapedData?.contact_phone || details.formatted_phone_number || null,
              registration_url: scrapedData?.registration_url || null,
              status: 'active', // Auto-approved when created by admin
              google_place_id: details.place_id,
              google_rating: details.rating || null,
              google_review_count: details.user_ratings_total || 0,
              google_reviews_url: details.place_id
                ? `https://search.google.com/local/reviews?placeid=${details.place_id}`
                : null,
              program_type: bulkProgramType,
              camp_season: bulkProgramType === 'camp' ? bulkCampSeason : null,
              camp_days_format: bulkProgramType === 'camp' ? bulkCampDaysFormat : null,
            },
          ])
          .select()
          .single();

        if (programError) {
          console.error(`Error inserting ${place.name}:`, programError);
          failedPrograms.push({ name: place.name, reason: `Database error: ${programError.message}` });
          errorCount++;
          setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
          continue;
        }

        // Insert location
        await supabase.from('program_locations').insert([
          {
            program_id: insertedProgram.id,
            name: null,
            address: details.formatted_address,
            neighborhood: neighborhood,
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
            is_primary: true,
          },
        ]);

        // Mark as added in history
        await markPlaceAsAdded(place.place_id);

        // Log the action
        await logAction({
          action: 'Search & Add',
          entityType: 'program',
          entityId: insertedProgram.id,
          entityName: details.name,
          details: { action: 'added', categories: bulkCategories },
        });

        successCount++;
        setBulkProgress(prev => ({ ...prev, success: prev.success + 1 }));
      } catch (err) {
        console.error(`Error processing ${place.name}:`, err);
        failedPrograms.push({ name: place.name, reason: err instanceof Error ? err.message : 'Unknown error' });
        errorCount++;
        setBulkProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
      }
    }

    // Remove created programs from results
    setResults(prev => prev.filter(p => !selectedPlaceIds.has(p.place_id)));
    setSelectedPlaceIds(new Set());
    setBulkCategories([]);

    // Clear progress and show final result
    setBulkProgress(prev => ({ ...prev, currentProgram: '' }));

    // Build detailed report
    let report = `✅ Bulk creation complete!\n\n`;
    report += `Created: ${successCount}\n`;
    report += `Skipped (duplicates): ${duplicateCount}\n`;
    report += `Failed: ${errorCount}\n`;

    if (skippedPrograms.length > 0) {
      report += `\n--- Skipped (Duplicates) ---\n`;
      skippedPrograms.slice(0, 10).forEach(p => {
        report += `• ${p.name} → similar to "${p.duplicateOf}"\n`;
      });
      if (skippedPrograms.length > 10) {
        report += `...and ${skippedPrograms.length - 10} more\n`;
      }
    }

    if (failedPrograms.length > 0) {
      report += `\n--- Failed ---\n`;
      failedPrograms.slice(0, 10).forEach(p => {
        report += `• ${p.name}: ${p.reason}\n`;
      });
      if (failedPrograms.length > 10) {
        report += `...and ${failedPrograms.length - 10} more\n`;
      }
    }

    alert(report);
    setBulkApproving(false);
  };

  const handleApproveDirectly = async (place: GooglePlace) => {
    console.log('Quick Create clicked for:', place.name);

    // Check if categories are selected
    if (bulkCategories.length === 0) {
      console.log('No categories selected');
      setError('Please select at least one category in the "Bulk Approve" section before quick approving');
      // Scroll to bulk section
      setTimeout(() => {
        document.querySelector('.bg-blue-50')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    console.log('Categories selected:', bulkCategories);
    setSubmitting(true);
    setError('');

    try {
      // Fetch detailed information
      console.log('Fetching place details...');
      const details = await fetchPlaceDetails(place.place_id);
      if (!details) {
        throw new Error('Failed to fetch place details');
      }
      console.log('Place details fetched:', details.name);

      // Check for duplicates before inserting
      console.log('Checking for duplicates...');
      const foundDuplicates = await checkDuplicates(details.name, details.name, bulkCategories);

      if (foundDuplicates.length > 0) {
        console.log(`Found ${foundDuplicates.length} potential duplicates - showing modal`);
        setDuplicates(foundDuplicates);
        // Transform Google data to match expected format for merge modal
        const transformedData = {
          place_id: details.place_id,
          name: details.name,
          formatted_address: details.formatted_address,
          description: '', // Google doesn't provide description
          provider_website: details.website || '',
          contact_phone: details.formatted_phone_number || '',
          contact_email: '', // Google doesn't provide email
          google_rating: details.rating || null,
          google_review_count: details.user_ratings_total || 0,
          google_place_id: details.place_id,
          category: bulkCategories,
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };
        setPendingSubmission({ type: 'direct', data: transformedData });
        setShowDuplicates(true);
        setSubmitting(false);
        return;
      }

      console.log('No duplicates found, inserting program...');

      // Extract neighborhood from address (simple heuristic)
      const addressParts = details.formatted_address.split(',');
      const neighborhood = addressParts.length > 2 ? addressParts[1].trim() : region.short_name;

      // Scrape website for additional info (email, description, etc.)
      let scrapedData: Awaited<ReturnType<typeof scrapeWebsiteForInfo>> = null;
      if (details.website) {
        console.log('Scraping website for additional info...');
        scrapedData = await scrapeWebsiteForInfo(details.website);
      }

      // Insert program with selected bulk categories
      const { data: insertedProgram, error: programError } = await supabase
        .from('programs')
        .insert([
          {
            name: details.name,
            category: bulkCategories, // Use bulk categories
            description: scrapedData?.description || details.name,
            age_min: 0,
            age_max: 18,
            age_description: null,
            price_min: scrapedData?.price_min || null,
            price_max: scrapedData?.price_max || null,
            price_unit: scrapedData?.price_unit || null,
            provider_name: details.name,
            provider_website: details.website || null,
            contact_email: scrapedData?.contact_email || null,
            contact_phone: scrapedData?.contact_phone || details.formatted_phone_number || null,
            registration_url: scrapedData?.registration_url || null,
            status: 'active', // Auto-approved when created by admin
            google_place_id: details.place_id,
            google_rating: details.rating || null,
            google_review_count: details.user_ratings_total || 0,
            google_reviews_url: details.place_id
              ? `https://search.google.com/local/reviews?placeid=${details.place_id}`
              : null,
            program_type: bulkProgramType,
            camp_season: bulkProgramType === 'camp' ? bulkCampSeason : null,
            camp_days_format: bulkProgramType === 'camp' ? bulkCampDaysFormat : null,
          },
        ])
        .select()
        .single();

      if (programError) throw programError;
      console.log('Program inserted successfully:', insertedProgram.id);

      // Insert location
      console.log('Inserting location...');
      const { error: locationError } = await supabase.from('program_locations').insert([
        {
          program_id: insertedProgram.id,
          name: null,
          address: details.formatted_address,
          neighborhood: neighborhood,
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
          is_primary: true,
        },
      ]);

      if (locationError) {
        console.error('Location insert error:', locationError);
        throw locationError;
      }
      console.log('Location inserted successfully');

      // Mark as added in history
      await markPlaceAsAdded(place.place_id);

      // Log the action
      await logAction({
        action: 'Search & Add',
        entityType: 'program',
        entityId: insertedProgram.id,
        entityName: details.name,
        details: { action: 'added', categories: bulkCategories },
      });

      setSuccessMessage('Program created and approved!');
      // Remove from results
      setResults(results.filter((r) => r.place_id !== place.place_id));
    } catch (err) {
      console.error('Error approving program:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve program');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditThenApprove = async (place: GooglePlace) => {
    setError('');

    // Fetch detailed information
    const details = await fetchPlaceDetails(place.place_id);
    if (!details) {
      setError('Failed to fetch place details');
      return;
    }

    // Extract neighborhood from address
    const addressParts = details.formatted_address.split(',');
    const neighborhood = addressParts.length > 2 ? addressParts[1].trim() : region.short_name;

    // Pre-fill form with Google data
    setFormData({
      name: details.name,
      category: [],
      description: details.name,
      neighborhood: neighborhood,
      address: details.formatted_address,
      age_min: 0,
      age_max: 18,
      age_description: '',
      price_min: null,
      price_max: null,
      price_unit: 'per class',
      provider_name: details.name,
      provider_website: details.website || '',
      contact_email: '',
      contact_phone: details.formatted_phone_number || '',
      registration_url: '',
      re_enrollment_date: '',
      new_registration_date: '',
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      program_type: bulkProgramType,
      camp_season: bulkCampSeason,
      camp_days_format: bulkCampDaysFormat,
    });

    setEditingPlace(details);

    // Scroll to form
    setTimeout(() => {
      document.getElementById('edit-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmitEdited = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description || formData.category.length === 0) {
      setError('Please fill in all required fields: Name, Description, and at least one Category');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Check for duplicates before inserting
      const foundDuplicates = await checkDuplicates(formData.name, formData.provider_name, formData.category);

      if (foundDuplicates.length > 0) {
        console.log(`Found ${foundDuplicates.length} potential duplicates`);
        setDuplicates(foundDuplicates);
        setPendingSubmission({ type: 'edited', data: formData });
        setShowDuplicates(true);
        setSubmitting(false);
        return;
      }

      // Insert program
      const { data: insertedProgram, error: programError } = await supabase
        .from('programs')
        .insert([
          {
            name: formData.name,
            category: formData.category,
            description: formData.description,
            age_min: formData.age_min,
            age_max: formData.age_max,
            age_description: formData.age_description || null,
            price_min: formData.price_min,
            price_max: formData.price_max,
            price_unit: formData.price_unit || null,
            provider_name: formData.provider_name,
            provider_website: formData.provider_website || null,
            contact_email: formData.contact_email || null,
            contact_phone: formData.contact_phone || null,
            registration_url: formData.registration_url || null,
            re_enrollment_date: formData.re_enrollment_date || null,
            new_registration_date: formData.new_registration_date || null,
            status: 'active', // Auto-approved when created by admin
            google_place_id: editingPlace?.place_id || null,
            google_rating: editingPlace?.rating || null,
            google_review_count: editingPlace?.user_ratings_total || 0,
            program_type: formData.program_type,
            camp_season: formData.program_type === 'camp' ? formData.camp_season : null,
            camp_days_format: formData.program_type === 'camp' ? formData.camp_days_format : null,
          },
        ])
        .select()
        .single();

      if (programError) throw programError;

      // Insert location
      await supabase.from('program_locations').insert([
        {
          program_id: insertedProgram.id,
          name: null,
          address: formData.address,
          neighborhood: formData.neighborhood,
          latitude: formData.latitude,
          longitude: formData.longitude,
          is_primary: true,
        },
      ]);

      // Log the action
      await logAction({
        action: 'Search & Add',
        entityType: 'program',
        entityId: insertedProgram.id,
        entityName: formData.name,
        details: { action: 'added', categories: formData.category },
      });

      setSuccessMessage('Program created and approved!');

      // Remove from results
      if (editingPlace) {
        setResults(results.filter((r) => r.place_id !== editingPlace.place_id));
      }

      // Reset form
      setEditingPlace(null);
      setFormData({
        name: '',
        category: [],
        description: '',
        neighborhood: '',
        address: '',
        age_min: 0,
        age_max: 18,
        age_description: '',
        price_min: null,
        price_max: null,
        price_unit: 'per class',
        provider_name: '',
        provider_website: '',
        contact_email: '',
        contact_phone: '',
        registration_url: '',
        re_enrollment_date: '',
        new_registration_date: '',
        latitude: region.center_lat,
        longitude: region.center_lng,
        program_type: 'program',
        camp_season: null,
        camp_days_format: null,
      });
    } catch (err) {
      console.error('Error submitting program:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit program');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCategoryToggle = (category: string) => {
    setFormData({
      ...formData,
      category: formData.category.includes(category)
        ? formData.category.filter((c) => c !== category)
        : [...formData.category, category],
    });
  };

  const proceedWithSubmission = async () => {
    if (!pendingSubmission) return;

    console.log('Proceeding with submission despite duplicates:', pendingSubmission.type);
    setShowDuplicates(false);
    setSubmitting(true);
    setError('');

    try {
      if (pendingSubmission.type === 'direct') {
        // Handle direct approval (Quick Create)
        console.log('Processing direct approval...');
        const details = pendingSubmission.data;
        const addressParts = details.formatted_address.split(',');
        const neighborhood = addressParts.length > 2 ? addressParts[1].trim() : region.short_name;

        // Scrape website for additional info (email, description, etc.)
        let scrapedData: Awaited<ReturnType<typeof scrapeWebsiteForInfo>> = null;
        if (details.website) {
          console.log('Scraping website for additional info (after duplicate confirmation)...');
          scrapedData = await scrapeWebsiteForInfo(details.website);
        }

        const { data: insertedProgram, error: programError } = await supabase
          .from('programs')
          .insert([
            {
              name: details.name,
              category: bulkCategories,
              description: scrapedData?.description || details.name,
              age_min: 0,
              age_max: 18,
              age_description: null,
              price_min: scrapedData?.price_min || null,
              price_max: scrapedData?.price_max || null,
              price_unit: scrapedData?.price_unit || null,
              provider_name: details.name,
              provider_website: details.website || null,
              contact_email: scrapedData?.contact_email || null,
              contact_phone: scrapedData?.contact_phone || details.formatted_phone_number || null,
              registration_url: scrapedData?.registration_url || null,
              status: 'active', // Auto-approved when created by admin
              google_place_id: details.place_id,
              google_rating: details.rating || null,
              google_review_count: details.user_ratings_total || 0,
              google_reviews_url: details.place_id
                ? `https://search.google.com/local/reviews?placeid=${details.place_id}`
                : null,
              program_type: bulkProgramType,
              camp_season: bulkProgramType === 'camp' ? bulkCampSeason : null,
              camp_days_format: bulkProgramType === 'camp' ? bulkCampDaysFormat : null,
            },
          ])
          .select()
          .single();

        if (programError) throw programError;
        console.log('Program inserted (after duplicate confirmation):', insertedProgram.id);

        const { error: locationError } = await supabase.from('program_locations').insert([
          {
            program_id: insertedProgram.id,
            name: null,
            address: details.formatted_address,
            neighborhood: neighborhood,
            latitude: details.geometry.location.lat,
            longitude: details.geometry.location.lng,
            is_primary: true,
          },
        ]);

        if (locationError) {
          console.error('Location insert error:', locationError);
          throw locationError;
        }
        console.log('Location inserted (after duplicate confirmation)');

        // Mark as added in history
        await markPlaceAsAdded(details.place_id);

        // Log the action
        await logAction({
          action: 'Search & Add',
          entityType: 'program',
          entityId: insertedProgram.id,
          entityName: details.name,
          details: { action: 'added', categories: bulkCategories },
        });

        setSuccessMessage('Program created and approved!');
        setResults(results.filter((r) => r.place_id !== details.place_id));
      } else {
        // Handle edited submission (Edit & Create)
        console.log('Processing edited submission...');
        const data = pendingSubmission.data;

        const { data: insertedProgram, error: programError } = await supabase
          .from('programs')
          .insert([
            {
              name: data.name,
              category: data.category,
              description: data.description,
              age_min: data.age_min,
              age_max: data.age_max,
              age_description: data.age_description || null,
              price_min: data.price_min,
              price_max: data.price_max,
              price_unit: data.price_unit || null,
              provider_name: data.provider_name,
              provider_website: data.provider_website || null,
              contact_email: data.contact_email || null,
              contact_phone: data.contact_phone || null,
              registration_url: data.registration_url || null,
              re_enrollment_date: data.re_enrollment_date || null,
              new_registration_date: data.new_registration_date || null,
              status: 'active', // Auto-approved when created by admin
              google_place_id: editingPlace?.place_id || null,
              google_rating: editingPlace?.rating || null,
              google_review_count: editingPlace?.user_ratings_total || 0,
              program_type: data.program_type,
              camp_season: data.program_type === 'camp' ? data.camp_season : null,
              camp_days_format: data.program_type === 'camp' ? data.camp_days_format : null,
            },
          ])
          .select()
          .single();

        if (programError) throw programError;

        await supabase.from('program_locations').insert([
          {
            program_id: insertedProgram.id,
            name: null,
            address: data.address,
            neighborhood: data.neighborhood,
            latitude: data.latitude,
            longitude: data.longitude,
            is_primary: true,
          },
        ]);

        // Log the action
        await logAction({
          action: 'Search & Add',
          entityType: 'program',
          entityId: insertedProgram.id,
          entityName: data.name,
          details: { action: 'added', categories: data.category },
        });

        setSuccessMessage('Program created and approved!');

        if (editingPlace) {
          setResults(results.filter((r) => r.place_id !== editingPlace.place_id));
        }

        // Reset form
        setEditingPlace(null);
        setFormData({
          name: '',
          category: [],
          description: '',
          neighborhood: '',
          address: '',
          age_min: 0,
          age_max: 18,
          age_description: '',
          price_min: null,
          price_max: null,
          price_unit: 'per class',
          provider_name: '',
          provider_website: '',
          contact_email: '',
          contact_phone: '',
          registration_url: '',
          re_enrollment_date: '',
          new_registration_date: '',
          latitude: region.center_lat,
          longitude: region.center_lng,
          program_type: 'program',
          camp_season: null,
          camp_days_format: null,
        });
      }

      setPendingSubmission(null);
      setDuplicates([]);
    } catch (err) {
      console.error('Error submitting program:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit program');
    } finally {
      setSubmitting(false);
    }
  };

  // Open merge field selection modal
  const handleMergeIntoExisting = async (existingProgram: any) => {
    if (!pendingSubmission) return;

    const googleData = pendingSubmission.data;

    // Initialize field choices - default to 'google' for fields where google has data and existing doesn't
    const initialChoices: Record<string, 'existing' | 'google' | 'scraped'> = {};

    // For each mergeable field, set initial choice
    if (googleData.description || existingProgram.description) {
      initialChoices.description = existingProgram.description ? 'existing' : 'google';
    }
    if (googleData.provider_website || existingProgram.provider_website) {
      initialChoices.provider_website = existingProgram.provider_website ? 'existing' : 'google';
    }
    if (googleData.contact_email || existingProgram.contact_email) {
      initialChoices.contact_email = existingProgram.contact_email ? 'existing' : 'google';
    }
    if (googleData.contact_phone || existingProgram.contact_phone) {
      initialChoices.contact_phone = existingProgram.contact_phone ? 'existing' : 'google';
    }
    if (googleData.google_rating || existingProgram.google_rating) {
      initialChoices.google_rating = existingProgram.google_rating ? 'existing' : 'google';
    }

    setMergeTarget(existingProgram);
    setMergeFieldChoices(initialChoices);
    setScrapedData(null); // Reset scraped data
    setShowMergeFieldSelection(true);

    // Trigger website scraping if we have a website URL from Google
    const websiteUrl = googleData.provider_website || existingProgram.provider_website;
    if (websiteUrl) {
      setScrapingForMerge(true);
      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ websiteUrl, crawl: true, maxPages: 3, maxDepth: 1 }),
        });
        const result = await response.json();
        if (result.data && !result.error) {
          setScrapedData(result.data);
        }
      } catch (err) {
        console.error('Failed to scrape website for merge:', err);
      } finally {
        setScrapingForMerge(false);
      }
    }
  };

  // Execute the merge with selected field choices
  const executeMerge = async () => {
    if (!pendingSubmission || !mergeTarget) return;

    const googleData = pendingSubmission.data;
    const existingProgram = mergeTarget;

    setMerging(true);
    try {
      const updateData: Record<string, any> = {};

      // Helper to get value based on choice
      const getChosenValue = (field: string, _existingVal: any, googleVal: any, scrapedVal: any) => {
        const choice = mergeFieldChoices[field];
        if (choice === 'google') return googleVal;
        if (choice === 'scraped') return scrapedVal;
        return null; // 'existing' means no update needed
      };

      // Apply field choices
      const descChoice = getChosenValue('description', existingProgram.description, googleData.description, scrapedData?.description);
      if (descChoice) updateData.description = descChoice;

      const websiteChoice = getChosenValue('provider_website', existingProgram.provider_website, googleData.provider_website, scrapedData?.provider_website);
      if (websiteChoice) updateData.provider_website = websiteChoice;

      const emailChoice = getChosenValue('contact_email', existingProgram.contact_email, googleData.contact_email, scrapedData?.contact_email);
      if (emailChoice) updateData.contact_email = emailChoice;

      const phoneChoice = getChosenValue('contact_phone', existingProgram.contact_phone, googleData.contact_phone, scrapedData?.contact_phone);
      if (phoneChoice) updateData.contact_phone = phoneChoice;

      if (mergeFieldChoices.google_rating === 'google' && googleData.google_rating) {
        updateData.google_rating = googleData.google_rating;
        updateData.google_review_count = googleData.google_review_count || 0;
      }

      // Always update google_place_id if missing
      if (!existingProgram.google_place_id && googleData.google_place_id) {
        updateData.google_place_id = googleData.google_place_id;
      }

      // Merge categories (add any new categories)
      if (googleData.category?.length > 0) {
        const existingCats = new Set(existingProgram.category || []);
        const newCats = googleData.category.filter((c: string) => !existingCats.has(c));
        if (newCats.length > 0) {
          updateData.category = [...(existingProgram.category || []), ...newCats];
        }
      }

      // Update the existing program if there's anything to update
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('programs')
          .update(updateData)
          .eq('id', existingProgram.id);

        if (updateError) throw updateError;
      }

      // Mark the place as added in history
      if (googleData.place_id) {
        await markPlaceAsAdded(googleData.place_id);
      }

      // Log the merge action
      await logAction({
        action: 'Search & Add',
        entityType: 'program',
        entityId: existingProgram.id,
        entityName: existingProgram.name,
        details: { action: 'merged', mergedFrom: googleData.name, updatedFields: Object.keys(updateData) },
      });

      alert(`✅ Merged into "${existingProgram.name}" successfully!${Object.keys(updateData).length > 0 ? `\nUpdated fields: ${Object.keys(updateData).join(', ')}` : '\nNo new data to update.'}`);

      // Remove from results if it's in the search results
      if (pendingSubmission.type === 'direct' && googleData.place_id) {
        setResults(results.filter((r) => r.place_id !== googleData.place_id));
      } else if (editingPlace) {
        setResults(results.filter((r) => r.place_id !== editingPlace.place_id));
        setEditingPlace(null);
      }

      // Close modals
      setShowMergeFieldSelection(false);
      setMergeTarget(null);
      setShowDuplicates(false);
      setPendingSubmission(null);
      setDuplicates([]);
    } catch (err) {
      console.error('Error merging program:', err);
      setError(err instanceof Error ? err.message : 'Failed to merge program');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Search & Add Programs</h1>
          <p className="text-gray-600">
            Search Google Places for programs and approve them to add to the database.{' '}
            <Link href="/admin/review" className="text-primary-600 hover:underline">
              Review Pending
            </Link>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/review" className="btn-primary">
            Review Pending →
          </Link>
          <Link href="/admin" className="btn-secondary">
            ← Back to Admin
          </Link>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Search Google Places</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            {showHistory ? '← Back to Search' : 'View History →'}
          </button>
        </div>

        {!showHistory ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={`e.g., swimming lessons ${region.short_name}`}
                className="input-field flex-1"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
            {/* Search Mode Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Fetch:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSearchMode('first20')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'first20'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1-20
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('all60')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    searchMode === 'all60'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  1-60 (All)
                </button>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-500">After search, load more:</span>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded bg-gray-50 text-xs text-gray-600 border border-gray-200">21-40</span>
                <span className="px-2 py-1 rounded bg-gray-50 text-xs text-gray-600 border border-gray-200">21-60</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              View all places found through Google Places API searches
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setHistoryFilter('not_added')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  historyFilter === 'not_added'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Not Added Yet
              </button>
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  historyFilter === 'all'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All History
              </button>
            </div>
            <HistoryDisplay filter={historyFilter} onAddPlace={(place) => {
              // Convert history record to GooglePlace format and add to results
              setResults([{
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
                rating: place.rating ?? undefined,
                user_ratings_total: place.user_ratings_total,
                types: place.place_types
              }]);
              setShowHistory(false);
            }} />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/programs" className="text-green-700 font-medium hover:underline">
              View Programs →
            </Link>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Category Selection Section - Always visible when there are results */}
      {results.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            {selectedPlaceIds.size > 0 ? `Bulk Create (${selectedPlaceIds.size} selected)` : 'Quick Create Settings'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {selectedPlaceIds.size > 0
              ? 'Select categories for all selected programs, then click "Create" below'
              : 'Select categories first, then use "Quick Create" on individual results'}
          </p>

          {/* Program Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Type *
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setBulkProgramType('program');
                  setBulkCampSeason(null);
                  setBulkCampDaysFormat(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  bulkProgramType === 'program'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                📚 Program
              </button>
              <button
                type="button"
                onClick={() => setBulkProgramType('camp')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  bulkProgramType === 'camp'
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🏕️ Camp
              </button>
            </div>
          </div>

          {/* Camp-specific fields */}
          {bulkProgramType === 'camp' && (
            <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Season
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'summer', label: '☀️ Summer' },
                      { value: 'spring', label: '🌸 Spring' },
                      { value: 'fall', label: '🍂 Fall' },
                      { value: 'winter', label: '❄️ Winter' },
                    ].map((season) => (
                      <button
                        key={season.value}
                        type="button"
                        onClick={() => setBulkCampSeason(season.value as any)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          bulkCampSeason === season.value
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        {season.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Days Format
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'daily', label: '📆 Daily Drop-in' },
                      { value: 'weekly', label: '📅 Week-by-Week' },
                    ].map((format) => (
                      <button
                        key={format.value}
                        type="button"
                        onClick={() => setBulkCampDaysFormat(format.value as any)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          bulkCampDaysFormat === format.value
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-700 hover:bg-orange-100 border border-orange-200'
                        }`}
                      >
                        {format.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categories {selectedPlaceIds.size > 0 ? 'for Selected Programs' : 'for Quick Create'} *
            </label>
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat: string) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleBulkCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    bulkCategories.includes(cat)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
              {/* Add custom category */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Add category..."
                  className="px-2 py-1 text-sm border border-gray-300 rounded-full w-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCategory();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomCategory}
                  className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  +
                </button>
              </div>
            </div>
            {bulkCategories.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠️ Please select at least one category to enable Quick Create
              </p>
            )}
          </div>

          {/* Bulk Create Progress Bar */}
          {bulkApproving && bulkProgress.total > 0 && (
            <div className="mb-4 bg-white rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium text-blue-900">Creating programs...</span>
                </div>
                <span className="text-blue-700 font-medium">
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-600">Progress: {bulkProgress.current}/{bulkProgress.total}</span>
                <span className="text-green-600">Created: {bulkProgress.success}</span>
                <span className="text-amber-600">Skipped: {bulkProgress.skipped}</span>
                <span className="text-red-600">Failed: {bulkProgress.failed}</span>
              </div>
              {bulkProgress.currentProgram && (
                <div className="mt-2 text-sm text-blue-700">
                  Currently processing: <span className="font-medium">{bulkProgress.currentProgram}</span>
                </div>
              )}
            </div>
          )}

          {selectedPlaceIds.size > 0 && (
            <div className="flex gap-3">
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproving || bulkCategories.length === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkApproving ? `Creating ${bulkProgress.current}/${bulkProgress.total}...` : `Create ${selectedPlaceIds.size} Programs`}
              </button>
              <button
                onClick={() => {
                  setSelectedPlaceIds(new Set());
                }}
                className="btn-secondary"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Search Results ({results.length})
            </h2>
            <div className="flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    viewMode === 'table'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    viewMode === 'cards'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cards
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPlaceIds.size === results.length && results.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded text-primary-600 focus:ring-primary-500 h-5 w-5"
                />
                <span className="text-sm font-medium text-gray-700">Select All</span>
              </label>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={selectedPlaceIds.size === results.length && results.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Types
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((place) => {
                    const displayTypes = (place.types || [])
                      .filter(t => !['point_of_interest', 'establishment', 'geocode', 'premise'].includes(t))
                      .slice(0, 2)
                      .map(t => t.replace(/_/g, ' '));

                    return (
                      <tr key={place.place_id} className={`hover:bg-gray-50 ${selectedPlaceIds.has(place.place_id) ? 'bg-primary-50' : ''}`}>
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedPlaceIds.has(place.place_id)}
                            onChange={() => toggleSelectPlace(place.place_id)}
                            className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate" title={place.name}>
                            {place.name}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm text-gray-600 max-w-[250px] truncate" title={place.formatted_address}>
                            {place.formatted_address}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {place.rating ? (
                            <div className="flex items-center gap-1">
                              <span className="text-yellow-500">⭐</span>
                              <span className="font-medium">{place.rating}</span>
                              <span className="text-gray-400 text-xs">({place.user_ratings_total})</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {displayTypes.map(type => (
                              <span key={type} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                                {type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApproveDirectly(place)}
                              disabled={submitting || bulkCategories.length === 0}
                              className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={bulkCategories.length === 0 ? 'Select categories first' : 'Quick Create'}
                            >
                              ✓ Create
                            </button>
                            <button
                              onClick={() => handleEditThenApprove(place)}
                              disabled={submitting}
                              className="px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards View */}
          {viewMode === 'cards' && (
            <div className="space-y-4">
              {results.map((place) => (
                <SearchResultCard
                  key={place.place_id}
                  place={place}
                  isSelected={selectedPlaceIds.has(place.place_id)}
                  onToggleSelect={() => toggleSelectPlace(place.place_id)}
                  onQuickApprove={() => handleApproveDirectly(place)}
                  onEditApprove={() => handleEditThenApprove(place)}
                  submitting={submitting}
                  fetchPlaceDetails={fetchPlaceDetails}
                />
              ))}
            </div>
          )}

          {/* Pagination - Load More */}
          {nextPageToken && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="text-sm text-gray-600 mb-2">
                Currently showing: <span className="font-semibold text-gray-800">1-{results.length}</span>
                <span className="ml-2 text-gray-400">(Page {currentPage} of 3)</span>
              </div>

              {loadingMore ? (
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></span>
                  Loading more results...
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* Load next 20 button */}
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="btn-primary px-5 py-2.5"
                  >
                    Load {currentPage === 1 ? '21-40' : '41-60'}
                  </button>

                  {/* Load all remaining button (only show on page 1) */}
                  {currentPage === 1 && (
                    <button
                      onClick={handleLoadAllRemaining}
                      disabled={loadingMore}
                      className="btn-secondary px-5 py-2.5"
                    >
                      Load All (21-60)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No more results indicator */}
          {results.length > 0 && !nextPageToken && results.length >= 20 && (
            <div className="mt-6 text-center text-sm text-gray-500">
              All available results loaded: <span className="font-medium text-gray-700">1-{results.length}</span> ({results.length} total)
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      {editingPlace && (
        <div id="edit-form" className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Edit Program Details
          </h2>

          <form onSubmit={handleSubmitEdited} className="space-y-6">
            {/* Program Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type *
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, program_type: 'program', camp_season: null, camp_days_format: null })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.program_type === 'program'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📚 Program
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, program_type: 'camp' })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    formData.program_type === 'camp'
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🏕️ Camp
                </button>
              </div>
            </div>

            {/* Camp-specific fields */}
            {formData.program_type === 'camp' && (
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Season
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'summer', label: '☀️ Summer' },
                        { value: 'spring', label: '🌸 Spring' },
                        { value: 'fall', label: '🍂 Fall' },
                        { value: 'winter', label: '❄️ Winter' },
                      ].map((season) => (
                        <button
                          key={season.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, camp_season: season.value as any })}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.camp_season === season.value
                              ? 'bg-amber-500 text-white'
                              : 'bg-white text-gray-700 hover:bg-amber-100 border border-amber-200'
                          }`}
                        >
                          {season.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Days Format
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'daily', label: '📆 Daily Drop-in' },
                        { value: 'weekly', label: '📅 Week-by-Week' },
                      ].map((format) => (
                        <button
                          key={format.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, camp_days_format: format.value as any })}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            formData.camp_days_format === format.value
                              ? 'bg-orange-500 text-white'
                              : 'bg-white text-gray-700 hover:bg-orange-100 border border-orange-200'
                          }`}
                        >
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Program Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {formData.program_type === 'camp' ? 'Camp Name' : 'Program Name'} *
              </label>
              <input
                type="text"
                className="input-field w-full"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Category * (select at least one)
              </label>
              <div className="flex flex-wrap gap-2">
                {allCategories.map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryToggle(cat)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      formData.category.includes(cat)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {/* Add custom category */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Add category..."
                    className="px-2 py-1 text-sm border border-gray-300 rounded-full w-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                className="input-field w-full"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Neighborhood
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>
            </div>

            {/* Age Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Min Age
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={formData.age_min}
                  onChange={(e) => setFormData({ ...formData, age_min: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Age
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={formData.age_max}
                  onChange={(e) => setFormData({ ...formData, age_max: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Price */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Min
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={formData.price_min || ''}
                  onChange={(e) => setFormData({ ...formData, price_min: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Price Max
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={formData.price_max || ''}
                  onChange={(e) => setFormData({ ...formData, price_max: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={formData.price_unit}
                  onChange={(e) => setFormData({ ...formData, price_unit: e.target.value })}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  className="input-field w-full"
                  value={formData.provider_website}
                  onChange={(e) => setFormData({ ...formData, provider_website: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  className="input-field w-full"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? 'Creating...' : formData.program_type === 'camp' ? 'Create Camp' : 'Create Program'}
              </button>
              <button
                type="button"
                onClick={() => setEditingPlace(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicates && pendingSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ⚠️ Potential Duplicates Found
              </h2>
              <p className="text-gray-600 mb-6">
                We found {duplicates.length} existing program(s) that might be similar.
                You can merge into an existing program or create as new.
              </p>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* New Program (Left) */}
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">NEW</span>
                    <span className="text-sm text-green-700">From Google Places</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {pendingSubmission.data.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Provider: {pendingSubmission.data.provider_name || pendingSubmission.data.name}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(pendingSubmission.data.category || bulkCategories)?.map((cat: string) => (
                      <span
                        key={cat}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-3">
                    {pendingSubmission.data.description || 'No description available'}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    {pendingSubmission.data.address && (
                      <p>📍 {pendingSubmission.data.address}</p>
                    )}
                    {pendingSubmission.data.google_rating && (
                      <p>⭐ {pendingSubmission.data.google_rating} ({pendingSubmission.data.google_review_count || 0} reviews)</p>
                    )}
                  </div>
                  <button
                    onClick={proceedWithSubmission}
                    disabled={submitting || merging}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create as New Program'}
                  </button>
                </div>

                {/* Existing Duplicates (Right) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">EXISTING</span>
                    <span className="text-sm text-blue-700">Programs in database</span>
                  </div>
                  {duplicates.map((program) => (
                    <div
                      key={program.id}
                      className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 hover:border-blue-400 transition-colors"
                    >
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {program.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Provider: {program.provider_name}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {program.category?.map((cat: string) => (
                          <span
                            key={cat}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {program.description}
                      </p>
                      <div className="text-xs text-gray-500 space-y-1 mb-3">
                        {program.google_rating && (
                          <p>⭐ {program.google_rating} ({program.google_review_count || 0} reviews)</p>
                        )}
                        <p>Status: <span className={`font-medium ${program.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>{program.status}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMergeIntoExisting(program)}
                          disabled={submitting || merging}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {merging ? 'Merging...' : '🔗 Merge Into This'}
                        </button>
                        <a
                          href={`/admin/edit/${program.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 rounded-lg text-sm"
                        >
                          Edit →
                        </a>
                        <a
                          href={`/programs/${program.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-3 rounded-lg text-sm"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowDuplicates(false);
                    setPendingSubmission(null);
                    setDuplicates([]);
                  }}
                  disabled={submitting || merging}
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Field Selection Modal */}
      {showMergeFieldSelection && mergeTarget && pendingSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                🔗 Choose Fields to Merge
              </h2>
              <p className="text-gray-600 mb-2">
                Select which value to use for each field. Click on the value you want to keep.
              </p>
              {scrapingForMerge && (
                <p className="text-amber-600 text-sm mb-4">
                  ⏳ Scraping website for additional data...
                </p>
              )}

              {/* Column Headers */}
              <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 mb-4 text-sm font-semibold">
                <div></div>
                <div className="text-blue-600 p-2">📁 Existing</div>
                <div className="text-green-600 p-2">🔍 Google</div>
                <div className="text-purple-600 p-2">🌐 Website Scrape {scrapingForMerge && '(loading...)'}</div>
              </div>

              <div className="space-y-3">
                {/* Description */}
                {(pendingSubmission.data.description || mergeTarget.description || scrapedData?.description) && (
                  <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 items-stretch">
                    <div className="text-sm font-medium text-gray-700 py-2">Description</div>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, description: 'existing' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.description === 'existing'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600 line-clamp-3">{mergeTarget.description || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, description: 'google' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.description === 'google'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600 line-clamp-3">{pendingSubmission.data.description || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, description: 'scraped' }))}
                      disabled={!scrapedData?.description}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.description === 'scraped'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!scrapedData?.description ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-gray-600 line-clamp-3">{scrapedData?.description || '(empty)'}</div>
                    </button>
                  </div>
                )}

                {/* Phone */}
                {(pendingSubmission.data.contact_phone || mergeTarget.contact_phone || scrapedData?.contact_phone) && (
                  <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 items-stretch">
                    <div className="text-sm font-medium text-gray-700 py-2">Phone</div>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_phone: 'existing' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_phone === 'existing'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">{mergeTarget.contact_phone || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_phone: 'google' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_phone === 'google'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">{pendingSubmission.data.contact_phone || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_phone: 'scraped' }))}
                      disabled={!scrapedData?.contact_phone}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_phone === 'scraped'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!scrapedData?.contact_phone ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-gray-600">{scrapedData?.contact_phone || '(empty)'}</div>
                    </button>
                  </div>
                )}

                {/* Email */}
                {(pendingSubmission.data.contact_email || mergeTarget.contact_email || scrapedData?.contact_email) && (
                  <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 items-stretch">
                    <div className="text-sm font-medium text-gray-700 py-2">Email</div>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_email: 'existing' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_email === 'existing'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">{mergeTarget.contact_email || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_email: 'google' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_email === 'google'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">{pendingSubmission.data.contact_email || '(empty)'}</div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, contact_email: 'scraped' }))}
                      disabled={!scrapedData?.contact_email}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.contact_email === 'scraped'
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${!scrapedData?.contact_email ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-gray-600">{scrapedData?.contact_email || '(empty)'}</div>
                    </button>
                  </div>
                )}

                {/* Google Rating - Only existing and google */}
                {(pendingSubmission.data.google_rating || mergeTarget.google_rating) && (
                  <div className="grid grid-cols-[120px_1fr_1fr_1fr] gap-2 items-stretch">
                    <div className="text-sm font-medium text-gray-700 py-2">Google Rating</div>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, google_rating: 'existing' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.google_rating === 'existing'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">
                        {mergeTarget.google_rating ? `⭐ ${mergeTarget.google_rating} (${mergeTarget.google_review_count || 0})` : '(empty)'}
                      </div>
                    </button>
                    <button
                      onClick={() => setMergeFieldChoices(prev => ({ ...prev, google_rating: 'google' }))}
                      className={`p-2 rounded-lg border-2 text-left text-xs transition-all ${
                        mergeFieldChoices.google_rating === 'google'
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-gray-600">
                        {pendingSubmission.data.google_rating ? `⭐ ${pendingSubmission.data.google_rating} (${pendingSubmission.data.google_review_count || 0})` : '(empty)'}
                      </div>
                    </button>
                    <div className="p-2 rounded-lg border-2 border-gray-100 bg-gray-50 text-xs text-gray-400">
                      N/A
                    </div>
                  </div>
                )}

              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
                <button
                  onClick={() => {
                    setShowMergeFieldSelection(false);
                    setMergeTarget(null);
                  }}
                  disabled={merging}
                  className="btn-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeMerge}
                  disabled={merging}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg disabled:opacity-50"
                >
                  {merging ? 'Merging...' : 'Merge Selected Fields'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
