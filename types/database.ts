export type ProgramStatus = 'active' | 'inactive' | 'pending' | 'rejected';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ProgramType = 'program' | 'camp' | 'birthday_venue' | 'league';
export type CampSeason = 'summer' | 'spring' | 'fall' | 'winter';
export type CampDaysFormat = 'daily' | 'weekly'; // Individual days vs week-by-week
export type LeagueSeason = 'spring' | 'summer' | 'fall' | 'winter' | 'year-round';
export type VenueType = 'indoor' | 'outdoor' | 'both';

export interface HoursPerDay {
  [key: string]: { open: string; close: string } | undefined;
}

export interface ProgramLocation {
  id: string;
  program_id: string;
  name: string | null; // Optional name like "Main Campus"
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  created_at: string;
  is_primary: boolean;
  region_id: string;
}

export interface Program {
  id: string;
  name: string;
  category: string[];
  description: string;

  // Type (program or camp)
  program_type: ProgramType;

  // Camp-specific fields
  camp_season: CampSeason | null; // summer, spring, fall, winter
  camp_days_format: CampDaysFormat | null; // daily or weekly

  // Before/After Care
  before_care: boolean;
  before_care_start: string | null; // Time format: "HH:MM"
  after_care: boolean;
  after_care_end: string | null; // Time format: "HH:MM"

  // Age range
  age_min: number | null;
  age_max: number | null;

  // Hours (e.g., "9:00" to "15:00")
  hours_start: string | null;
  hours_end: string | null;

  // Operating days (e.g., ["monday", "tuesday", ...])
  operating_days: string[] | null;

  // Logistics
  start_date: string | null;
  end_date: string | null;

  // Pricing (price range support)
  price_min: number | null;
  price_max: number | null;
  price_unit: string | null;

  // Provider
  provider_name: string | null;

  // Contact
  contact_email: string | null;
  contact_phone: string | null;
  provider_website: string | null; // Program or organization website

  // Metadata
  created_at: string;
  updated_at: string;
  status: ProgramStatus;
  merged_into: string | null; // If merged, references the target program ID
  is_featured: boolean; // Featured programs appear at top with special styling

  // Registration
  registration_url: string | null;
  re_enrollment_date: string | null; // DATE format: 'YYYY-MM-DD' - for current students
  new_registration_date: string | null; // DATE format: 'YYYY-MM-DD' - for new students

  // Google Reviews
  google_place_id: string | null;
  google_reviews_url: string | null;
  google_rating: number | null;
  google_review_count: number;

  // Locations (joined data)
  locations?: ProgramLocation[];
}

export interface Review {
  id: string;
  program_id: string;
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  comment: string;
  created_at: string;
  status: ReviewStatus;
  source: string; // 'user', 'google', 'yelp', etc.
  review_url: string | null; // Link to original review on external platform
}

export interface ProgramWithReviews extends Program {
  reviews: Review[];
}

export interface SearchFilters {
  query?: string;
  category?: string[];
  neighborhood?: string[];
  minRating?: number;
  // Price range filtering
  priceMin?: number;
  priceMax?: number;
  // Location-based filtering
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
}

export interface ProgramNearby extends Program {
  distance_meters: number;
  distance_km: number;
  closest_location?: ProgramLocation;
}

// Child table: Camp-specific details
export interface CampDetails {
  id: string;
  program_id: string;
  season: CampSeason | null;
  days_format: CampDaysFormat | null;
  before_care: boolean;
  before_care_start: string | null;
  after_care: boolean;
  after_care_end: string | null;
  created_at: string;
}

// Child table: Birthday venue details
export interface BirthdayVenueDetails {
  id: string;
  program_id: string;
  venue_capacity: number | null;
  min_party_size: number | null;
  max_party_size: number | null;
  venue_type: VenueType | null;
  package_options: { name: string; price: number; description: string; includes: string[] }[];
  catering_available: boolean;
  decorations_included: boolean;
  created_at: string;
}

// Child table: League details
export interface LeagueDetails {
  id: string;
  program_id: string;
  sport: string | null;
  season: LeagueSeason | null;
  division: string | null;
  team_size: number | null;
  game_schedule: { day: string; time: string; location: string }[];
  practices_per_week: number | null;
  season_length_weeks: number | null;
  registration_deadline: string | null;
  created_at: string;
}

// Program with child table data
export interface ProgramWithDetails extends Program {
  camp_details?: CampDetails;
  birthday_venue_details?: BirthdayVenueDetails;
  league_details?: LeagueDetails;
}

// Tags reference table
export interface Tag {
  id: string;
  name: string;
  tag_type: 'category' | 'amenity' | 'sport' | 'feature';
  display_name: string;
  created_at: string;
}

// Neighborhoods reference table
export interface Neighborhood {
  id: string;
  name: string;
  aliases: string[];
  street_patterns: string[];
  city: string;
  state: string;
  is_canonical: boolean;
  canonical_id: string | null;
  region_id: string;
  created_at: string;
}

// Regions table
export interface Region {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  center_lat: number;
  center_lng: number;
  default_zoom: number;
  is_active: boolean;
  created_at: string;
}

// Program Edit Requests
export interface ProgramEditRequest {
  id: string;
  program_id: string;
  status: 'pending' | 'approved' | 'rejected';
  edited_data: Program; // Full program data with user edits
  submitted_by_email?: string;
  submitted_by_name?: string;
  edit_notes?: string;
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}
