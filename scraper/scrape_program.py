#!/usr/bin/env python3
"""
Program Website Scraper using Playwright
Extracts enrichment program information from provider websites
Supports full site crawling to find registration URLs and dates
"""

import json
import re
import sys
import time
import random
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup
from collections import deque


class ProgramScraper:
    def __init__(self, url: str, max_pages: int = 10, max_depth: int = 2, region_city: str = "San Francisco"):
        self.url = url
        self.domain = urlparse(url).netloc
        self.base_url = f"{urlparse(url).scheme}://{self.domain}"
        self.max_pages = max_pages  # Maximum number of pages to crawl
        self.max_depth = max_depth  # Maximum crawl depth from starting page
        self.region_city = region_city  # City name for address matching
        self.visited_urls = set()
        self.pages_crawled = 0
        self.data = {
            "name": "",
            "description": "",
            "category": [],
            "address": "",
            "neighborhood": "",
            "contact_email": None,
            "contact_phone": None,
            "operating_days": [],
            "hours_per_day": {},
            "price_min": None,
            "price_max": None,
            "price_unit": None,
            "price_description": None,
            "registration_url": None,
            "re_enrollment_date": None,
            "new_registration_date": None,
            "crawled_pages": []  # Track which pages were crawled
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
            return True  # Proceed with caution if robots.txt unavailable

    def human_delay(self, min_seconds: float = 1.0, max_seconds: float = 3.0):
        """Add human-like random delay"""
        time.sleep(random.uniform(min_seconds, max_seconds))

    def _normalize_url(self, url: str) -> str:
        """Normalize URL by removing fragments and trailing slashes"""
        parsed = urlparse(url)
        # Remove fragment and normalize path
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
        if parsed.query:
            normalized += f"?{parsed.query}"
        return normalized

    def _is_same_domain(self, url: str) -> bool:
        """Check if URL belongs to the same domain"""
        parsed = urlparse(url)
        return parsed.netloc == self.domain or parsed.netloc == ""

    def _is_valid_page_url(self, url: str) -> bool:
        """Check if URL is a valid page to crawl (not a file, mailto, etc.)"""
        if not url:
            return False

        # Skip non-http protocols
        if url.startswith(('mailto:', 'tel:', 'javascript:', 'data:', '#')):
            return False

        # Skip common file extensions
        skip_extensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js',
                          '.zip', '.doc', '.docx', '.xls', '.xlsx', '.mp3', '.mp4', '.avi']
        url_lower = url.lower()
        if any(url_lower.endswith(ext) for ext in skip_extensions):
            return False

        return True

    def _extract_internal_links(self, soup: BeautifulSoup, current_url: str) -> list:
        """Extract all internal links from a page"""
        links = []

        for anchor in soup.find_all('a', href=True):
            href = anchor.get('href', '').strip()

            if not self._is_valid_page_url(href):
                continue

            # Convert relative URLs to absolute
            if href.startswith('/'):
                full_url = f"{self.base_url}{href}"
            elif href.startswith('http'):
                full_url = href
            elif not href.startswith(('mailto:', 'tel:', 'javascript:')):
                full_url = urljoin(current_url, href)
            else:
                continue

            # Only include same-domain links
            if self._is_same_domain(full_url):
                normalized = self._normalize_url(full_url)
                if normalized not in self.visited_urls:
                    links.append(normalized)

        return list(set(links))  # Remove duplicates

    def _is_registration_related(self, url: str, link_text: str = "") -> bool:
        """Check if a URL is likely related to registration"""
        registration_keywords = [
            'register', 'registration', 'enroll', 'enrollment', 'sign-up', 'signup',
            'classes', 'schedule', 'programs', 'sessions', 'calendar', 'book', 'booking'
        ]

        url_lower = url.lower()
        text_lower = link_text.lower()

        return any(kw in url_lower or kw in text_lower for kw in registration_keywords)

    def _prioritize_links(self, links: list, soup: BeautifulSoup) -> list:
        """Prioritize registration-related links to crawl first"""
        registration_links = []
        other_links = []

        # Create a map of URLs to their link text
        link_texts = {}
        for anchor in soup.find_all('a', href=True):
            href = anchor.get('href', '').strip()
            text = anchor.get_text().strip()
            if href.startswith('/'):
                full_url = f"{self.base_url}{href}"
            elif href.startswith('http'):
                full_url = href
            else:
                full_url = urljoin(self.url, href)
            normalized = self._normalize_url(full_url)
            link_texts[normalized] = text

        for link in links:
            link_text = link_texts.get(link, "")
            if self._is_registration_related(link, link_text):
                registration_links.append(link)
            else:
                other_links.append(link)

        return registration_links + other_links

    def _crawl_page(self, page, url: str, depth: int = 0) -> tuple:
        """Crawl a single page and return its content and discovered links"""
        if url in self.visited_urls:
            return None, None, []

        if self.pages_crawled >= self.max_pages:
            return None, None, []

        if depth > self.max_depth:
            return None, None, []

        self.visited_urls.add(url)
        self.pages_crawled += 1

        try:
            print(f"Crawling ({self.pages_crawled}/{self.max_pages}): {url}", file=sys.stderr)
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            self.human_delay(0.5, 1.5)

            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeout:
                pass

            html = page.content()
            text = page.inner_text("body")
            soup = BeautifulSoup(html, 'html.parser')

            # Extract and prioritize links
            links = self._extract_internal_links(soup, url)
            prioritized_links = self._prioritize_links(links, soup)

            self.data["crawled_pages"].append(url)

            return soup, text, prioritized_links

        except Exception as e:
            print(f"Error crawling {url}: {e}", file=sys.stderr)
            return None, None, []

    def scrape(self, crawl: bool = True) -> dict:
        """
        Main scraping method

        Args:
            crawl: If True, crawl the entire site. If False, only scrape the main page.
        """
        # Check robots.txt (but don't fail if check fails)
        try:
            if not self.check_robots_txt():
                print(f"Warning: robots.txt disallows scraping {self.url}", file=sys.stderr)
                # Continue anyway for educational/testing purposes
        except Exception as e:
            print(f"Warning: Could not check robots.txt: {e}", file=sys.stderr)

        print(f"Scraping: {self.url} (crawl={crawl}, max_pages={self.max_pages}, max_depth={self.max_depth})", file=sys.stderr)

        try:
            with sync_playwright() as p:
                # Launch browser in headless mode (using Firefox for better macOS compatibility)
                print("Launching browser...", file=sys.stderr)
                browser = p.firefox.launch(
                    headless=True
                )

                # Create context with realistic user agent
                print("Creating browser context...", file=sys.stderr)
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1920, "height": 1080}
                )

                page = context.new_page()

                # Crawl the site using BFS
                # Queue contains tuples of (url, depth)
                to_crawl = deque([(self.url, 0)])
                all_texts = []  # Collect text from all pages for analysis

                while to_crawl and self.pages_crawled < self.max_pages:
                    current_url, depth = to_crawl.popleft()

                    if current_url in self.visited_urls:
                        continue

                    soup, text, links = self._crawl_page(page, current_url, depth)

                    if soup and text:
                        all_texts.append(text)

                        # Extract basic data from the first (main) page
                        if self.pages_crawled == 1:
                            print("Extracting main page data...", file=sys.stderr)
                            self._extract_name(soup, text)
                            self._extract_description(soup, text)
                            self._extract_contact_info(soup, text)
                            self._extract_address(soup, text)
                            self._extract_age_info(text)
                            self._extract_hours_per_day(text)
                            self._extract_pricing(text)
                            self._extract_categories(text)

                        # Always look for registration info on every page
                        self._extract_registration_info(soup, text)

                        # If crawling is enabled, add discovered links to queue
                        if crawl and depth < self.max_depth:
                            for link in links:
                                if link not in self.visited_urls:
                                    to_crawl.append((link, depth + 1))

                    # Stop crawling if we found registration dates
                    if self.data["re_enrollment_date"] and self.data["new_registration_date"]:
                        print("Found all registration dates, stopping crawl.", file=sys.stderr)
                        break

                # If we still don't have registration dates, try the registration URL directly
                if self.data["registration_url"] and not self.data["re_enrollment_date"] and not self.data["new_registration_date"]:
                    if self.data["registration_url"] not in self.visited_urls:
                        print(f"Checking registration URL for dates: {self.data['registration_url']}", file=sys.stderr)
                        self._scrape_registration_page(page)

                # Close browser
                print("Closing browser...", file=sys.stderr)
                browser.close()

                print(f"Crawled {self.pages_crawled} pages total.", file=sys.stderr)

        except PlaywrightTimeout as e:
            raise Exception(f"Page load timeout: {str(e)}")
        except Exception as e:
            raise Exception(f"Scraping failed: {str(e)}")

        print("Scraping completed successfully!", file=sys.stderr)
        return self.data

    def _extract_name(self, soup: BeautifulSoup, text: str):
        """Extract program/organization name"""
        # Try meta tags first
        og_title = soup.find("meta", property="og:title")
        if og_title and og_title.get("content"):
            self.data["name"] = og_title["content"].strip()
            return

        # Try page title
        title = soup.find("title")
        if title:
            # Clean up common suffixes
            name = title.text.strip()
            name = re.sub(r'\s*[\|\-]\s*(Home|Welcome|About).*$', '', name, flags=re.IGNORECASE)
            self.data["name"] = name.strip()
            return

        # Try h1
        h1 = soup.find("h1")
        if h1:
            self.data["name"] = h1.text.strip()

    def _clean_description(self, desc: str) -> str:
        """Remove cookie consent, privacy policy, and other boilerplate text from descriptions"""
        if not desc:
            return desc

        # Patterns to remove (case insensitive)
        boilerplate_patterns = [
            # Cookie consent
            r'by using this (website|site),?\s+you agree to\s+.*?cookies.*?\.?',
            r'we use cookies\s+.*?\.?',
            r'this (website|site) uses cookies\s+.*?\.?',
            r'cookies?\s+help us\s+.*?\.?',
            r'accept\s+(all\s+)?cookies?',
            r'cookie\s+(policy|preferences|settings|consent)',
            # Privacy/Terms
            r'by (using|continuing|browsing)\s+.*?(agree|accept|consent)\s+.*?(terms|privacy|policy).*?\.?',
            r'read our privacy policy',
            r'view our terms',
            # Generic website notices
            r'javascript (is|must be) enabled',
            r'please enable javascript',
            r'your browser.*?not supported',
            r'subscribe to our newsletter',
            r'sign up for (our )?(newsletter|updates|emails)',
            r'enter your email',
            # Navigation/UI text
            r'skip to (main )?content',
            r'toggle navigation',
            r'menu',
            r'search\s*$',
        ]

        cleaned = desc
        for pattern in boilerplate_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        # Clean up extra whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        # If we removed too much, return empty (will trigger fallback)
        if len(cleaned) < 30:
            return ""

        return cleaned

    def _extract_description(self, soup: BeautifulSoup, text: str):
        """Extract program description"""
        # Try meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            cleaned = self._clean_description(meta_desc["content"].strip())
            if cleaned:
                self.data["description"] = cleaned
                return

        # Try og:description
        og_desc = soup.find("meta", property="og:description")
        if og_desc and og_desc.get("content"):
            cleaned = self._clean_description(og_desc["content"].strip())
            if cleaned:
                self.data["description"] = cleaned
                return

        # Look for common about/description sections
        about_keywords = ["about", "description", "overview", "our program", "what we offer"]
        for keyword in about_keywords:
            sections = soup.find_all(["p", "div"], class_=re.compile(keyword, re.IGNORECASE))
            if sections:
                desc = " ".join([s.text.strip() for s in sections[:2]])
                cleaned = self._clean_description(desc)
                if len(cleaned) > 50:
                    self.data["description"] = cleaned[:500]
                    return

        # Fallback: get first few paragraphs
        paragraphs = soup.find_all("p")
        if paragraphs:
            desc = " ".join([p.text.strip() for p in paragraphs[:3] if len(p.text.strip()) > 20])
            cleaned = self._clean_description(desc)
            self.data["description"] = cleaned[:500] if cleaned else "Program information available on website."

    def _extract_contact_info(self, soup: BeautifulSoup, text: str):
        """Extract email and phone"""
        # Email regex
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        if emails:
            # Filter out common non-contact emails
            filtered = [e for e in emails if not any(x in e.lower() for x in ['noreply', 'example', 'test'])]
            if filtered:
                self.data["contact_email"] = filtered[0]

        # Phone regex (US format)
        phone_pattern = r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
        phones = re.findall(phone_pattern, text)
        if phones:
            self.data["contact_phone"] = phones[0]

    def _extract_address(self, soup, text: str):
        """Extract address and neighborhood from structured data and text"""
        # 1. Try structured data (schema.org, microdata, JSON-LD)
        address = self._extract_structured_address(soup)
        if address:
            self.data["address"] = address
            self._infer_neighborhood(address)
            return

        # 2. Try common address HTML patterns
        address = self._extract_html_address(soup)
        if address:
            self.data["address"] = address
            self._infer_neighborhood(address)
            return

        # 3. Try broad US address regex patterns on page text
        # Full address with city, state
        full_pattern = r'\d+\s+[A-Za-z\s\.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Terrace|Ter|Parkway|Pkwy)[.,]?\s*(?:#\s*\w+|Suite\s*\w+|Ste\s*\w+|Unit\s*\w+)?[.,]?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}'
        addresses = re.findall(full_pattern, text)
        if addresses:
            self.data["address"] = addresses[0].strip()
            self._infer_neighborhood(addresses[0])
            return

        # Street address with city/state (no zip)
        city_state_pattern = r'\d+\s+[A-Za-z\s\.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)[.,]?\s*(?:' + re.escape(self.region_city) + r')[.,]?\s*(?:CA|California|NY|New York|TX|Texas|IL|Illinois|WA|Washington)?'
        addresses = re.findall(city_state_pattern, text, re.IGNORECASE)
        if addresses:
            self.data["address"] = addresses[0].strip()
            self._infer_neighborhood(addresses[0])
            return

        # Fallback: just a street address (number + street name + suffix)
        street_only = r'\d+\s+[A-Za-z\s\.]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct)'
        streets = re.findall(street_only, text)
        if streets:
            self.data["address"] = streets[0].strip()
            self._infer_neighborhood(streets[0])
            return

        # No address found
        self.data["address"] = ""
        self.data["neighborhood"] = ""

    def _extract_structured_address(self, soup):
        """Extract address from structured data (JSON-LD, microdata, etc.)"""
        # JSON-LD (schema.org)
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                import json
                data = json.loads(script.string or '{}')
                # Handle single object or array
                items = data if isinstance(data, list) else [data]
                for item in items:
                    addr = item.get('address', {})
                    if isinstance(addr, dict):
                        parts = []
                        if addr.get('streetAddress'):
                            parts.append(addr['streetAddress'])
                        if addr.get('addressLocality'):
                            parts.append(addr['addressLocality'])
                        if addr.get('addressRegion'):
                            parts.append(addr['addressRegion'])
                        if addr.get('postalCode'):
                            parts.append(addr['postalCode'])
                        if parts:
                            return ', '.join(parts)
                    elif isinstance(addr, str) and len(addr) > 5:
                        return addr
            except (json.JSONDecodeError, AttributeError):
                continue
        return None

    def _extract_html_address(self, soup):
        """Extract address from common HTML patterns"""
        # <address> tag
        addr_tag = soup.find('address')
        if addr_tag:
            text = addr_tag.get_text(separator=' ', strip=True)
            if len(text) > 5 and any(c.isdigit() for c in text):
                return text

        # Schema.org microdata
        street = soup.find(attrs={'itemprop': 'streetAddress'})
        if street:
            parts = [street.get_text(strip=True)]
            locality = soup.find(attrs={'itemprop': 'addressLocality'})
            region = soup.find(attrs={'itemprop': 'addressRegion'})
            if locality:
                parts.append(locality.get_text(strip=True))
            if region:
                parts.append(region.get_text(strip=True))
            return ', '.join(parts)

        # Common CSS class patterns
        for selector in ['.address', '.location-address', '.contact-address',
                         '[class*="address"]', '[class*="location"]']:
            elem = soup.select_one(selector)
            if elem:
                text = elem.get_text(separator=' ', strip=True)
                if len(text) > 5 and any(c.isdigit() for c in text) and len(text) < 200:
                    return text

        return None

    def _infer_neighborhood(self, address: str):
        """Infer SF neighborhood from address"""
        # Common SF neighborhoods and their street patterns
        neighborhoods = {
            "Marina District": ["marina", "chestnut", "lombard"],
            "Mission District": ["mission", "valencia", "24th", "16th"],
            "SOMA": ["townsend", "folsom", "howard", "2nd", "3rd"],
            "Richmond District": ["geary", "clement"],
            "Sunset District": ["judah", "noriega", "taraval"],
            "Noe Valley": ["24th", "castro", "noe"],
            "Castro": ["castro", "market", "18th"],
            "Pacific Heights": ["pacific", "broadway", "fillmore"],
            "Haight-Ashbury": ["haight", "ashbury"],
            "North Beach": ["columbus", "broadway", "grant"],
        }

        address_lower = address.lower()
        for neighborhood, keywords in neighborhoods.items():
            if any(keyword in address_lower for keyword in keywords):
                self.data["neighborhood"] = neighborhood
                return

        self.data["neighborhood"] = self.region_city

    def _extract_age_info(self, text: str):
        """Extract age range information"""
    def _extract_hours_per_day(self, text: str):
        """Extract operating hours per day"""
        # Look for hours patterns (e.g., "Mon-Fri 9am-5pm")
        hours_patterns = [
            r'(?:hours?|open)[:\s]+([^\n]{10,80})',
            r'((?:monday|mon)[-\s]*(?:friday|fri)[,\s]*\d+\s*(?:am|pm)[^\n]{0,40})',
            r'((?:mon|tue|wed|thu|fri|sat|sun)[-\s/]+(?:mon|tue|wed|thu|fri|sat|sun)[,\s]+\d+[:\s]*\d*\s*(?:am|pm)[^\n]{0,40})',
        ]

        days_map = {
            'monday': 'monday', 'mon': 'monday',
            'tuesday': 'tuesday', 'tue': 'tuesday', 'tues': 'tuesday',
            'wednesday': 'wednesday', 'wed': 'wednesday',
            'thursday': 'thursday', 'thu': 'thursday', 'thurs': 'thursday',
            'friday': 'friday', 'fri': 'friday',
            'saturday': 'saturday', 'sat': 'saturday',
            'sunday': 'sunday', 'sun': 'sunday',
        }

        # Try to find hours text
        hours_text = None
        for pattern in hours_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                hours_text = matches[0] if isinstance(matches[0], str) else matches[0][0]
                break

        if hours_text:
            hours_lower = hours_text.lower()

            # Extract operating days
            operating_days = []

            # Check for day ranges like "mon-fri" or "monday-friday"
            if 'mon' in hours_lower and 'fri' in hours_lower:
                operating_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            elif 'sat' in hours_lower and 'sun' in hours_lower:
                operating_days.extend(['saturday', 'sunday'])

            # Check for individual days
            for abbr, full_day in days_map.items():
                if re.search(r'\b' + abbr + r'\b', hours_lower):
                    if full_day not in operating_days:
                        operating_days.append(full_day)

            self.data["operating_days"] = operating_days

            # Extract time range (e.g., "9am-5pm" or "09:00-17:00")
            time_pattern = r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-to–]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?'
            time_matches = re.findall(time_pattern, hours_lower, re.IGNORECASE)

            if time_matches and operating_days:
                # Convert to 24-hour format
                open_hour, open_min, open_period, close_hour, close_min, close_period = time_matches[0]

                open_hour = int(open_hour)
                close_hour = int(close_hour)
                open_min = int(open_min) if open_min else 0
                close_min = int(close_min) if close_min else 0

                # Convert to 24-hour format
                if open_period and open_period.lower() == 'pm' and open_hour != 12:
                    open_hour += 12
                elif open_period and open_period.lower() == 'am' and open_hour == 12:
                    open_hour = 0

                if close_period and close_period.lower() == 'pm' and close_hour != 12:
                    close_hour += 12
                elif close_period and close_period.lower() == 'am' and close_hour == 12:
                    close_hour = 0

                # Format as HH:MM
                open_time = f"{open_hour:02d}:{open_min:02d}"
                close_time = f"{close_hour:02d}:{close_min:02d}"

                # Set same hours for all operating days
                hours_per_day = {}
                for day in operating_days:
                    hours_per_day[day] = {
                        "open": open_time,
                        "close": close_time
                    }

                self.data["hours_per_day"] = hours_per_day
            else:
                # Default hours if we can't parse
                hours_per_day = {}
                for day in operating_days:
                    hours_per_day[day] = {
                        "open": "09:00",
                        "close": "17:00"
                    }
                self.data["hours_per_day"] = hours_per_day
        # If no hours found on website, leave empty so Google hours can be used as fallback
        # (Previously set default weekday hours which would override Google data)

    def _extract_pricing(self, text: str):
        """Extract pricing information with support for price ranges"""
        # Look for free programs
        if re.search(r'\bfree\b', text, re.IGNORECASE):
            self.data["price_min"] = 0
            self.data["price_max"] = 0
            self.data["price_description"] = "Free"
            return

        # Look for price ranges: "$100-$200" or "$100 to $200"
        range_pattern = r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*[-to–]+\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per|/|each)?\s*(month|session|class|week|term|semester|year)?'
        range_matches = re.findall(range_pattern, text, re.IGNORECASE)

        if range_matches:
            min_price = float(range_matches[0][0].replace(',', ''))
            max_price = float(range_matches[0][1].replace(',', ''))
            self.data["price_min"] = min_price
            self.data["price_max"] = max_price

            if range_matches[0][2]:
                unit = range_matches[0][2].lower()
                self.data["price_unit"] = f"per {unit}"

            return

        # Look for single dollar amounts
        price_pattern = r'\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:per|/|each)?\s*(month|session|class|week|term|semester|year)?'
        matches = re.findall(price_pattern, text, re.IGNORECASE)

        if matches:
            price_str = matches[0][0].replace(',', '')
            price = float(price_str)

            # Set both min and max to same value for single price
            self.data["price_min"] = price
            self.data["price_max"] = price

            if matches[0][1]:
                unit = matches[0][1].lower()
                self.data["price_unit"] = f"per {unit}"

    def _extract_categories(self, text: str):
        """Infer program categories from content"""
        category_keywords = {
            "swimming": ["swim", "aquatic", "water", "pool"],
            "art": ["art", "painting", "drawing", "sculpture", "creative"],
            "chess": ["chess"],
            "soccer": ["soccer", "football"],
            "music": ["music", "piano", "guitar", "violin", "instrument"],
            "dance": ["dance", "ballet", "hip hop"],
            "martial-arts": ["martial arts", "karate", "taekwondo", "judo", "kung fu"],
            "technology": ["coding", "programming", "computer", "robotics", "tech"],
            "academic": ["tutoring", "math", "science", "reading", "academic"],
            "science": ["science", "stem", "engineering", "physics", "chemistry"],
            "sports": ["sports", "athletic", "fitness"],
        }

        text_lower = text.lower()
        categories = []

        for category, keywords in category_keywords.items():
            if any(keyword in text_lower for keyword in keywords):
                categories.append(category)

        # Ensure at least one category
        if not categories:
            categories = ["creative"]

        self.data["category"] = categories[:3]  # Limit to 3 categories

    def _extract_registration_info(self, soup: BeautifulSoup, text: str):
        """Extract registration URL and registration dates (re-enrollment and new registration)"""
        from datetime import datetime

        # Extract registration URL from links
        registration_keywords = ['register', 'enroll', 'sign-up', 'signup', 'sign up']

        for link in soup.find_all('a', href=True):
            href = link.get('href', '').lower()
            link_text = link.get_text().lower()

            # Skip mailto and tel links
            if href.startswith('mailto:') or href.startswith('tel:'):
                continue

            # Check if link URL or text contains registration keywords
            if any(kw in href or kw in link_text for kw in registration_keywords):
                url = link.get('href')
                # Make relative URLs absolute
                if url.startswith('/'):
                    parsed = urlparse(self.url)
                    url = f"{parsed.scheme}://{parsed.netloc}{url}"
                elif not url.startswith('http'):
                    # Skip non-http protocols
                    if ':' in url:
                        continue
                    url = f"{self.url.rstrip('/')}/{url}"

                self.data["registration_url"] = url
                break

        # Extract registration dates
        text_lower = text.lower()

        # Month names for parsing
        months = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
            'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
            'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
        }

        today = datetime.now()
        current_year = today.year

        # Date patterns
        date_patterns = [
            # Monday, January 15, 2025 or Monday, Jan 15th 2025 (with day name)
            r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})',
            # January 15, 2025 or Jan 15, 2025
            r'(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})',
            # 01/15/2025 or 1/15/2025
            r'(\d{1,2})/(\d{1,2})/(\d{4})',
            # 2025-01-15
            r'(\d{4})-(\d{2})-(\d{2})',
            # Monday, January 15 or Monday, Jan 15th (with day name, without year)
            r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?!\s*,?\s*\d{4})',
            # January 15 or Jan 15 (without year)
            r'(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?!\s*,?\s*\d{4})',
        ]

        # Keywords for re-enrollment (current students)
        re_enrollment_keywords = [
            're-enrollment', 'reenrollment', 're enrollment',
            'current students', 'returning students', 'current families',
            'priority registration', 'early registration'
        ]

        # Keywords for new registration (new students)
        new_registration_keywords = [
            'open enrollment', 'new enrollment', 'new students', 'new families',
            'general registration', 'public registration', 'returning students begins',
            'registration opens', 'registration begins', 'enrollment opens',
            'enrollment begins', 'sign up', 'register by', 'enroll by'
        ]

        def parse_date_from_context(context):
            """Parse a date from context text, return datetime or None"""
            for pattern in date_patterns:
                matches = re.findall(pattern, context, re.IGNORECASE)
                if not matches:
                    continue

                match = matches[0]

                try:
                    if len(match) == 3:
                        if match[0].isdigit() and len(match[0]) == 4:
                            # YYYY-MM-DD format
                            year, month, day = int(match[0]), int(match[1]), int(match[2])
                        elif match[2].isdigit() and len(match[2]) == 4:
                            if match[0].isdigit():
                                # MM/DD/YYYY format
                                month, day, year = int(match[0]), int(match[1]), int(match[2])
                            else:
                                # Month DD, YYYY format
                                month = months.get(match[0].lower(), 0)
                                day = int(match[1])
                                year = int(match[2])
                        else:
                            continue
                    elif len(match) == 2:
                        # Month DD format (assume current or next year)
                        month = months.get(match[0].lower(), 0)
                        day = int(match[1])
                        test_date = datetime(current_year, month, day)
                        year = current_year if test_date >= today else current_year + 1
                    else:
                        continue

                    if month == 0:
                        continue

                    parsed_date = datetime(year, month, day)

                    # Only consider future dates
                    if parsed_date >= today:
                        return parsed_date

                except (ValueError, TypeError):
                    continue

            return None

        # Search for re-enrollment date
        for keyword in re_enrollment_keywords:
            keyword_idx = text_lower.find(keyword)
            if keyword_idx == -1:
                continue

            # Get context around the keyword (300 chars after)
            context = text_lower[keyword_idx:keyword_idx + 300]
            found_date = parse_date_from_context(context)

            if found_date:
                self.data["re_enrollment_date"] = found_date.strftime('%Y-%m-%d')
                break

        # Search for new registration date
        for keyword in new_registration_keywords:
            keyword_idx = text_lower.find(keyword)
            if keyword_idx == -1:
                continue

            # Get context around the keyword (300 chars after)
            context = text_lower[keyword_idx:keyword_idx + 300]
            found_date = parse_date_from_context(context)

            if found_date:
                self.data["new_registration_date"] = found_date.strftime('%Y-%m-%d')
                break

    def _scrape_registration_page(self, page):
        """Visit the registration URL and look for registration dates"""
        from datetime import datetime

        reg_url = self.data["registration_url"]
        if not reg_url:
            return

        try:
            print(f"Navigating to registration page: {reg_url}", file=sys.stderr)
            page.goto(reg_url, wait_until="domcontentloaded", timeout=15000)
            self.human_delay(1, 2)

            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except PlaywrightTimeout:
                print("Registration page network idle timeout (continuing)...", file=sys.stderr)

            # Get page content
            reg_text = page.inner_text("body")
            text_lower = reg_text.lower()

            today = datetime.now()
            current_year = today.year

            # Month names for parsing
            months = {
                'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
                'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6,
                'july': 7, 'jul': 7, 'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'sept': 9,
                'october': 10, 'oct': 10, 'november': 11, 'nov': 11, 'december': 12, 'dec': 12
            }

            # Date patterns
            date_patterns = [
                r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})',
                r'(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})',
                r'(\d{1,2})/(\d{1,2})/(\d{4})',
                r'(\d{4})-(\d{2})-(\d{2})',
                r'(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?!\s*,?\s*\d{4})',
                r'(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?!\s*,?\s*\d{4})',
            ]

            def parse_date_from_context(context):
                for pattern in date_patterns:
                    matches = re.findall(pattern, context, re.IGNORECASE)
                    if not matches:
                        continue
                    match = matches[0]
                    try:
                        if len(match) == 3:
                            if match[0].isdigit() and len(match[0]) == 4:
                                year, month, day = int(match[0]), int(match[1]), int(match[2])
                            elif match[2].isdigit() and len(match[2]) == 4:
                                if match[0].isdigit():
                                    month, day, year = int(match[0]), int(match[1]), int(match[2])
                                else:
                                    month = months.get(match[0].lower(), 0)
                                    day = int(match[1])
                                    year = int(match[2])
                            else:
                                continue
                        elif len(match) == 2:
                            month = months.get(match[0].lower(), 0)
                            day = int(match[1])
                            test_date = datetime(current_year, month, day)
                            year = current_year if test_date >= today else current_year + 1
                        else:
                            continue
                        if month == 0:
                            continue
                        parsed_date = datetime(year, month, day)
                        if parsed_date >= today:
                            return parsed_date
                    except (ValueError, TypeError):
                        continue
                return None

            # Keywords for re-enrollment
            re_enrollment_keywords = [
                're-enrollment', 'reenrollment', 're enrollment',
                'current students', 'returning students', 'current families',
                'priority registration', 'early registration'
            ]

            # Keywords for new registration
            new_registration_keywords = [
                'open enrollment', 'new enrollment', 'new students', 'new families',
                'general registration', 'public registration',
                'registration opens', 'registration begins', 'enrollment opens',
                'enrollment begins', 'sign up', 'register by', 'enroll by',
                'deadline', 'opens on', 'begins on', 'starts on'
            ]

            # Search for re-enrollment date
            if not self.data["re_enrollment_date"]:
                for keyword in re_enrollment_keywords:
                    keyword_idx = text_lower.find(keyword)
                    if keyword_idx == -1:
                        continue
                    context = text_lower[keyword_idx:keyword_idx + 300]
                    found_date = parse_date_from_context(context)
                    if found_date:
                        self.data["re_enrollment_date"] = found_date.strftime('%Y-%m-%d')
                        print(f"Found re-enrollment date on registration page: {self.data['re_enrollment_date']}", file=sys.stderr)
                        break

            # Search for new registration date
            if not self.data["new_registration_date"]:
                for keyword in new_registration_keywords:
                    keyword_idx = text_lower.find(keyword)
                    if keyword_idx == -1:
                        continue
                    context = text_lower[keyword_idx:keyword_idx + 300]
                    found_date = parse_date_from_context(context)
                    if found_date:
                        self.data["new_registration_date"] = found_date.strftime('%Y-%m-%d')
                        print(f"Found new registration date on registration page: {self.data['new_registration_date']}", file=sys.stderr)
                        break

            # If still no dates found, try to find any prominent date on the page
            if not self.data["new_registration_date"]:
                # Look for dates near common registration-related text
                general_keywords = ['registration', 'enrollment', 'deadline', 'opens', 'begins', 'start']
                for keyword in general_keywords:
                    keyword_idx = text_lower.find(keyword)
                    if keyword_idx == -1:
                        continue
                    # Search around the keyword (100 chars before and 200 after)
                    start = max(0, keyword_idx - 100)
                    context = text_lower[start:keyword_idx + 200]
                    found_date = parse_date_from_context(context)
                    if found_date:
                        self.data["new_registration_date"] = found_date.strftime('%Y-%m-%d')
                        print(f"Found registration date on registration page: {self.data['new_registration_date']}", file=sys.stderr)
                        break

        except Exception as e:
            print(f"Error scraping registration page: {e}", file=sys.stderr)


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Scrape enrichment program websites for registration info',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scrape a single page only
  python scrape_program.py https://example.com --no-crawl

  # Crawl up to 20 pages, 3 levels deep
  python scrape_program.py https://example.com --max-pages 20 --max-depth 3

  # Default: crawl up to 10 pages, 2 levels deep
  python scrape_program.py https://example.com
        """
    )
    parser.add_argument('url', help='URL of the provider website to scrape')
    parser.add_argument('--max-pages', type=int, default=10,
                        help='Maximum number of pages to crawl (default: 10)')
    parser.add_argument('--max-depth', type=int, default=2,
                        help='Maximum crawl depth from starting page (default: 2)')
    parser.add_argument('--no-crawl', action='store_true',
                        help='Only scrape the main page, do not crawl subpages')
    parser.add_argument('--region', type=str, default='San Francisco',
                        help='City name for the region (default: San Francisco). Used for address matching and neighborhood fallback.')

    args = parser.parse_args()

    try:
        scraper = ProgramScraper(
            url=args.url,
            max_pages=args.max_pages,
            max_depth=args.max_depth,
            region_city=args.region
        )
        result = scraper.scrape(crawl=not args.no_crawl)
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
