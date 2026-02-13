#!/usr/bin/env python3
"""
Simple Program Website Scraper using requests + BeautifulSoup
No browser automation needed - faster and more reliable for static sites
"""

import json
import re
import sys
import ssl
import requests
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

# Custom SSL context for LibreSSL compatibility
class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = create_urllib3_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = context
        return super().init_poolmanager(*args, **kwargs)


class SimpleProgramScraper:
    def __init__(self, url: str):
        self.url = url
        self.domain = urlparse(url).netloc
        self.data = {
            "name": "",
            "description": "",
            "category": [],
            "address": "",
            "neighborhood": "",
            "contact_email": None,
            "contact_phone": None,
            "schedule": "",
            "price_type": "recurring",
            "price": None,
            "price_unit": None
        }

    def check_robots_txt(self) -> bool:
        """Check if scraping is allowed by robots.txt"""
        try:
            rp = RobotFileParser()
            rp.set_url(f"https://{self.domain}/robots.txt")
            rp.read()
            return rp.can_fetch("*", self.url)
        except Exception as e:
            print(f"Warning: Could not check robots.txt: {e}", file=sys.stderr)
            return True

    def scrape(self) -> dict:
        """Main scraping method"""
        # Check robots.txt
        try:
            if not self.check_robots_txt():
                print(f"Warning: robots.txt disallows scraping {self.url}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: robots.txt check failed: {e}", file=sys.stderr)

        print(f"Scraping: {self.url}", file=sys.stderr)

        try:
            # Fetch page with realistic headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }

            print("Fetching page...", file=sys.stderr)

            # Create session with SSL adapter for LibreSSL compatibility
            session = requests.Session()
            session.mount('https://', SSLContextAdapter())

            response = session.get(self.url, headers=headers, timeout=30)
            response.raise_for_status()

            # Parse HTML
            print("Parsing HTML...", file=sys.stderr)
            soup = BeautifulSoup(response.text, 'html.parser')
            text = soup.get_text(separator=' ', strip=True)

            # Extract data
            print("Extracting data...", file=sys.stderr)
            self._extract_name(soup, text)
            self._extract_description(soup, text)
            self._extract_contact_info(soup, text)
            self._extract_address(text)
            self._extract_schedule(text)
            self._extract_pricing(text)
            self._extract_categories(text)

            print("Scraping completed successfully!", file=sys.stderr)
            return self.data

        except requests.RequestException as e:
            raise Exception(f"Failed to fetch page: {str(e)}")
        except Exception as e:
            raise Exception(f"Scraping failed: {str(e)}")

    def _extract_name(self, soup: BeautifulSoup, text: str):
        """Extract program/organization name"""
        # Try meta tags
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            self.data["name"] = og_title["content"].strip()
            return

        # Try title
        title = soup.find("title")
        if title:
            name = title.text.strip()
            name = re.sub(r'\s*[\|\-]\s*(Home|Welcome|About).*$', '', name, flags=re.IGNORECASE)
            self.data["name"] = name.strip()
            return

        # Try h1
        h1 = soup.find("h1")
        if h1:
            self.data["name"] = h1.text.strip()

    def _extract_description(self, soup: BeautifulSoup, text: str):
        """Extract program description"""
        # Try meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            self.data["description"] = meta_desc["content"].strip()
            return

        # Try og:description
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            self.data["description"] = og_desc["content"].strip()
            return

        # Get first few paragraphs
        paragraphs = soup.find_all("p")
        if paragraphs:
            desc = " ".join([p.text.strip() for p in paragraphs[:3] if len(p.text.strip()) > 20])
            self.data["description"] = desc[:500] if desc else "Program information available on website."

    def _extract_contact_info(self, soup: BeautifulSoup, text: str):
        """Extract email and phone"""
        # Email
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        if emails:
            filtered = [e for e in emails if not any(x in e.lower() for x in ['noreply', 'example', 'test'])]
            if filtered:
                self.data["contact_email"] = filtered[0]

        # Phone (US format)
        phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phones = re.findall(phone_pattern, text)
        if phones:
            self.data["contact_phone"] = phones[0]

    def _extract_address(self, text: str):
        """Extract address and neighborhood"""
        # SF addresses
        sf_pattern = r'\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way),?\s*(?:San Francisco|SF),?\s*CA'
        addresses = re.findall(sf_pattern, text, re.IGNORECASE)
        if addresses:
            self.data["address"] = addresses[0]
            self._infer_neighborhood(addresses[0])
        else:
            self.data["address"] = "San Francisco, CA"
            self.data["neighborhood"] = "San Francisco"

    def _infer_neighborhood(self, address: str):
        """Infer SF neighborhood from address"""
        neighborhoods = {
            "Marina District": ["marina", "chestnut", "lombard"],
            "Mission District": ["mission", "valencia", "24th", "16th"],
            "SOMA": ["townsend", "folsom", "howard", "2nd", "3rd"],
            "Richmond District": ["geary", "clement"],
            "Sunset District": ["judah", "noriega", "taraval"],
            "Noe Valley": ["24th", "castro", "noe"],
            "Castro": ["castro", "market", "18th"],
        }

        address_lower = address.lower()
        for neighborhood, keywords in neighborhoods.items():
            if any(keyword in address_lower for keyword in keywords):
                self.data["neighborhood"] = neighborhood
                return
        self.data["neighborhood"] = "San Francisco"

    def _extract_schedule(self, text: str):
        """Extract schedule"""
        schedule_patterns = [
            r'((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s/&]+)+\s*\d+:\d+',
        ]

        for pattern in schedule_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                self.data["schedule"] = matches[0][:200]
                return
        self.data["schedule"] = "Contact for schedule information"

    def _extract_pricing(self, text: str):
        """Extract pricing"""
        if re.search(r'\bfree\b', text, re.IGNORECASE):
            self.data["price_type"] = "free"
            self.data["price"] = 0
            return

        price_pattern = r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per|/|each)?\s*(month|session|class|week)?'
        matches = re.findall(price_pattern, text, re.IGNORECASE)

        if matches:
            price_str = matches[0][0].replace(',', '')
            self.data["price"] = float(price_str)
            if matches[0][1]:
                unit = matches[0][1].lower()
                self.data["price_unit"] = f"per {unit}"
                self.data["price_type"] = "recurring" if unit in ['month', 'week'] else "one-time"

    def _extract_categories(self, text: str):
        """Infer categories"""
        category_keywords = {
            "swimming": ["swim", "aquatic", "water", "pool"],
            "art": ["art", "painting", "drawing"],
            "music": ["music", "piano", "guitar"],
            "sports": ["sports", "athletic"],
            "technology": ["coding", "programming", "tech"],
            "academic": ["tutoring", "academic"],
        }

        text_lower = text.lower()
        categories = []
        for category, keywords in category_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                categories.append(category)

        self.data["category"] = categories[:3] if categories else ["creative"]


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python3 scrape_simple.py <url>"}))
        sys.exit(1)

    url = sys.argv[1]

    try:
        scraper = SimpleProgramScraper(url)
        result = scraper.scrape()
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
