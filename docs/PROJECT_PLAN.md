# Nonprofit Donation Outreach Automation — Project Plan

## 1. Overview

A full-stack web application that:
1. **Scrapes** company websites for publicly available donation contact info (email addresses and submission form URLs).
2. **Manages** reusable email templates with dynamic variable substitution.
3. **Runs campaigns** that automatically send donation-request emails to collected contacts on a configurable schedule.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  (React SPA – port 3000)                           │
│  Dashboard · Companies · Templates · Campaigns · Scraper    │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST JSON  /api/*
┌───────────────────────▼─────────────────────────────────────┐
│  Flask API  (port 5000)                                     │
│  /api/companies   /api/templates                            │
│  /api/campaigns   /api/scraper                              │
│                                                             │
│  APScheduler  ──►  email_sender.run_campaign()              │
│  Scraper      ──►  BeautifulSoup + requests                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
              ┌─────────▼──────────┐
              │  SQLite / Postgres  │
              │  (SQLAlchemy ORM)   │
              └────────────────────┘
```

---

## 3. Technical Requirements

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18, React Query, React Router v6 | SPA with server-state caching |
| Backend | Flask 3, Flask-SQLAlchemy, Flask-Mail | REST API + ORM + email |
| Scheduling | APScheduler 3 | Cron / date-based campaign execution |
| Scraping | requests, BeautifulSoup4, lxml | HTML parsing |
| robots.txt | robotexclusionrulesparser | Ethical compliance |
| Database | SQLite (dev) / PostgreSQL (prod) | Persistent storage |
| Container | Docker + docker-compose | Reproducible environment |

---

## 4. Data Models

### Company
| Field | Type | Notes |
|---|---|---|
| id | int PK | |
| name | str | |
| website | str | |
| donation_email | str | publicly listed email |
| submission_form_url | str | donation/sponsorship form link |
| contact_name | str | |
| notes | text | |
| source_url | str | page scraped from |
| verified | bool | manually confirmed |

### EmailTemplate
| Field | Type | Notes |
|---|---|---|
| id | int PK | |
| name | str | |
| subject | str | supports `{{variables}}` |
| body | text | supports `{{variables}}` |
| is_default | bool | |

Supported variables: `{{nonprofit_name}}`, `{{nonprofit_mission}}`, `{{company_name}}`,
`{{contact_name}}`, `{{sender_name}}`, `{{sender_email}}`, `{{sender_phone}}`

### Campaign
| Field | Type | Notes |
|---|---|---|
| id | int PK | |
| name | str | |
| template_id | FK | |
| nonprofit_name / mission | str | |
| sender_name / email / phone | str | |
| scheduled_at | datetime | null = immediate |
| status | enum | draft · scheduled · running · completed · paused |
| daily_limit | int | default 20 |
| delay_between_emails | int | seconds, default 60 |

### OutreachLog
Tracks every send attempt: `company_id`, `campaign_id`, `status`, `sent_at`, `error_message`.

---

## 5. API Reference

### Companies
| Method | Path | Description |
|---|---|---|
| GET | `/api/companies/` | List (paginated, searchable) |
| POST | `/api/companies/` | Create |
| PUT | `/api/companies/<id>` | Update |
| DELETE | `/api/companies/<id>` | Delete |
| POST | `/api/companies/bulk` | Bulk import from scraper |

### Templates
| Method | Path | Description |
|---|---|---|
| GET | `/api/templates/` | List all |
| POST | `/api/templates/` | Create |
| PUT | `/api/templates/<id>` | Update |
| DELETE | `/api/templates/<id>` | Delete |
| GET | `/api/templates/variables` | List supported `{{variables}}` |

### Campaigns
| Method | Path | Description |
|---|---|---|
| GET | `/api/campaigns/` | List all with stats |
| POST | `/api/campaigns/` | Create (status=draft) |
| PUT | `/api/campaigns/<id>` | Edit (not while running) |
| DELETE | `/api/campaigns/<id>` | Delete |
| POST | `/api/campaigns/<id>/schedule` | Schedule / start |
| POST | `/api/campaigns/<id>/pause` | Pause |
| POST | `/api/campaigns/<id>/resume` | Resume |
| GET | `/api/campaigns/<id>/logs` | Outreach log |
| POST | `/api/campaigns/<id>/add_companies` | Associate company IDs |

### Scraper
| Method | Path | Description |
|---|---|---|
| POST | `/api/scraper/scrape` | Batch scrape (max 50 URLs) |
| POST | `/api/scraper/scrape_single` | Scrape one URL |

---

## 6. Scraper Design & Ethical Constraints

1. **robots.txt** is fetched and parsed before every domain is crawled. Pages disallowed by robots.txt are skipped automatically.
2. **Crawl-Delay** headers in robots.txt are honoured; minimum delay is configurable via `SCRAPE_DELAY` env var (default 2 s).
3. **User-Agent** is descriptive so webmasters can identify and contact us.
4. **Only public data** is collected — email addresses and form links visible on public pages.
5. **Depth-limited** — the scraper follows at most 3 internal "donation"-related links per domain to avoid excessive load.
6. **No personal data** — the scraper targets organisational contact addresses, not individual personal data.

---

## 7. Email Compliance (CAN-SPAM / CASL)

Every outbound email automatically includes:
- Honest `From` and `Reply-To` headers matching the configured sender.
- An **opt-out / unsubscribe notice** in the footer.
- The sender's name and nonprofit identification.

Additional recommended practices:
- Keep `daily_limit` ≤ 50 to avoid spam classification.
- Verify email addresses before adding them to a campaign (`verified` flag on Company).
- Maintain an internal suppression list (planned enhancement).

---

## 8. Development Timeline

| Week | Milestone |
|---|---|
| 1 | Project scaffold, data models, DB migrations, basic CRUD APIs |
| 2 | Scraper module — robots.txt compliance, email/form extraction |
| 3 | Email sender module, template variable rendering, SMTP integration |
| 4 | APScheduler campaign runner, pause/resume, daily-limit logic |
| 5 | React frontend — Dashboard, Companies, Templates pages |
| 6 | React frontend — Campaigns page, Scraper page |
| 7 | Docker compose, end-to-end testing, bug fixes |
| 8 | Documentation, ethical-use review, production hardening |

---

## 9. Potential Challenges & Solutions

| Challenge | Solution |
|---|---|
| Dynamic JS-rendered pages | Add optional Playwright headless-browser scraping for JS-heavy sites |
| Email deliverability | Use transactional ESP (SendGrid / Mailgun) via SMTP relay instead of raw SMTP |
| Rate-limiting / IP blocks | Honour robots.txt; per-domain delays; optional proxy rotation |
| Duplicate companies | Unique constraint on `(name, website)`; bulk import deduplicates |
| Anti-spam compliance | Auto-append compliance footer; unsubscribe link; honest headers |
| Database scalability | Swap SQLite for PostgreSQL via `DATABASE_URL` env var, no code changes needed |

---

## 10. Getting Started

```bash
# 1. Copy and fill in environment variables
cp backend/.env.example backend/.env

# 2. Start everything with Docker Compose
docker-compose up --build

# 3. Or run individually:
cd backend && pip install -r requirements.txt && python run.py
cd frontend && npm install && npm start
```

Open http://localhost:3000 in your browser.
