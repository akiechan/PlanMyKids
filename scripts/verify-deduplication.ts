import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Camp {
  id: string;
  name: string;
  google_rating: number | null;
  google_review_count: number | null;
  description: string;
  price_min: number | null;
  age_min: number | null;
}

// Same deduplication logic as in the frontend
function deduplicateByName(camps: Camp[]): Camp[] {
  const seen = new Map<string, Camp>();

  for (const camp of camps) {
    const normalizedName = camp.name.toLowerCase().trim();
    const existing = seen.get(normalizedName);

    if (!existing) {
      seen.set(normalizedName, camp);
      continue;
    }

    const existingScore = getDataQualityScore(existing);
    const newScore = getDataQualityScore(camp);

    if (newScore > existingScore) {
      seen.set(normalizedName, camp);
    }
  }

  return Array.from(seen.values());
}

function getDataQualityScore(camp: Camp): number {
  let score = 0;
  if (camp.google_rating) score += camp.google_rating * 10;
  if (camp.google_review_count) score += Math.min(camp.google_review_count, 100);
  if (camp.description && camp.description.length > 50) score += 20;
  if (camp.price_min != null) score += 10;
  if (camp.age_min != null) score += 10;
  return score;
}

async function verifyDeduplication() {
  // Fetch camps the same way the frontend does
  const { data: camps, error } = await supabase
    .from('programs')
    .select('id, name, google_rating, google_review_count, description, price_min, age_min')
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .is('merged_into', null)
    .order('google_rating', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n=== Deduplication Verification ===\n`);
  console.log(`Total camps from database: ${camps?.length || 0}`);

  const deduplicated = deduplicateByName(camps || []);
  console.log(`After deduplication: ${deduplicated.length}`);
  console.log(`Duplicates removed: ${(camps?.length || 0) - deduplicated.length}`);

  // Verify specific camps that had duplicates
  const testCamps = ['4ft and Up Kitchen', 'ABADA-Capoeira San Francisco', 'Messy Art Lab'];

  console.log(`\n=== Verification of known duplicates ===`);
  for (const name of testCamps) {
    const matches = deduplicated.filter(c => c.name.toLowerCase() === name.toLowerCase());
    console.log(`"${name}": ${matches.length} entry (expected: 1)`);
  }

  // Check for any remaining duplicates
  const nameCount = new Map<string, number>();
  for (const camp of deduplicated) {
    const normalized = camp.name.toLowerCase().trim();
    nameCount.set(normalized, (nameCount.get(normalized) || 0) + 1);
  }

  const remainingDuplicates = [...nameCount.entries()].filter(([_, count]) => count > 1);
  if (remainingDuplicates.length > 0) {
    console.log(`\n⚠️ WARNING: Still have ${remainingDuplicates.length} duplicates after deduplication!`);
    remainingDuplicates.forEach(([name, count]) => {
      console.log(`  "${name}": ${count} entries`);
    });
  } else {
    console.log(`\n✅ SUCCESS: No duplicates after deduplication!`);
  }
}

verifyDeduplication();
