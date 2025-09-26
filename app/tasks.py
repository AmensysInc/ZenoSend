# app/tasks.py
import os
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from sqlalchemy.orm import Session
from db import SessionLocal
from models import Message, Contact, Campaign

# -------------------------------
# Optional Celery (used if REDIS_URL is reachable)
# -------------------------------
CELERY_URL = os.getenv("REDIS_URL")  # e.g., redis://127.0.0.1:6379/0
celery_app = None
if CELERY_URL:
    try:
        from celery import Celery
        celery_app = Celery("sglite", broker=CELERY_URL, backend=CELERY_URL)
        # Proactively verify we can talk to the broker; if not, fall back.
        conn = celery_app.connection_for_read()
        conn.ensure_connection(max_retries=1)
    except Exception:
        celery_app = None  # fall back to synchronous mode

# -------------------------------
# SMTP configuration
# -------------------------------
SMTP_HOST = os.getenv("SMTP_HOST", "secure.emailsrvr.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))  # 465 for SSL, 587 for STARTTLS
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "rama.k@amensys.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "amenGOTO45@@")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() == "true"   # STARTTLS (587)
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() == "true"   # SSL (465)
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME or "no-reply@localhost")

def _send_email(to_email: str, subject: str, html: Optional[str], text: Optional[str]) -> None:
    """
    Sends a single email using the configured SMTP server.
    """
    if not html and not text:
        text = "(no content)"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    if text:
        msg.attach(MIMEText(text, "plain"))
    if html:
        msg.attach(MIMEText(html, "html"))

    # Two supported modes:
    # - SSL on connect (port 465)
    # - Plain SMTP + optional STARTTLS (port 587)
    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USERNAME:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            if SMTP_USERNAME:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())

def _send_now(message_id: int) -> None:
    """
    Synchronous path: fetch message + campaign + contact, send immediately,
    and update DB status (sent/failed).
    """
    db: Session = SessionLocal()
    try:
        message: Message = db.get(Message, message_id)
        if not message:
            return
        campaign: Campaign = db.get(Campaign, message.campaign_id)
        contact: Contact = db.get(Contact, message.contact_id)

        _send_email(
            to_email=contact.email,
            subject=campaign.subject,
            html=campaign.html_body,
            text=campaign.text_body,
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
    """
    Public entry point used by the API:
      * If Celery is available, queue the job.
      * Otherwise, send synchronously in-process.
    """
    if celery_app:
        # Send to celery worker
        celery_app.send_task("send_message_task", args=[message_id])
    else:
        # Fallback: send immediately (blocking)
        _send_now(message_id)

# If Celery is available, expose the worker task
if celery_app:
    from celery import Celery  # for type hints

    @celery_app.task(name="send_message_task", bind=True, max_retries=3, default_retry_delay=10)
    def send_message_task(self, message_id: int):
        try:
            _send_now(message_id)
        except Exception as e:
            # Exponential backoff cap ~5 min
            raise self.retry(exc=e, countdown=min(300, 10 * (2 ** self.request.retries)))
