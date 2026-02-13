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

    // Validate URL
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`Scraping with Playwright: ${websiteUrl}`);

    // Path to Python scraper (use simple version - no Playwright needed)
    const scraperPath = path.join(process.cwd(), 'scraper', 'scrape_simple.py');
    console.log(`Scraper path: ${scraperPath}`);
    console.log(`Working directory: ${process.cwd()}`);

    // Run Python scraper
    const command = `python3 "${scraperPath}" "${websiteUrl}"`;
    console.log(`Running command: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 60000, // 60 second timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    console.log('Raw stdout:', stdout);
    console.log('Raw stderr:', stderr);

    if (stderr && !stderr.includes('Warning')) {
      console.error('Scraper stderr (non-warning):', stderr);
    }

    const data = JSON.parse(stdout);

    if (data.error) {
      throw new Error(data.error);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to scrape website',
        details: 'Make sure Python 3 and Playwright are installed. Run: cd scraper && pip3 install -r requirements.txt && python3 -m playwright install chromium'
      },
      { status: 500 }
    );
  }
}
