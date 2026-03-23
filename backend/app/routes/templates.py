from flask import Blueprint, jsonify, request
from ..models import EmailTemplate
from .. import db

templates_bp = Blueprint("templates", __name__)

DEFAULT_TEMPLATE = {
    "name": "Standard Donation Request",
    "subject": "Request for Support to {{nonprofit_name}}",
    "body": (
        "Dear {{contact_name}},\n\n"
        "I hope this message finds you well. I am reaching out on behalf of "
        "{{nonprofit_name}} to seek your support in our mission to {{nonprofit_mission}}.\n\n"
        "We would be incredibly grateful for any assistance {{company_name}} can provide "
        "— whether through a monetary donation, in-kind support, or a partnership opportunity.\n\n"
        "To learn more about us or to submit a donation request, please feel free to reply "
        "to this email or visit our website.\n\n"
        "Thank you sincerely for considering our request and for your commitment to the community.\n\n"
        "Best regards,\n"
        "{{sender_name}}\n"
        "{{nonprofit_name}}\n"
        "{{sender_email}}\n"
        "{{sender_phone}}"
    ),
    "is_default": True,
}


@templates_bp.get("/")
def list_templates():
    templates = EmailTemplate.query.order_by(EmailTemplate.created_at.desc()).all()
    # Seed default if none exist
    if not templates:
        t = EmailTemplate(**DEFAULT_TEMPLATE)
        db.session.add(t)
        db.session.commit()
        templates = [t]
    return jsonify([t.to_dict() for t in templates])


@templates_bp.post("/")
def create_template():
    data = request.get_json()
    required = ("name", "subject", "body")
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    if data.get("is_default"):
        EmailTemplate.query.filter_by(is_default=True).update({"is_default": False})

    template = EmailTemplate(
        name=data["name"],
        subject=data["subject"],
        body=data["body"],
        is_default=data.get("is_default", False),
    )
    db.session.add(template)
    db.session.commit()
    return jsonify(template.to_dict()), 201


@templates_bp.get("/<int:template_id>")
def get_template(template_id):
    template = db.get_or_404(EmailTemplate, template_id)
    return jsonify(template.to_dict())


@templates_bp.put("/<int:template_id>")
def update_template(template_id):
    template = db.get_or_404(EmailTemplate, template_id)
    data = request.get_json()

    if data.get("is_default"):
        EmailTemplate.query.filter(
            EmailTemplate.id != template_id, EmailTemplate.is_default == True
        ).update({"is_default": False})

    for field in ("name", "subject", "body", "is_default"):
        if field in data:
            setattr(template, field, data[field])
    db.session.commit()
    return jsonify(template.to_dict())


@templates_bp.delete("/<int:template_id>")
def delete_template(template_id):
    template = db.get_or_404(EmailTemplate, template_id)
    db.session.delete(template)
    db.session.commit()
    return jsonify({"message": "deleted"})


@templates_bp.get("/variables")
def list_variables():
    """Return the supported template variables and their descriptions."""
    return jsonify({
        "variables": [
            {"key": "nonprofit_name", "description": "Your nonprofit organisation name"},
            {"key": "nonprofit_mission", "description": "Brief description of your mission"},
            {"key": "company_name", "description": "The recipient company name"},
            {"key": "contact_name", "description": "The recipient contact person name"},
            {"key": "sender_name", "description": "Your name"},
            {"key": "sender_email", "description": "Your email address"},
            {"key": "sender_phone", "description": "Your phone number"},
        ]
    })
