# SendGrid‑Lite (Self‑Hosted, Free)

A small, production‑leaning stack to **validate emails in bulk** and **send bulk campaigns**—similar to SendGrid—but fully **self‑hosted** and free.

## What you get
- **FastAPI** REST service with Swagger UI
- **Bulk CSV upload** of contacts
- **Email validation** (syntax + MX + optional SMTP probe) with concurrency & caching
- **Campaigns** (subject + HTML/Text) and **bulk sending** via **Celery** workers
- **PostgreSQL** for persistence
- **Redis** for queues
- **MailHog** for dev SMTP & inbox preview (swap to **Postfix** in prod)
- Downloadable reports and status

> ⚠️ For production sending replace MailHog with your **Postfix/Exim** SMTP. Configure **SPF, DKIM, DMARC**, rDNS, and a clean IP.

---

## Quick Start

```bash
# 1) Get code
cp .env.example .env

# (Optional) edit .env to customize sender and SMTP settings

# 2) Start stack
docker compose up -d --build

# 3) Open API docs
open http://localhost:8000/docs

# 4) Dev inbox
open http://localhost:8025      # MailHog UI
```

### Auth
Use header: `x-api-key: <API_TOKEN>` (default from `.env` is `dev-token-change-me`).

---

## Core API Flow

1. **Upload contacts** (CSV with `email` column or single column)
2. **Validate contacts** (DNS + MX + optional SMTP probe)
3. **Create campaign**
4. **Send campaign** (queued to Celery worker)
5. **Check stats**

### Example (via Swagger)
- `POST /contacts/upload` → upload CSV
- `POST /contacts/validate` → run bulk validator
- `POST /campaigns` → create (subject + html + text + from)
- `POST /campaigns/{id}/send` → enqueue messages
- `GET /campaigns/{id}/stats` → monitor
- `GET /messages` → filter by status

---

## CSV Format

```
email
alice@example.com
bob@invalid-domain.zzz
```

or

```
alice@example.com
bob@invalid-domain.zzz
```

---

## Switching to Postfix in Production

1. Replace the `mailhog` service with your SMTP **Postfix** server, or point `SMTP_HOST`, `SMTP_PORT` to it.
2. Make sure your domain has proper DNS:
   - **SPF** TXT: `v=spf1 mx a include:your-relay -all`
   - **DKIM** TXT: publish selector record that your MTA signs with
   - **DMARC** TXT: `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain`
   - **Reverse DNS**: your IP → hostname with the same HELO/EHLO
3. Warm up IPs gradually; respect rate limits.

---

## Folder Structure

```
sendgrid_lite/
├─ docker-compose.yml
├─ .env.example  # copy to .env
├─ app/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ main.py              # FastAPI app + routes
│  ├─ db.py                # SQLAlchemy session
│  ├─ models.py            # ORM entities
│  ├─ schemas.py           # Pydantic payloads
│  ├─ email_validation.py  # regex + MX + SMTP (optional)
│  ├─ tasks.py             # Celery + send mail
│  ├─ init_db.py           # creates tables on boot
│  ├─ templates/
│  │   ├─ base.html
│  │   └─ sample.html
│  └─ scripts/
│      └─ sample_contacts.csv
```

---

## Notes on Validation

- **Syntax** via `email_validator`
- **MX** via `dnspython`
- **SMTP probe** (optional): Many providers block verification (accept‑all). The result may be `UNKNOWN`—that’s normal.
- We mark contacts as: `valid`, `invalid`, or `risky` (role/disposable).

---

## License
MIT
