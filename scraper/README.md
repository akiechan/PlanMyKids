# Program Website Scraper

Python-based web scraper using Playwright to extract enrichment program information from provider websites.

## Features

✅ Respects robots.txt
✅ Human-like delays to avoid rate limiting
✅ Extracts: name, description, contact info, address, age range, schedule, pricing
✅ Automatically categorizes programs
✅ Outputs JSON matching the app's data schema

## Setup

### 1. Install Python Dependencies

```bash
cd scraper
pip3 install -r requirements.txt
```

### 2. Install Playwright Browsers

```bash
python3 -m playwright install chromium
```

## Usage

### Standalone CLI

```bash
python3 scrape_program.py "https://example.com/program"
```

**Output:**
```json
{
  "name": "Program Name",
  "description": "Program description...",
  "category": ["swimming", "sports"],
  "address": "123 Main St, San Francisco, CA",
  "neighborhood": "Marina District",
  "contact_email": "info@example.com",
  "contact_phone": "(415) 555-0123",
  "age_min": 5,
  "age_max": 12,
  "schedule": "Mon/Wed 4-5pm",
  "price_type": "recurring",
  "price": 150.0,
  "price_unit": "per month"
}
```

### Integration with Next.js

Create a new API route that calls the Python scraper:

**File:** `app/api/scrape-playwright/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl } = await request.json();

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    // Path to Python scraper
    const scraperPath = path.join(process.cwd(), 'scraper', 'scrape_program.py');

    // Run Python scraper
    const { stdout, stderr } = await execAsync(
      `python3 ${scraperPath} "${websiteUrl}"`,
      { timeout: 60000 } // 60 second timeout
    );

    if (stderr) {
      console.error('Scraper stderr:', stderr);
    }

    const data = JSON.parse(stdout);

    if (data.error) {
      throw new Error(data.error);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape website' },
      { status: 500 }
    );
  }
}
```

## How It Works

### 1. Robots.txt Check
Before scraping, checks if the site allows bots via `robots.txt`

### 2. Browser Automation
Uses Playwright to:
- Launch headless Chromium browser
- Use realistic user agent
- Wait for page to fully load
- Handle JavaScript-heavy sites

### 3. Data Extraction

**Name:** Extracts from:
- Open Graph meta tags
- Page title
- H1 headings

**Description:** Extracts from:
- Meta description
- About sections
- First paragraphs

**Contact Info:**
- Email: Regex pattern matching
- Phone: US phone format detection

**Address:**
- Looks for SF address patterns
- Infers neighborhood from street names

**Age Range:**
- Detects "ages 5-12" patterns
- Recognizes "K-6th grade"
- Defaults to 5-18 if not found

**Schedule:**
- Finds day/time patterns
- Extracts class meeting times

**Pricing:**
- Detects "free" keyword
- Finds $XX.XX patterns
- Identifies recurring vs one-time

**Categories:**
- Keyword matching for activity types
- Assigns up to 3 categories

### 4. Human-Like Behavior
- Random delays (1-3 seconds)
- Realistic user agent
- Waits for network idle

## Testing

Test with real SF program websites:

```bash
# Swimming program
python3 scrape_program.py "https://www.baaquaticscenter.org/"

# Music program
python3 scrape_program.py "https://sfcm.edu/prep"

# Art program
python3 scrape_program.py "https://childrenscreativity.org/"
```

## Troubleshooting

**"robots.txt disallows scraping"**
- Website blocks bots
- Try a different site or contact the provider

**"Page load timeout"**
- Website is slow or down
- Increase timeout in code
- Check your internet connection

**"Module 'playwright' not found"**
- Run: `pip3 install -r requirements.txt`
- Run: `python3 -m playwright install chromium`

## Advantages Over Gemini AI

✅ **More reliable** - Doesn't depend on AI API limits
✅ **Better accuracy** - Direct HTML parsing vs AI interpretation
✅ **Free** - No API costs
✅ **Handles JS sites** - Playwright executes JavaScript
✅ **More control** - Can customize extraction logic

## Limitations

⚠️ **Slower** - Takes 5-10 seconds per scrape (vs 2-3 for Gemini)
⚠️ **Requires Python** - Additional dependency
⚠️ **Site-specific** - May need tweaking for unusual site structures
⚠️ **Blocks** - Some sites actively block scraping

## Production Deployment

For Vercel/serverless deployment:

1. **Use serverless function with longer timeout**
2. **Consider using a scraping service** (ScraperAPI, Bright Data)
3. **Cache results** to avoid repeated scraping
4. **Rate limit** scraping requests

## License

MIT
