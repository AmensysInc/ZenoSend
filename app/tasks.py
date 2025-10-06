# app/tasks.py
import os
import smtplib
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from sqlalchemy.orm import Session
from db import SessionLocal
from models import Message, Contact, Campaign

# -------------------------------
# Logging
# -------------------------------
log = logging.getLogger("mailer")
if not log.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# -------------------------------
# Optional Celery (used if REDIS_URL is reachable)
# -------------------------------
CELERY_URL = os.getenv("REDIS_URL")
celery_app = None
if CELERY_URL:
    try:
        from celery import Celery
        celery_app = Celery("sglite", broker=CELERY_URL, backend=CELERY_URL)
        conn = celery_app.connection_for_read()
        conn.ensure_connection(max_retries=1)
        log.info("Celery enabled (broker=%s)", CELERY_URL)
    except Exception as e:
        log.warning("Celery disabled, falling back to sync send. Reason: %s", e)
        celery_app = None

# -------------------------------
# SendGrid Web API (primary)
# -------------------------------
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, ReplyTo, Content
from python_http_client.exceptions import BadRequestsError

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "").strip()
SENDGRID_EU = os.getenv("SENDGRID_EU", "false").lower() == "true"
VERIFIED_FROM = os.getenv("VERIFIED_FROM", os.getenv("SMTP_FROM", "no-reply@localhost")).strip()
FALLBACK_TO_VERIFIED_FROM = os.getenv("FALLBACK_TO_VERIFIED_FROM", "true").lower() == "true"

# -------------------------------
# SMTP config (fallback if no API key)
# -------------------------------
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.sendgrid.net")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
SMTP_FROM_FALLBACK = os.getenv("SMTP_FROM", "no-reply@localhost")
SMTP_ENVELOPE_FROM = os.getenv("SMTP_ENVELOPE_FROM", "")

# -------------------------------
# Send via SendGrid Web API
# -------------------------------
def _send_via_sendgrid_api(
    to_email: str,
    subject: str,
    html: Optional[str],
    text: Optional[str],
    requested_from: Optional[str],
) -> None:
    """
    Try with the user-typed From (must be verified in SendGrid).
    If SendGrid rejects with "not a verified sender", optionally retry
    using VERIFIED_FROM and set Reply-To to the user's address.
    """
    host = "https://api.eu.sendgrid.com" if SENDGRID_EU else "https://api.sendgrid.com"
    sg = SendGridAPIClient(SENDGRID_API_KEY, host=host)

    def build(from_addr: str, reply_to_addr: Optional[str]) -> Mail:
        m = Mail(from_email=Email(from_addr), to_emails=[To(to_email)], subject=subject)
        if html:
            m.add_content(Content("text/html", html))
        else:
            m.add_content(Content("text/plain", text or "(no content)"))
        if reply_to_addr:
            m.reply_to = ReplyTo(reply_to_addr)
        return m

    user_from = (requested_from or "").strip() or VERIFIED_FROM

    try:
        resp = sg.client.mail.send.post(request_body=build(user_from, None).get())
        if resp.status_code != 202:
            raise RuntimeError(f"SendGrid API error {resp.status_code}: {resp.body}")
        log.info("[SG] 202 Accepted with From=%s -> %s", user_from, to_email)
        return

    except BadRequestsError as e:
        body = getattr(e, "body", b"")
        body_txt = body.decode(errors="ignore") if isinstance(body, (bytes, bytearray)) else str(body)
        unverified = "verified sender identity" in body_txt.lower() or "from address does not match" in body_txt.lower()

        if unverified and FALLBACK_TO_VERIFIED_FROM and VERIFIED_FROM and user_from.lower() != VERIFIED_FROM.lower():
            log.warning("[SG] From not verified (%s). Falling back to VERIFIED_FROM=%s with Reply-To=%s",
                        user_from, VERIFIED_FROM, user_from)
            resp2 = sg.client.mail.send.post(request_body=build(VERIFIED_FROM, user_from).get())
            if resp2.status_code != 202:
                raise RuntimeError(f"SendGrid fallback error {resp2.status_code}: {resp2.body}")
            log.info("[SG] 202 Accepted (fallback) From=%s Reply-To=%s -> %s",
                     VERIFIED_FROM, user_from, to_email)
            return

        # If it's a different 400, surface it
        raise

