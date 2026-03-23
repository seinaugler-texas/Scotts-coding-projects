from flask import Blueprint, jsonify, request
from ..models import Company
from .. import db

companies_bp = Blueprint("companies", __name__)


@companies_bp.get("/")
def list_companies():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    search = request.args.get("search", "")
    verified = request.args.get("verified")

    query = Company.query
    if search:
        query = query.filter(Company.name.ilike(f"%{search}%"))
    if verified is not None:
        query = query.filter(Company.verified == (verified.lower() == "true"))

    pagination = query.order_by(Company.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        "companies": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "pages": pagination.pages,
        "page": page,
    })


@companies_bp.post("/")
def create_company():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "name is required"}), 400

    company = Company(
        name=data["name"],
        website=data.get("website"),
        donation_email=data.get("donation_email"),
        submission_form_url=data.get("submission_form_url"),
        contact_name=data.get("contact_name"),
        notes=data.get("notes"),
        source_url=data.get("source_url"),
        verified=data.get("verified", False),
    )
    db.session.add(company)
    db.session.commit()
    return jsonify(company.to_dict()), 201


@companies_bp.get("/<int:company_id>")
def get_company(company_id):
    company = db.get_or_404(Company, company_id)
    return jsonify(company.to_dict())


@companies_bp.put("/<int:company_id>")
def update_company(company_id):
    company = db.get_or_404(Company, company_id)
    data = request.get_json()
    for field in ("name", "website", "donation_email", "submission_form_url",
                  "contact_name", "notes", "source_url", "verified"):
        if field in data:
            setattr(company, field, data[field])
    db.session.commit()
    return jsonify(company.to_dict())


@companies_bp.delete("/<int:company_id>")
def delete_company(company_id):
    company = db.get_or_404(Company, company_id)
    db.session.delete(company)
    db.session.commit()
    return jsonify({"message": "deleted"}), 200


@companies_bp.post("/bulk")
def bulk_import():
    """Import a list of company dicts (e.g., from scraper results)."""
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "expected a JSON array"}), 400

    created = 0
    skipped = 0
    for item in data:
        if not item.get("name"):
            skipped += 1
            continue
        existing = Company.query.filter_by(
            name=item["name"], website=item.get("website")
        ).first()
        if existing:
            skipped += 1
            continue
        company = Company(**{
            k: item.get(k)
            for k in ("name", "website", "donation_email", "submission_form_url",
                      "contact_name", "notes", "source_url")
        })
        db.session.add(company)
        created += 1

    db.session.commit()
    return jsonify({"created": created, "skipped": skipped}), 201
