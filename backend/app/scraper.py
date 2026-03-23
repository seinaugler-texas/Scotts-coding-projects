"""
Ethical web scraper for finding companies that accept nonprofit donation requests.

Design principles:
  - Respects robots.txt on every domain before fetching any page.
  - Enforces configurable delay between requests (default 2 s) to avoid overloading servers.
  - Only collects publicly listed contact information (emails/forms on public pages).
  - Never stores or processes personal / private data.
  - Sends a descriptive User-Agent so site owners know what is crawling.
"""

import re
import time
import logging
import os
from urllib.parse import urljoin, urlparse
from typing import Optional

import requests
from bs4 import BeautifulSoup
from robotexclusionrulesparser import RobotExclusionRulesParser

logger = logging.getLogger(__name__)

USER_AGENT = (
    "NonprofitOutreachBot/1.0 "
    "(ethical scraper for finding public donation contact info; "
    "contact: see your .env MAIL_USERNAME)"
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

DONATION_KEYWORDS = [
    "donat", "sponsor", "grant", "philanthrop", "giving", "community", "nonprofit",
    "charity", "foundation", "support us",
]

FORM_KEYWORDS = [
    "donation request", "sponsorship request", "grant request",
    "community giving", "charitable request",
]


def _robots_allowed(url: str, delay_attr: list) -> bool:
    """Return True if robots.txt permits crawling *url* with our user-agent."""
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = RobotExclusionRulesParser()
    try:
        resp = requests.get(robots_url, timeout=8, headers={"User-Agent": USER_AGENT})
        if resp.status_code == 200:
            rp.parse(resp.text)
            # Honour Crawl-delay if specified
            crawl_delay = rp.get_crawl_delay(USER_AGENT)
            if crawl_delay:
                delay_attr.append(float(crawl_delay))
    except Exception:
        pass  # If we can't fetch robots.txt, proceed cautiously
    return rp.is_allowed(USER_AGENT, url)


def _get_page(url: str, session: requests.Session) -> Optional[BeautifulSoup]:
    """Fetch a page and return a BeautifulSoup object, or None on failure."""
    try:
        resp = session.get(url, timeout=10, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def _extract_emails(soup: BeautifulSoup, page_text: str) -> list[str]:
    """Return donation-related email addresses found on a page."""
    all_emails = EMAIL_RE.findall(page_text)
    # Prefer emails whose address or surrounding anchor text hints at donations
    donation_emails = []
    generic_emails = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            ctx = (a.get_text() + href).lower()
            if any(k in ctx for k in DONATION_KEYWORDS):
                donation_emails.append(addr)
            else:
                generic_emails.append(addr)

    # Fall back to regex-extracted emails if no mailto links found
    seen = set()
    result = []
    for addr in donation_emails + generic_emails:
        if addr not in seen:
            seen.add(addr)
            result.append(addr)
    # Also capture any regex-found emails not already in result
    for addr in all_emails:
        if addr not in seen:
            seen.add(addr)
            result.append(addr)
    return result


def _extract_forms(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Return URLs of forms that look like donation/sponsorship request forms."""
    form_urls = []
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        href = a["href"]
        combined = text + " " + href.lower()
        if any(k in combined for k in FORM_KEYWORDS):
            form_urls.append(urljoin(base_url, href))
    return form_urls


def scrape_company(url: str, delay: float = 2.0) -> dict:
    """
    Scrape a single company website for donation contact info.

    Returns a dict with keys: name, website, donation_email, submission_form_url,
    notes, source_url.
    """
    result = {
        "name": "",
        "website": url,
        "donation_email": None,
        "submission_form_url": None,
        "notes": "",
        "source_url": url,
    }

    delay_holder: list = []
    if not _robots_allowed(url, delay_holder):
        result["notes"] = "Skipped: robots.txt disallows crawling."
        logger.info("robots.txt disallows %s", url)
        return result

    effective_delay = max(delay, delay_holder[0] if delay_holder else 0)

    session = requests.Session()
    soup = _get_page(url, session)
    if soup is None:
        result["notes"] = "Failed to fetch page."
        return result

    # Extract company name from <title> or <h1>
    title = soup.find("title")
    h1 = soup.find("h1")
    result["name"] = (
        (h1.get_text(strip=True) if h1 else None)
        or (title.get_text(strip=True).split("|")[0].strip() if title else "")
        or urlparse(url).netloc
    )

    page_text = soup.get_text()
    emails = _extract_emails(soup, page_text)
    if emails:
        result["donation_email"] = emails[0]

    form_urls = _extract_forms(soup, url)
    if form_urls:
        result["submission_form_url"] = form_urls[0]

    # Follow internal "donation" / "giving" / "community" links one level deep
    internal_links = []
    parsed_base = urlparse(url)
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        text = a.get_text(strip=True).lower()
        if any(k in href or k in text for k in DONATION_KEYWORDS):
            full = urljoin(url, a["href"])
            if urlparse(full).netloc == parsed_base.netloc:
                internal_links.append(full)

    for link in internal_links[:3]:  # cap at 3 sub-pages
        time.sleep(effective_delay)
        sub_soup = _get_page(link, session)
        if sub_soup is None:
            continue
        sub_text = sub_soup.get_text()
        sub_emails = _extract_emails(sub_soup, sub_text)
        if sub_emails and not result["donation_email"]:
            result["donation_email"] = sub_emails[0]
        sub_forms = _extract_forms(sub_soup, link)
        if sub_forms and not result["submission_form_url"]:
            result["submission_form_url"] = sub_forms[0]
        if result["donation_email"] and result["submission_form_url"]:
            break

    time.sleep(effective_delay)
    return result


def search_and_scrape(query_urls: list[str], delay: float = 2.0) -> list[dict]:
    """
    Scrape a list of company URLs and return their donation contact info.
    Each URL is processed with the configured ethical delay between requests.
    """
    results = []
    for url in query_urls:
        logger.info("Scraping: %s", url)
        data = scrape_company(url, delay=delay)
        results.append(data)
        time.sleep(delay)
    return results