# -------------------------------
# Unified send entry (API first, SMTP fallback)
# -------------------------------
def _send_email(
    to_email: str,
    subject: str,
    html: Optional[str],
    text: Optional[str],
    from_header: Optional[str],
    envelope_from: Optional[str],
) -> None:
    """
    If SENDGRID_API_KEY is present, use the Web API (preferred).
    Otherwise, use SMTP (your existing logic).
    """
    if SENDGRID_API_KEY:
        return _send_via_sendgrid_api(
            to_email=to_email,
            subject=subject,
            html=html,
            text=text,
            requested_from=(from_header or "").strip(),
        )

    # ---- SMTP fallback (unchanged logic) ----
    if not html and not text:
        text = "(no content)"

    hdr_from = (from_header or "").strip() or SMTP_FROM_FALLBACK
    env_from = (envelope_from or "").strip() or hdr_from

    log.info("[SMTP] preparing -> To=%s | From(hdr)=%s | From(env)=%s | Host=%s:%s TLS=%s SSL=%s",
             to_email, hdr_from, env_from, SMTP_HOST, SMTP_PORT, SMTP_USE_TLS, SMTP_USE_SSL)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = hdr_from
    msg["To"] = to_email
    if text:
        msg.attach(MIMEText(text, "plain"))
    if html:
        msg.attach(MIMEText(html, "html"))

    try:
        if SMTP_USE_SSL:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
                server.set_debuglevel(1)
                if SMTP_USERNAME:
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                resp = server.sendmail(env_from, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.set_debuglevel(1)
                server.ehlo()
                if SMTP_USE_TLS:
                    server.starttls()
                    server.ehlo()
                if SMTP_USERNAME:
                    server.login(SMTP_USERNAME, SMTP_PASSWORD)
                resp = server.sendmail(env_from, [to_email], msg.as_string())

        if resp:
            log.error("SMTP returned per-recipient errors: %s", resp)
            raise smtplib.SMTPDataError(500, b"Per-recipient errors")
        log.info("[SMTP] sent -> To=%s | From(hdr)=%s | From(env)=%s", to_email, hdr_from, env_from)

    except smtplib.SMTPDataError as e:
        log.error("SMTPDataError while sending to %s: %s %s", to_email, e.smtp_code, e.smtp_error)
        raise
    except Exception as e:
        log.error("Unexpected SMTP error while sending to %s: %r", to_email, e)
        raise

# -------------------------------
# Worker flow
# -------------------------------
def _send_now(message_id: int) -> None:
    """
    Fetch message + campaign + contact, send, and update DB status.
    """
    db: Session = SessionLocal()
    try:
        message: Message = db.get(Message, message_id)
        if not message:
            log.warning("Message id %s not found", message_id)
            return
        campaign: Campaign = db.get(Campaign, message.campaign_id)
        contact: Contact = db.get(Contact, message.contact_id)

        visible_from = (campaign.from_email or "").strip() or SMTP_FROM_FALLBACK
        # Envelope From is irrelevant for Web API; kept for SMTP fallback
        envelope_from = (SMTP_ENVELOPE_FROM or visible_from).strip()

        _send_email(
            to_email=contact.email,
            subject=campaign.subject,
            html=campaign.html_body,
            text=campaign.text_body,
            from_header=visible_from,
            envelope_from=envelope_from,
        )

        message.status = "sent"
        message.sent_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as e:
        db.rollback()
        message = db.get(Message, message_id)
        if message:
            message.status = "failed"
            message.error = f"{type(e).__name__}: {e}"
            db.commit()
        raise
    finally:
        db.close()

def enqueue_send(message_id: int) -> None:
    if celery_app:
        celery_app.send_task("send_message_task", args=[message_id])
    else:
        _send_now(message_id)

if celery_app:
    from celery import Celery  # type hints

    @celery_app.task(name="send_message_task", bind=True, max_retries=3, default_retry_delay=10)
    def send_message_task(self, message_id: int):
        try:
            _send_now(message_id)
        except Exception as e:
            raise self.retry(exc=e, countdown=min(300, 10 * (2 ** self.request.retries)))
