import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { programIds } = await request.json();

    if (!programIds || !Array.isArray(programIds) || programIds.length === 0) {
      return NextResponse.json(
        { error: 'Program IDs are required' },
        { status: 400 }
      );
    }

    // Fetch programs with existing enrichment data to skip already-enriched ones
    const { data: programs, error: fetchError } = await supabase
      .from('programs')
      .select('id, name, provider_name, google_place_id, google_rating, locations:program_locations(address)')
      .in('id', programIds);

    if (fetchError) throw fetchError;

    if (!programs || programs.length === 0) {
      return NextResponse.json(
        { error: 'No programs found' },
        { status: 404 }
      );
    }

    const results = [];

    for (const program of programs) {
      try {
        // Skip if already enriched with Google data
        if (program.google_place_id && program.google_rating) {
          results.push({
            programId: program.id,
            programName: program.name,
            status: 'skipped',
            message: 'Already enriched with Google data',
          });
          continue;
        }

        const searchQuery = `${program.provider_name} ${program.locations?.[0]?.address || ''}`;

        // Find place by text search
        const searchResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
        );
        const searchData = await searchResponse.json();

        if (!searchData.results || searchData.results.length === 0) {
          throw new Error('Place not found on Google Maps');
        }

        const place = searchData.results[0];
        const placeId = place.place_id;

        // Get place details including reviews
        const detailsResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,url&key=${process.env.GOOGLE_PLACES_API_KEY}`
        );
        const detailsData = await detailsResponse.json();

        if (detailsData.status !== 'OK') {
          throw new Error(`Google Places API error: ${detailsData.status}`);
        }

        const placeDetails = detailsData.result;

        // Use real data from Google Places API
        const googleData = {
          place_id: placeId,
          rating: placeDetails.rating?.toString() || '0',
          user_ratings_total: placeDetails.user_ratings_total || 0,
          url: placeDetails.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}&query_place_id=${placeId}`,
          reviews: placeDetails.reviews || [],
        };

        // Update program with Google data
        const { error: updateError } = await supabase
          .from('programs')
          .update({
            google_place_id: googleData.place_id,
            google_reviews_url: googleData.url,
            google_rating: parseFloat(googleData.rating),
            google_review_count: googleData.user_ratings_total,
          })
          .eq('id', program.id);

        if (updateError) throw updateError;

        // Check for existing reviews to avoid duplicates
        const { data: existingReviews } = await supabase
          .from('reviews')
          .select('reviewer_name, comment')
          .eq('program_id', program.id)
          .eq('source', 'google');

        const existingReviewKeys = new Set(
          (existingReviews || []).map(r => `${r.reviewer_name}::${r.comment?.slice(0, 50)}`)
        );

        // Only insert new reviews (dedup by reviewer_name + comment prefix)
        const reviewsToInsert = googleData.reviews
          .map((review: any) => ({
            program_id: program.id,
            reviewer_name: review.author_name,
            reviewer_email: 'google-review@placeholder.com',
            rating: review.rating,
            comment: review.text,
            status: 'approved',
            source: 'google',
            review_url: googleData.url,
          }))
          .filter((review: any) => {
            const key = `${review.reviewer_name}::${review.comment?.slice(0, 50)}`;
            return !existingReviewKeys.has(key);
          });

        let reviewsImported = 0;
        if (reviewsToInsert.length > 0) {
          const { error: reviewsError } = await supabase
            .from('reviews')
            .insert(reviewsToInsert);

          if (reviewsError) {
            console.error('Error inserting reviews:', reviewsError);
          } else {
            reviewsImported = reviewsToInsert.length;
          }
        }

        results.push({
          programId: program.id,
          programName: program.name,
          searchQuery,
          status: 'success',
          rating: googleData.rating,
          reviewCount: googleData.user_ratings_total,
          reviewsImported,
          message: `Retrieved ${googleData.reviews.length} reviews, imported ${reviewsImported} new`,
        });
      } catch (err) {
        console.error(`Error processing program ${program.id}:`, err);
        results.push({
          programId: program.id,
          programName: program.name,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.length} program(s). ${results.filter(r => r.status === 'success').length} enriched, ${results.filter(r => r.status === 'skipped').length} skipped (already enriched).`,
    });
  } catch (error) {
    console.error('Error in google-reviews API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/*
NOTES:
- This API uses the Google Places Text Search and Place Details APIs
- Requires GOOGLE_PLACES_API_KEY in .env.local
- Text Search finds the place by provider name + address
- Place Details fetches rating, review count, and up to 5 most helpful reviews
- Reviews are automatically saved to the database with 'approved' status
- Programs already enriched (with google_place_id + google_rating) are skipped
- Reviews are deduplicated by reviewer_name + comment prefix
*/
