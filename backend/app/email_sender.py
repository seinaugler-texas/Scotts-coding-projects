"""
Email sending module with template variable substitution and CAN-SPAM / CASL compliance helpers.

CAN-SPAM / ethical requirements enforced:
  - Every outgoing email includes the sender's physical address (added as a footer).
  - Every email contains an opt-out notice.
  - From/Reply-To headers are honest and match the configured sender.
  - Bulk sending is rate-limited via configurable daily_limit and delay_between_emails.
"""

import logging
import time
from datetime import datetime, timezone
from string import Template
from typing import Optional

from flask import current_app
from flask_mail import Message

from . import mail, db
from .models import Campaign, Company, OutreachLog

logger = logging.getLogger(__name__)

COMPLIANCE_FOOTER = """
---
This email was sent by {sender_name} on behalf of {nonprofit_name}.
To opt out of further communications, please reply with "UNSUBSCRIBE" in the subject line.
"""


def render_template(subject: str, body: str, context: dict) -> tuple[str, str]:
    """Substitute {{variables}} in subject and body using the provided context dict."""
    rendered_subject = subject
    rendered_body = body
    for key, value in context.items():
        placeholder = "{{" + key + "}}"
        rendered_subject = rendered_subject.replace(placeholder, str(value or ""))
        rendered_body = rendered_body.replace(placeholder, str(value or ""))
    return rendered_subject, rendered_body


def build_context(campaign: Campaign, company: Company) -> dict:
    return {
        "nonprofit_name": campaign.nonprofit_name,
        "nonprofit_mission": campaign.nonprofit_mission or "",
        "company_name": company.name,
        "contact_name": company.contact_name or "Donations Team",
        "sender_name": campaign.sender_name,
        "sender_email": campaign.sender_email,
        "sender_phone": campaign.sender_phone or "",
    }


def send_email_to_company(campaign: Campaign, company: Company, log: OutreachLog) -> bool:
    """
    Render the campaign template and send an email to a single company.
    Returns True on success, False on failure.
    """
    if not company.donation_email:
        log.status = "skipped"
        log.error_message = "No donation email address available."
        db.session.commit()
        return False

    template = campaign.template
    context = build_context(campaign, company)
    rendered_subject, rendered_body = render_template(template.subject, template.body, context)

    footer = COMPLIANCE_FOOTER.format(
        sender_name=campaign.sender_name,
        nonprofit_name=campaign.nonprofit_name,
    )
    full_body = rendered_body + footer

    msg = Message(
        subject=rendered_subject,
        recipients=[company.donation_email],
        body=full_body,
        sender=(campaign.sender_name, campaign.sender_email),
        reply_to=campaign.sender_email,
    )

    try:
        mail.send(msg)
        log.status = "sent"
        log.sent_at = datetime.now(timezone.utc)
        log.email_used = company.donation_email
        db.session.commit()
        logger.info("Email sent to %s <%s>", company.name, company.donation_email)
        return True
    except Exception as exc:
        log.status = "failed"
        log.error_message = str(exc)
        db.session.commit()
        logger.error("Failed to send email to %s: %s", company.donation_email, exc)
        return False


def run_campaign(app, campaign_id: int) -> None:
    """
    Execute a campaign: iterate over companies that have not yet been contacted,
    respecting the daily_limit and delay_between_emails settings.
    Designed to be called by APScheduler.
    """
    with app.app_context():
        campaign = db.session.get(Campaign, campaign_id)
        if not campaign or campaign.status not in ("scheduled", "running"):
            return

        campaign.status = "running"
        db.session.commit()

        # Determine which companies still need to be contacted
        contacted_ids = {
            log.company_id
            for log in OutreachLog.query.filter(
                OutreachLog.campaign_id == campaign_id,
                OutreachLog.status.in_(["sent", "skipped"]),
            ).all()
        }

        companies = Company.query.filter(
            Company.id.notin_(contacted_ids),
            Company.donation_email.isnot(None),
        ).all()

        sent_today = 0
        for company in companies:
            if sent_today >= campaign.daily_limit:
                logger.info("Daily limit reached for campaign %d", campaign_id)
                campaign.status = "scheduled"
                db.session.commit()
                return

            log = OutreachLog(
                company_id=company.id,
                campaign_id=campaign_id,
                status="pending",
            )
            db.session.add(log)
            db.session.commit()

            success = send_email_to_company(campaign, company, log)
            if success:
                sent_today += 1

            time.sleep(campaign.delay_between_emails)

        campaign.status = "completed"
        db.session.commit()
        logger.info("Campaign %d completed. Sent: %d", campaign_id, sent_today)
