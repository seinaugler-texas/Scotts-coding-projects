from . import db
from datetime import datetime, timezone


class Company(db.Model):
    __tablename__ = "companies"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    website = db.Column(db.String(500))
    donation_email = db.Column(db.String(255))
    submission_form_url = db.Column(db.String(500))
    contact_name = db.Column(db.String(255))
    notes = db.Column(db.Text)
    source_url = db.Column(db.String(500))
    verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    outreach_logs = db.relationship("OutreachLog", backref="company", lazy=True,
                                    cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "website": self.website,
            "donation_email": self.donation_email,
            "submission_form_url": self.submission_form_url,
            "contact_name": self.contact_name,
            "notes": self.notes,
            "source_url": self.source_url,
            "verified": self.verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EmailTemplate(db.Model):
    __tablename__ = "email_templates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(500), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    campaigns = db.relationship("Campaign", backref="template", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "subject": self.subject,
            "body": self.body,
            "is_default": self.is_default,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Campaign(db.Model):
    __tablename__ = "campaigns"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    template_id = db.Column(db.Integer, db.ForeignKey("email_templates.id"), nullable=False)
    nonprofit_name = db.Column(db.String(255), nullable=False)
    nonprofit_mission = db.Column(db.Text)
    sender_name = db.Column(db.String(255), nullable=False)
    sender_email = db.Column(db.String(255), nullable=False)
    sender_phone = db.Column(db.String(50))
    scheduled_at = db.Column(db.DateTime)
    status = db.Column(db.String(50), default="draft")  # draft | scheduled | running | completed | paused
    daily_limit = db.Column(db.Integer, default=20)
    delay_between_emails = db.Column(db.Integer, default=60)  # seconds
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    outreach_logs = db.relationship("OutreachLog", backref="campaign", lazy=True,
                                    cascade="all, delete-orphan")

    def to_dict(self):
        sent = sum(1 for log in self.outreach_logs if log.status == "sent")
        failed = sum(1 for log in self.outreach_logs if log.status == "failed")
        return {
            "id": self.id,
            "name": self.name,
            "template_id": self.template_id,
            "nonprofit_name": self.nonprofit_name,
            "nonprofit_mission": self.nonprofit_mission,
            "sender_name": self.sender_name,
            "sender_email": self.sender_email,
            "sender_phone": self.sender_phone,
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "status": self.status,
            "daily_limit": self.daily_limit,
            "delay_between_emails": self.delay_between_emails,
            "stats": {"sent": sent, "failed": failed, "total": len(self.outreach_logs)},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OutreachLog(db.Model):
    __tablename__ = "outreach_logs"

    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey("companies.id"), nullable=False)
    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    status = db.Column(db.String(50), default="pending")  # pending | sent | failed | skipped
    sent_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    email_used = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "company_id": self.company_id,
            "campaign_id": self.campaign_id,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "error_message": self.error_message,
            "email_used": self.email_used,
        }
