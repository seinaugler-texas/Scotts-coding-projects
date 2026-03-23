from flask import Blueprint, jsonify, request, current_app
from datetime import datetime, timezone

from ..models import Campaign, Company, OutreachLog, EmailTemplate
from .. import db, scheduler
from ..email_sender import run_campaign

campaigns_bp = Blueprint("campaigns", __name__)


def _schedule_campaign(app, campaign: Campaign):
    job_id = f"campaign_{campaign.id}"
    # Remove any previous job for this campaign
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

    run_date = campaign.scheduled_at or datetime.now(timezone.utc)
    scheduler.add_job(
        run_campaign,
        "date",
        run_date=run_date,
        args=[app, campaign.id],
        id=job_id,
        replace_existing=True,
    )


@campaigns_bp.get("/")
def list_campaigns():
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    return jsonify([c.to_dict() for c in campaigns])


@campaigns_bp.post("/")
def create_campaign():
    data = request.get_json()
    required = ("name", "template_id", "nonprofit_name", "sender_name", "sender_email")
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    template = db.session.get(EmailTemplate, data["template_id"])
    if not template:
        return jsonify({"error": "Template not found"}), 404

    scheduled_at = None
    if data.get("scheduled_at"):
        scheduled_at = datetime.fromisoformat(data["scheduled_at"])

    campaign = Campaign(
        name=data["name"],
        template_id=data["template_id"],
        nonprofit_name=data["nonprofit_name"],
        nonprofit_mission=data.get("nonprofit_mission"),
        sender_name=data["sender_name"],
        sender_email=data["sender_email"],
        sender_phone=data.get("sender_phone"),
        scheduled_at=scheduled_at,
        daily_limit=data.get("daily_limit", 20),
        delay_between_emails=data.get("delay_between_emails", 60),
        status="draft",
    )
    db.session.add(campaign)
    db.session.commit()
    return jsonify(campaign.to_dict()), 201


@campaigns_bp.get("/<int:campaign_id>")
def get_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    return jsonify(campaign.to_dict())


@campaigns_bp.put("/<int:campaign_id>")
def update_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    data = request.get_json()

    if campaign.status == "running":
        return jsonify({"error": "Cannot edit a running campaign. Pause it first."}), 409

    for field in ("name", "template_id", "nonprofit_name", "nonprofit_mission",
                  "sender_name", "sender_email", "sender_phone",
                  "daily_limit", "delay_between_emails"):
        if field in data:
            setattr(campaign, field, data[field])

    if "scheduled_at" in data and data["scheduled_at"]:
        campaign.scheduled_at = datetime.fromisoformat(data["scheduled_at"])

    db.session.commit()
    return jsonify(campaign.to_dict())


@campaigns_bp.post("/<int:campaign_id>/schedule")
def schedule_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    if campaign.status == "running":
        return jsonify({"error": "Campaign is already running"}), 409

    campaign.status = "scheduled"
    db.session.commit()

    _schedule_campaign(current_app._get_current_object(), campaign)
    return jsonify({"message": "Campaign scheduled", "campaign": campaign.to_dict()})


@campaigns_bp.post("/<int:campaign_id>/pause")
def pause_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    job_id = f"campaign_{campaign.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    campaign.status = "paused"
    db.session.commit()
    return jsonify({"message": "Campaign paused", "campaign": campaign.to_dict()})


@campaigns_bp.post("/<int:campaign_id>/resume")
def resume_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    if campaign.status not in ("paused", "scheduled"):
        return jsonify({"error": "Only paused campaigns can be resumed"}), 409
    campaign.status = "scheduled"
    db.session.commit()
    _schedule_campaign(current_app._get_current_object(), campaign)
    return jsonify({"message": "Campaign resumed", "campaign": campaign.to_dict()})


@campaigns_bp.delete("/<int:campaign_id>")
def delete_campaign(campaign_id):
    campaign = db.get_or_404(Campaign, campaign_id)
    job_id = f"campaign_{campaign.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    db.session.delete(campaign)
    db.session.commit()
    return jsonify({"message": "deleted"})


@campaigns_bp.get("/<int:campaign_id>/logs")
def get_logs(campaign_id):
    db.get_or_404(Campaign, campaign_id)
    logs = OutreachLog.query.filter_by(campaign_id=campaign_id).all()
    return jsonify([log.to_dict() for log in logs])


@campaigns_bp.post("/<int:campaign_id>/add_companies")
def add_companies(campaign_id):
    """Associate a list of company IDs with this campaign (creates pending logs)."""
    campaign = db.get_or_404(Campaign, campaign_id)
    data = request.get_json()
    company_ids = data.get("company_ids", [])

    existing_ids = {log.company_id for log in campaign.outreach_logs}
    added = 0
    for cid in company_ids:
        if cid not in existing_ids:
            company = db.session.get(Company, cid)
            if company:
                log = OutreachLog(company_id=cid, campaign_id=campaign_id, status="pending")
                db.session.add(log)
                added += 1

    db.session.commit()
    return jsonify({"added": added})
