'use client';

import Link from 'next/link';
import { Program, ProgramLocation } from '@/types/database';
import CompareButton from './CompareButton';
import SaveButton from './SaveButton';
import { useAuth } from '@/contexts/AuthContext';

interface CampCardProps {
  program: Program & {
    program_locations?: ProgramLocation[];
  };
}

const SEASON_LABELS: Record<string, string> = {
  summer: 'Summer',
  spring: 'Spring',
  fall: 'Fall',
  winter: 'Winter',
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

export default function CampCard({ program }: CampCardProps) {
  const { user } = useAuth();
  const hasPrice = program.price_min != null || program.price_max != null;

  const displayPrice = () => {
    if (program.price_min === 0 && (program.price_max === 0 || program.price_max == null)) {
      return <span className="text-green-600 font-semibold">Free</span>;
    }
    if (program.price_min == null && program.price_max == null) {
      return <span className="text-gray-500">Contact for pricing</span>;
    }
    const priceStr = program.price_min != null && program.price_max != null && program.price_min !== program.price_max
      ? `$${program.price_min} - $${program.price_max}`
      : `$${program.price_min ?? program.price_max}`;
    return (
      <span className="text-gray-900 font-semibold">
        {priceStr}{program.price_unit && ` ${program.price_unit}`}
      </span>
    );
  };

  const isFeatured = program.is_featured;
  const season = program.camp_season;

  return (
    <Link href={`/camps/${program.id}`}>
      <div className={`card overflow-hidden h-full flex flex-col relative ${
        isFeatured ? 'ring-2 ring-amber-400 shadow-lg' : ''
      }`}>
        {/* Show Save button for logged in users (goes to family planner), Compare button for others */}
        {user ? (
          <SaveButton program={program} variant="card" />
        ) : (
          <CompareButton program={program} variant="card" />
        )}

        {/* Featured Badge */}
        {isFeatured && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
            <span>⭐</span> Featured
          </div>
        )}

        {/* Season Badge - only show for non-summer seasons (spring/fall/winter break camps) */}
        {!isFeatured && season && season !== 'summer' && (
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-green-700 text-xs font-semibold px-2 py-1 rounded-full shadow-sm border border-green-200">
            <span>{SEASON_EMOJI[season]}</span> {SEASON_LABELS[season]}
          </div>
        )}

        {/* Category Banner - Green for camps, Yellow for featured */}
        <div className={`h-3 bg-gradient-to-r ${
          isFeatured
            ? 'from-amber-500 to-yellow-500'
            : 'from-green-500 to-emerald-500'
        }`} />

        {/* Content - responsive padding */}
        <div className="p-4 sm:p-6 flex-1 flex flex-col">
          {/* Categories/Tags */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
            {program.camp_days_format && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600">
                {program.camp_days_format === 'weekly' ? '📅 Week-by-Week' : '📆 Daily'}
              </span>
            )}
            {program.category.slice(0, 1).map((cat) => (
              <span
                key={cat}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Title - responsive text size */}
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1.5 sm:mb-2 line-clamp-2">
            {program.name}
          </h3>

          {/* Description */}
          <p className="text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2 flex-1">
            {program.description}
          </p>

          {/* Details */}
          <div className="space-y-2 text-sm">
            {program.program_locations && program.program_locations.length > 0 && (
              <div className="flex items-start text-gray-700">
                <span className="mr-2 mt-0.5">📍</span>
                <div className="flex-1">
                  <div className="font-medium">{program.program_locations[0].neighborhood}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{program.program_locations[0].address}</div>
                </div>
              </div>
            )}

            {/* Age Range */}
            {(program.age_min != null || program.age_max != null) && (
              <div className="flex items-center text-gray-700">
                <span className="mr-2">👶</span>
                <span className="font-medium">
                  {program.age_min != null && program.age_max != null
                    ? `Ages ${program.age_min} - ${program.age_max}`
                    : program.age_min != null
                    ? `Ages ${program.age_min}+`
                    : `Up to age ${program.age_max}`}
                </span>
              </div>
            )}

            {/* Hours */}
            {(program.hours_start || program.before_care || program.after_care) && (
              <div className="flex items-start text-gray-700">
                <span className="mr-2 mt-0.5">🕐</span>
                <div className="flex-1">
                  {program.hours_start && program.hours_end && (
                    <div className="font-medium">
                      {formatTime(program.hours_start)} - {formatTime(program.hours_end)}
                    </div>
                  )}
                  {(program.before_care || program.after_care) && (
                    <div className="text-xs text-gray-500 flex flex-wrap gap-1.5 mt-0.5">
                      {program.before_care && (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          Before {program.before_care_start ? formatTime(program.before_care_start) : '✓'}
                        </span>
                      )}
                      {program.after_care && (
                        <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                          After {program.after_care_end ? formatTime(program.after_care_end) : '✓'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {hasPrice ? (
                  <>
                    <span className="mr-2">💰</span>
                    {displayPrice()}
                  </>
                ) : program.provider_website ? (
                  <>
                    <span className="mr-2">🌐</span>
                    <span
                      className="text-green-600 hover:text-green-700 text-sm truncate max-w-[150px]"
                      onClick={(e) => {
                        e.preventDefault();
                        const url = program.provider_website!.startsWith('http')
                          ? program.provider_website!
                          : `https://${program.provider_website}`;
                        window.open(url, '_blank');
                      }}
                    >
                      {program.provider_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mr-2">💰</span>
                    <span className="text-gray-500">Contact for pricing</span>
                  </>
                )}
              </div>
              <div className="flex items-center">
                <span className={program.google_rating ? "text-yellow-500 mr-1" : "text-gray-400 mr-1"}>⭐</span>
                <span className={program.google_rating ? "font-medium" : "font-medium text-gray-400"}>
                  {program.google_rating || '0'}
                </span>
                <span className="text-gray-500 ml-1">
                  ({program.google_review_count || 0})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
