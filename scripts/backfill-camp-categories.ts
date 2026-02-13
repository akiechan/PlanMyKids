/**
 * One-time script to backfill categories for all camps that have empty categories.
 * Uses keyword matching on name + description to assign categories.
 *
 * Usage: npx tsx scripts/backfill-camp-categories.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const dryRun = process.argv.includes('--dry-run');

// Keywords that need word-boundary matching (short words that appear as substrings)
// These use regex \b...\b to avoid "lab" matching "available", "stem" matching "system", etc.
const WORD_BOUNDARY_KEYWORDS = new Set([
  'lab', 'stem', 'steam', 'sail', 'art', 'arts', 'foil', 'film', 'zoo',
]);

// Broad category keyword map
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Sports - specific
  'soccer': ['soccer', 'fútbol', 'futbol'],
  'baseball': ['baseball', 'softball'],
  'basketball': ['basketball'],
  'tennis': ['tennis'],
  'golf': ['golf camp', 'first tee'],
  'fencing': ['fencing', 'fencer', 'épée', 'epee'],
  'gymnastics': ['gymnastics', 'gymnast', 'tumbling'],
  'swimming': ['swim', 'aquatic', 'water polo'],
  'sailing': ['sailing', 'sail camp', 'yacht'],
  'skateboarding': ['skateboard', 'skate camp', 'sk8', 'rollerskating', 'rollerblading'],
  'climbing': ['climbing camp', 'bouldering'],
  'cycling': ['bicycle', 'cycling', 'bike camp'],
  'volleyball': ['volleyball'],
  'football': ['football camp'],
  // Sports - general
  'sports': ['sports camp', 'athletic camp', 'all-day sport'],

  // Arts - specific
  'visual-arts': ['art camp', 'painting', 'drawing', 'sculpture', 'fine art', 'watercolor', 'acrylic', 'art &', 'art and', 'messy art', 'creative art', 'art studio', 'art class', 'art project', 'art workshop', 'arts education'],
  'ceramics': ['ceramic', 'pottery', 'clay camp', 'wheelhouse'],
  'sewing': ['sewing', 'fashion camp', 'textile'],
  'woodworking': ['woodworking', 'woodshop', 'tinkering', 'building experience'],
  'photography': ['photography', 'photo camp'],
  'music': ['music', 'piano', 'guitar', 'violin', 'instrument', 'rock band', 'rockstar', 'band camp', 'singing'],
  'dance': ['dance', 'ballet', 'hip hop', 'choreograph', 'movement arts'],
  'theater': ['theater', 'theatre', 'musical theater', 'musical theatre', 'drama camp', 'shakespeare', 'acting', 'improv'],
  'circus': ['circus', 'acrobat', 'aerial arts', 'aerial dance', 'trapeze', 'clown'],
  'film': ['film camp', 'video production', 'animation camp'],

  // Academic & STEM
  'coding': ['coding', 'programming', 'computer science', 'python', 'javascript', 'app development', 'coder school', 'learn to code'],
  'technology': ['tech camp', 'robotics', 'techrevolution', 'id tech', 'techknow', 'icamp'],
  'science': ['science', 'stem', 'steam', 'engineering camp', 'physics', 'chemistry', 'lab camp', 'experiment'],
  'math': ['math camp', 'math circle', 'mathnasium'],

  // Nature & Outdoor
  'outdoor': ['outdoor', 'nature camp', 'nature ', 'naturebridge', 'forest camp', 'forest ', 'hiking', 'adventure camp', 'garden camp', 'farm camp', 'coyote', 'earth discovery', 'botanical', 'roughin it', 'in the outdoors'],
  'animals': ['zoo camp', 'animal camp', 'sf zoo'],

  // Specialty
  'cooking': ['cooking', 'culinary', 'kitchen camp', 'chef camp'],
  'martial-arts': ['martial art', 'karate', 'taekwondo', 'judo', 'kung fu', 'capoeira'],
  'yoga': ['yoga camp', 'yoga kids', 'yoga &', 'yoga and'],
  'games': ['board game', 'tabletop', 'card game', 'bowling', 'spy camp', 'secret agent'],
  'trampoline': ['trampoline'],
  'sup': ['paddleboard', 'paddle camp', 'sup camp'],

  // Language immersion
  'language-immersion': ['immersion', 'french camp', 'français', 'francais', 'spanish camp', 'spanish immersion', 'mandarin', 'cantonese', 'german camp', 'italian camp', 'bilingual camp'],

  // General / enrichment
  'enrichment': ['enrichment', 'multi-activity', 'variety of activities'],
};

function matchesKeyword(text: string, keyword: string): boolean {
  if (WORD_BOUNDARY_KEYWORDS.has(keyword)) {
    return new RegExp(`\\b${keyword}\\b`).test(text);
  }
  return text.includes(keyword);
}

function categorize(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const matched: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => matchesKeyword(text, kw))) {
      matched.push(category);
    }
  }

  if (matched.length === 0) {
    matched.push('general');
  }

  return matched.slice(0, 5); // Cap at 5 categories
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE RUN ===');

  // Fetch all active camps with empty or null categories
  const { data: camps, error } = await supabase
    .from('programs')
    .select('id, name, description, category')
    .eq('program_type', 'camp')
    .eq('status', 'active')
    .is('merged_into', null);

  if (error) {
    console.error('Error fetching camps:', error);
    process.exit(1);
  }

  const needsUpdate = (camps || []).filter(c => !c.category || c.category.length === 0);
  console.log(`Total active camps: ${camps?.length}`);
  console.log(`Camps needing categories: ${needsUpdate.length}\n`);

  // Collect stats
  const categoryStats: Record<string, number> = {};
  const updates: { id: string; name: string; categories: string[] }[] = [];

  for (const camp of needsUpdate) {
    const categories = categorize(camp.name, camp.description || '');
    updates.push({ id: camp.id, name: camp.name, categories });

    for (const cat of categories) {
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    }
  }

  // Print preview
  console.log('--- Category assignments ---');
  for (const u of updates) {
    console.log(`  ${u.name}: [${u.categories.join(', ')}]`);
  }

  console.log('\n--- Category distribution ---');
  const sorted = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sorted) {
    console.log(`  ${cat}: ${count}`);
  }

  if (dryRun) {
    console.log('\n=== DRY RUN — no changes written ===');
    return;
  }

  // Apply updates
  console.log(`\nApplying ${updates.length} updates...`);
  let successCount = 0;
  let errorCount = 0;

  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('programs')
      .update({ category: u.categories })
      .eq('id', u.id);

    if (updateError) {
      console.error(`  ERROR updating ${u.name}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nDone! ${successCount} updated, ${errorCount} errors.`);
}

main();
