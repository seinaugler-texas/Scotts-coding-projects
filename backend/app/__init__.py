from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv
import os

load_dotenv()

db = SQLAlchemy()
mail = Mail()
scheduler = BackgroundScheduler()

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    
    # Fix postgres:// to postgresql:// for SQLAlchemy
    database_url = os.getenv("DATABASE_URL", "sqlite:///nonprofit_outreach.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
    app.config["MAIL_USE_TLS"] = os.getenv("MAIL_USE_TLS", "True") == "True"
    app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
    app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")
    app.config["MAIL_DEFAULT_SENDER"] = os.getenv("MAIL_USERNAME")

    allowed_origins = ["http://localhost:3000"]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        allowed_origins.append(frontend_url.rstrip("/"))

    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

    db.init_app(app)
    mail.init_app(app)

    from .routes import companies_bp, templates_bp, campaigns_bp, scraper_bp
    app.register_blueprint(companies_bp, url_prefix="/api/companies")
    app.register_blueprint(templates_bp, url_prefix="/api/templates")
    app.register_blueprint(campaigns_bp, url_prefix="/api/campaigns")
    app.register_blueprint(scraper_bp, url_prefix="/api/scraper")

    with app.app_context():
        try:
            db.create_all()
        except Exception:
            pass

    if not scheduler.running:
        scheduler.start()

    return app
