#!/usr/bin/env python3
"""
Batch scraper for all provider websites in the database.
Crawls each provider website to find registration URLs and dates,
then updates the database with the found information.
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime
from supabase import create_client, Client

# Import the scraper
from scrape_program import ProgramScraper


def get_supabase_client() -> Client:
    """Create Supabase client from environment variables"""
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not key:
        raise Exception("Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    return create_client(url, key)


def get_providers_to_scrape(supabase: Client, limit: int = None) -> list:
    """Get all providers with websites from the database"""
    query = supabase.table("programs").select(
        "id, name, provider_name, provider_website, registration_url, re_enrollment_date, new_registration_date"
    ).not_.is_("provider_website", "null")

    if limit:
        query = query.limit(limit)

    response = query.execute()
    return response.data


def update_program(supabase: Client, program_id: str, updates: dict) -> bool:
    """Update a program in the database"""
    try:
        supabase.table("programs").update(updates).eq("id", program_id).execute()
        return True
    except Exception as e:
        print(f"Error updating program {program_id}: {e}", file=sys.stderr)
        return False


def scrape_provider(provider: dict, max_pages: int = 10, max_depth: int = 2) -> dict:
    """Scrape a single provider website"""
    website = provider.get("provider_website")
    if not website:
        return None

    # Ensure URL has protocol
    if not website.startswith("http"):
        website = f"https://{website}"

    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Scraping: {provider.get('provider_name', 'Unknown')}", file=sys.stderr)
    print(f"Website: {website}", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)

    try:
        scraper = ProgramScraper(
            url=website,
            max_pages=max_pages,
            max_depth=max_depth
        )
        result = scraper.scrape(crawl=True)

        return {
            "registration_url": result.get("registration_url"),
            "re_enrollment_date": result.get("re_enrollment_date"),
            "new_registration_date": result.get("new_registration_date"),
            "crawled_pages": result.get("crawled_pages", []),
        }

    except Exception as e:
        print(f"Error scraping {website}: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description='Scrape all provider websites in the database for registration info'
    )
    parser.add_argument('--limit', type=int, default=None,
                        help='Limit number of providers to scrape')
    parser.add_argument('--max-pages', type=int, default=10,
                        help='Maximum pages to crawl per provider (default: 10)')
    parser.add_argument('--max-depth', type=int, default=2,
                        help='Maximum crawl depth per provider (default: 2)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Do not update database, just show what would be updated')
    parser.add_argument('--delay', type=float, default=2.0,
                        help='Delay between providers in seconds (default: 2)')
    parser.add_argument('--only-missing', action='store_true',
                        help='Only scrape providers missing registration info')

    args = parser.parse_args()

    # Load environment variables from .env.local if it exists
    env_file = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_file):
        print(f"Loading environment from {env_file}", file=sys.stderr)
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

    try:
        supabase = get_supabase_client()
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}", file=sys.stderr)
        sys.exit(1)

    # Get providers to scrape
    providers = get_providers_to_scrape(supabase, args.limit)
    print(f"\nFound {len(providers)} providers with websites", file=sys.stderr)

    # Filter to only missing if requested
    if args.only_missing:
        providers = [
            p for p in providers
            if not p.get("registration_url") or not p.get("re_enrollment_date") or not p.get("new_registration_date")
        ]
        print(f"Filtered to {len(providers)} providers missing registration info", file=sys.stderr)

    results = {
        "total": len(providers),
        "scraped": 0,
        "updated": 0,
        "failed": 0,
        "providers": []
    }

    for i, provider in enumerate(providers):
        print(f"\nProgress: {i+1}/{len(providers)}", file=sys.stderr)

        scraped = scrape_provider(
            provider,
            max_pages=args.max_pages,
            max_depth=args.max_depth
        )

        if scraped:
            results["scraped"] += 1

            # Prepare updates (only update if we found new info)
            updates = {}
            if scraped.get("registration_url") and not provider.get("registration_url"):
                updates["registration_url"] = scraped["registration_url"]
            if scraped.get("re_enrollment_date") and not provider.get("re_enrollment_date"):
                updates["re_enrollment_date"] = scraped["re_enrollment_date"]
            if scraped.get("new_registration_date") and not provider.get("new_registration_date"):
                updates["new_registration_date"] = scraped["new_registration_date"]

            provider_result = {
                "id": provider["id"],
                "name": provider.get("provider_name"),
                "website": provider.get("provider_website"),
                "found": scraped,
                "updates": updates if updates else None
            }
            results["providers"].append(provider_result)

            if updates:
                if args.dry_run:
                    print(f"Would update: {json.dumps(updates)}", file=sys.stderr)
                else:
                    if update_program(supabase, provider["id"], updates):
                        results["updated"] += 1
                        print(f"Updated: {json.dumps(updates)}", file=sys.stderr)
        else:
            results["failed"] += 1
            results["providers"].append({
                "id": provider["id"],
                "name": provider.get("provider_name"),
                "website": provider.get("provider_website"),
                "error": "Scraping failed"
            })

        # Delay between providers to be respectful
        if i < len(providers) - 1:
            time.sleep(args.delay)

    # Print summary
    print(f"\n{'='*60}", file=sys.stderr)
    print("SUMMARY", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)
    print(f"Total providers: {results['total']}", file=sys.stderr)
    print(f"Successfully scraped: {results['scraped']}", file=sys.stderr)
    print(f"Database updated: {results['updated']}", file=sys.stderr)
    print(f"Failed: {results['failed']}", file=sys.stderr)

    # Output full results as JSON
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
