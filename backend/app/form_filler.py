"""
Automated donation form filler using Playwright.
Visits each company's submission_form_url and attempts to fill in
the nonprofit's information automatically.
"""

import logging
import time
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

logger = logging.getLogger(__name__)

FIELD_PATTERNS = {
    "organization": [
        "organization", "org_name", "nonprofit", "charity", "group_name",
        "organisation", "company", "applicant"
    ],
    "contact_name": [
        "contact_name", "contact", "name", "full_name", "first_name",
        "your_name", "representative", "person"
    ],
    "email": [
        "email", "e_mail", "email_address", "contact_email", "reply_to"
    ],
    "phone": [
        "phone", "telephone", "tel", "phone_number", "contact_phone", "mobile"
    ],
    "message": [
        "message", "description", "details", "request", "notes",
        "comments", "purpose", "how_use", "mission", "about"
    ],
    "website": [
        "website", "web", "url", "site", "homepage", "web_address"
    ],
    "tax_id": [
        "tax_id", "ein", "tax_number", "federal_id", "501c3", "nonprofit_id"
    ],
    "amount": [
        "amount", "donation_amount", "requested_amount", "how_much"
    ],
    "event_name": [
        "event", "event_name", "program", "project", "initiative", "cause"
    ],
    "event_date": [
        "event_date", "date", "when", "program_date", "start_date"
    ],
}


def _find_input(page, patterns):
    """Try to find an input field matching any of the given patterns."""
    for pattern in patterns:
        selectors = [
            f'input[name*="{pattern}"]',
            f'input[id*="{pattern}"]',
            f'input[placeholder*="{pattern}"]',
            f'textarea[name*="{pattern}"]',
            f'textarea[id*="{pattern}"]',
            f'textarea[placeholder*="{pattern}"]',
        ]
        for selector in selectors:
            try:
                el = page.query_selector(selector)
                if el and el.is_visible():
                    return el
            except Exception:
                continue
    return None


def fill_donation_form(url: str, form_data: dict) -> dict:
    """
    Visit a donation form URL and attempt to fill it in automatically.
    
    form_data should contain:
        - organization: nonprofit name
        - contact_name: sender's full name
        - email: sender's email
        - phone: sender's phone
        - website: nonprofit website (optional)
        - tax_id: EIN/501c3 number (optional)
        - message: donation request message
        - event_name: name of the event
        - event_date: date of the event
        - amount: requested amount (optional)
    
    Returns a dict with status and details.
    """
    result = {
        "url": url,
        "status": "unknown",
        "fields_filled": [],
        "fields_not_found": [],
        "error": None,
        "submitted": False,
    }

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-setuid-sandbox"])
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            page = context.new_page()
            page.set_default_timeout(15000)

            try:
                page.goto(url, wait_until="networkidle", timeout=20000)
            except PlaywrightTimeout:
                page.goto(url, wait_until="domcontentloaded", timeout=20000)

            time.sleep(2)

            # Map our form_data keys to field patterns
            field_map = {
                "organization": (FIELD_PATTERNS["organization"], form_data.get("organization", "")),
                "contact_name": (FIELD_PATTERNS["contact_name"], form_data.get("contact_name", "")),
                "email": (FIELD_PATTERNS["email"], form_data.get("email", "")),
                "phone": (FIELD_PATTERNS["phone"], form_data.get("phone", "")),
                "message": (FIELD_PATTERNS["message"], form_data.get("message", "")),
                "website": (FIELD_PATTERNS["website"], form_data.get("website", "")),
                "tax_id": (FIELD_PATTERNS["tax_id"], form_data.get("tax_id", "")),
                "event_name": (FIELD_PATTERNS["event_name"], form_data.get("event_name", "")),
                "event_date": (FIELD_PATTERNS["event_date"], form_data.get("event_date", "")),
            }

            for field_key, (patterns, value) in field_map.items():
                if not value:
                    continue
                el = _find_input(page, patterns)
                if el:
                    try:
                        el.click()
                        el.fill(str(value))
                        result["fields_filled"].append(field_key)
                    except Exception as e:
                        result["fields_not_found"].append(field_key)
                        logger.warning("Could not fill %s: %s", field_key, e)
                else:
                    result["fields_not_found"].append(field_key)

            # Try to find and click submit button
            submit_selectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Submit")',
                'button:has-text("Send")',
                'button:has-text("Apply")',
                'button:has-text("Request")',
            ]

            submitted = False
            for selector in submit_selectors:
                try:
                    btn = page.query_selector(selector)
                    if btn and btn.is_visible():
                        # Don't actually click - just report we found it
                        result["submit_button_found"] = True
                        submitted = True
                        break
                except Exception:
                    continue

            if not submitted:
                result["submit_button_found"] = False

            result["status"] = "filled" if result["fields_filled"] else "no_fields_found"
            result["submitted"] = False  # Never auto-submit without user confirmation

            browser.close()

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        logger.error("Form filler error for %s: %s", url, e)

    return result


def fill_forms_for_campaign(campaign, companies) -> list:
    """Fill donation forms for all companies in a campaign that have form URLs."""
    results = []
    form_data = {
        "organization": campaign.nonprofit_name,
        "contact_name": campaign.sender_name,
        "email": campaign.sender_email,
        "phone": campaign.sender_phone or "",
        "message": f"We are {campaign.nonprofit_name} and we are hosting our Annual Charity Poker Tournament on June 14, 2026. We would love your support through sponsorship or prize donations. {campaign.nonprofit_mission or ''}",
        "event_name": "Hebrew Free Loan Annual Charity Poker Tournament",
        "event_date": "June 14 2026",
        "website": "",
        "tax_id": "",
    }

    for company in companies:
        if not company.submission_form_url:
            results.append({
                "company": company.name,
                "status": "skipped",
                "error": "No form URL available"
            })
            continue

        logger.info("Filling form for %s at %s", company.name, company.submission_form_url)
        result = fill_donation_form(company.submission_form_url, form_data)
        result["company"] = company.name
        results.append(result)
        time.sleep(3)  # Be respectful between requests

    return results
