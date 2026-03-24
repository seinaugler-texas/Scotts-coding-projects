from flask import Blueprint, jsonify, request
from ..scraper import scrape_company, search_and_scrape
from ..form_filler import fill_donation_form, fill_forms_for_campaign
from ..models import Company, Campaign, OutreachLog
from .. import db
import os

scraper_bp = Blueprint("scraper", __name__)

@scraper_bp.post("/scrape")
def scrape_urls():
    data = request.get_json()
    urls = data.get("urls", [])
    auto_import = data.get("auto_import", False)
    if not urls or not isinstance(urls, list):
        return jsonify({"error": "Provide a non-empty 'urls' list"}), 400
    if len(urls) > 50:
        return jsonify({"error": "Maximum 50 URLs per request"}), 400
    delay = float(os.getenv("SCRAPE_DELAY", 2.0))
    results = search_and_scrape(urls, delay=delay)
    if auto_import:
        created = 0
        for item in results:
            if not item.get("name") or item.get("notes", "").startswith("Skipped"):
                continue
            existing = Company.query.filter_by(
                name=item["name"], website=item.get("website")
            ).first()
            if not existing:
                company = Company(**{
                    k: item.get(k)
                    for k in ("name", "website", "donation_email",
                              "submission_form_url", "notes", "source_url")
                })
                db.session.add(company)
                created += 1
        db.session.commit()
        return jsonify({"results": results, "imported": created})
    return jsonify({"results": results})


@scraper_bp.post("/scrape_single")
def scrape_single():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"error": "url is required"}), 400
    delay = float(os.getenv("SCRAPE_DELAY", 2.0))
    result = scrape_company(url, delay=delay)
    return jsonify(result)


@scraper_bp.post("/fill_form")
def fill_form():
    """Fill a single donation form with provided data."""
    data = request.get_json()
    url = data.get("url")
    form_data = data.get("form_data", {})
    if not url:
        return jsonify({"error": "url is required"}), 400
    result = fill_donation_form(url, form_data)
    return jsonify(result)


@scraper_bp.post("/fill_forms_campaign")
def fill_forms_campaign():
    """Fill donation forms for all companies in a campaign that have form URLs."""
    data = request.get_json()
    campaign_id = data.get("campaign_id")
    if not campaign_id:
        return jsonify({"error": "campaign_id is required"}), 400
    campaign = db.get_or_404(Campaign, campaign_id)
    logs = OutreachLog.query.filter_by(
        campaign_id=campaign_id, status="pending"
    ).all()
    companies = [db.session.get(Company, log.company_id) for log in logs]
    companies = [c for c in companies if c and c.submission_form_url]
    results = fill_forms_for_campaign(campaign, companies)
    return jsonify({"results": results, "total": len(results)})
