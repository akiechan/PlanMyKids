// Registration info extraction (no AI dependency)

// Re-export type for backward compatibility
export type { ScrapedProviderData } from '@/types/scraper';

// Extract registration dates from HTML without using AI
export function extractRegistrationInfo(html: string, baseUrl: string): { registration_url: string | null; re_enrollment_date: string | null; new_registration_date: string | null } {
  // Strip HTML tags for text search but keep original for URL extraction
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Keywords that indicate registration-related content
  const registrationKeywords = [
    'registration', 'register', 'enroll', 'enrollment', 'sign up', 'signup',
    'session starts', 'session begins', 'camp starts', 'classes begin',
    'deadline', 'opens', 'closes', 'starts', 'begins'
  ];

  // Date patterns to match
  const datePatterns = [
    // January 15, 2025 or Jan 15, 2025
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/gi,
    // 01/15/2025 or 1/15/2025
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    // 2025-01-15
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    // January 15 or Jan 15 (current year assumed)
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/gi,
  ];

  const monthMap: Record<string, string> = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12',
  };

  let foundDate: string | null = null;
  const currentYear = new Date().getFullYear();
  const today = new Date();

  // Find dates near registration keywords
  for (const keyword of registrationKeywords) {
    const keywordIndex = textContent.toLowerCase().indexOf(keyword);
    if (keywordIndex === -1) continue;

    // Get context around the keyword (200 chars before and after)
    const start = Math.max(0, keywordIndex - 200);
    const end = Math.min(textContent.length, keywordIndex + keyword.length + 200);
    const context = textContent.substring(start, end);

    // Try each date pattern
    for (const pattern of datePatterns) {
      pattern.lastIndex = 0; // Reset regex
      let match;
      while ((match = pattern.exec(context)) !== null) {
        let dateStr: string | null = null;

        if (match[0].includes('/')) {
          // MM/DD/YYYY format
          const [, month, day, year] = match;
          dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else if (match[0].includes('-') && match[1].length === 4) {
          // YYYY-MM-DD format
          dateStr = match[0];
        } else if (match[3] && match[3].length === 4) {
          // Month DD, YYYY format
          const month = monthMap[match[1].toLowerCase()];
          const day = match[2].padStart(2, '0');
          dateStr = `${match[3]}-${month}-${day}`;
        } else if (match[1] && match[2] && !match[3]) {
          // Month DD format (assume current or next year)
          const month = monthMap[match[1].toLowerCase()];
          const day = match[2].padStart(2, '0');
          const testDate = new Date(`${currentYear}-${month}-${day}`);
          const year = testDate < today ? currentYear + 1 : currentYear;
          dateStr = `${year}-${month}-${day}`;
        }

        if (dateStr) {
          const parsedDate = new Date(dateStr);
          // Only consider future dates
          if (parsedDate >= today) {
            if (!foundDate || parsedDate < new Date(foundDate)) {
              foundDate = dateStr;
            }
          }
        }
      }
    }

    if (foundDate) break; // Stop after finding first date near a keyword
  }

  // Extract registration URL
  let registrationUrl: string | null = null;
  const urlPatterns = [
    /href=["']([^"']*(?:register|enroll|signup|sign-up)[^"']*)["']/gi,
    /href=["']([^"']*\/registration[^"']*)["']/gi,
  ];

  for (const pattern of urlPatterns) {
    const match = pattern.exec(html);
    if (match) {
      let url = match[1];
      // Make relative URLs absolute
      if (url.startsWith('/')) {
        try {
          const base = new URL(baseUrl);
          url = `${base.origin}${url}`;
        } catch {
          // Keep relative URL if base URL is invalid
        }
      } else if (!url.startsWith('http')) {
        url = `${baseUrl.replace(/\/$/, '')}/${url}`;
      }
      registrationUrl = url;
      break;
    }
  }

  return {
    registration_url: registrationUrl,
    re_enrollment_date: null, // Non-AI extraction doesn't distinguish between date types
    new_registration_date: foundDate,
  };
}
