import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, crawl = true, maxPages = 5, maxDepth = 1 } = await request.json();

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`Starting Playwright scraper for: ${websiteUrl} (crawl=${crawl}, maxPages=${maxPages}, maxDepth=${maxDepth})`);

    // Run Python Playwright scraper with crawling options
    const scraperPath = path.join(process.cwd(), 'scraper', 'scrape_program.py');
    const crawlFlag = crawl ? '' : '--no-crawl';
    const command = `python3 "${scraperPath}" "${websiteUrl}" --max-pages ${maxPages} --max-depth ${maxDepth} ${crawlFlag}`;

    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 120 second timeout (increased for crawling)
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Log stderr (progress messages) for debugging
    if (stderr) {
      console.log('Scraper progress:', stderr);
    }

    // Parse JSON output from stdout
    const scrapedData = JSON.parse(stdout);

    if (scrapedData.error) {
      throw new Error(scrapedData.error);
    }

    return NextResponse.json({ data: scrapedData });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to scrape website',
      },
      { status: 500 }
    );
  }
}
