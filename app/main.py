import os, io, csv
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_
from sqlalchemy.exc import IntegrityError
from db import get_db
from models import Contact, Campaign, Message
from schemas import (
    ContactIn, ContactOut,
    CampaignIn, CampaignOut,
    UploadResponse, ValidationRequest, CampaignStats,
    ValidateOneIn, SendSelectedIn,
    ComposeIn,   # <-- NEW
)
from email_validation import validate_email_record
from tasks import enqueue_send

API_TOKEN = os.getenv("API_TOKEN", "dev-token-change-me")

app = FastAPI(title="SendGrid-Lite API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://163.123.180.171:8080",
        "http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "x-api-key", "content-type"],
)

def require_token(x_api_key: str = Header(None)):
    if x_api_key != API_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.get("/health")
def health():
    return {"ok": True}

# ----------------- Contacts -----------------
@app.get("/contacts", response_model=List[ContactOut], dependencies=[Depends(require_token)])
def list_contacts(
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),                         # <- NEW: search
    db: Session = Depends(get_db)
):
    stmt = select(Contact)
    if status:
        stmt = stmt.where(Contact.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(
            func.lower(Contact.email).like(like),
            func.lower(Contact.first_name).like(like),
            func.lower(Contact.last_name).like(like),
            func.lower(Contact.linkedin_url).like(like),
        ))
    return db.execute(stmt).scalars().all()

@app.post("/contacts", response_model=ContactOut, dependencies=[Depends(require_token)])
def create_contact(payload: ContactIn, db: Session = Depends(get_db)):
    e = str(payload.email).lower()
    row = db.execute(select(Contact).where(Contact.email == e)).scalar_one_or_none()
    if row:
        row.first_name = payload.first_name or row.first_name
        row.last_name  = payload.last_name  or row.last_name
        row.linkedin_url = payload.linkedin_url or row.linkedin_url    # <- NEW
    else:
        row = Contact(
            email=e,
            first_name=payload.first_name,
            last_name=payload.last_name,
            linkedin_url=payload.linkedin_url,                           # <- NEW
            status="new"
        )
        db.add(row)
    db.commit(); db.refresh(row)
    return row

@app.post("/contacts/upload", response_model=UploadResponse, dependencies=[Depends(require_token)])
async def upload_contacts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore").splitlines()
    reader = csv.reader(text)

    header = next(reader, None)
    rows = []
    if header:
        lower = [h.lower().strip() for h in header]
        ei = lower.index("email") if "email" in lower else None
        fi = lower.index("first_name") if "first_name" in lower else None
        li = lower.index("last_name")  if "last_name"  in lower else None
        # accept common linkedin headers
        li_keys = ["linkedin", "linkedin_url", "linkedin profile", "linkedin_profile"]
        lni = next((lower.index(k) for k in li_keys if k in lower), None)

        for r in reader:
            if not r or ei is None or ei >= len(r): 
                continue
            email = r[ei].strip()
            fn = r[fi].strip() if fi is not None and fi < len(r) else None
            ln = r[li].strip() if li is not None and li < len(r) else None
            lurl = r[lni].strip() if lni is not None and lni < len(r) else None
            rows.append((email, fn, ln, lurl))
    else:
        for r in reader:
            if r: rows.append((r[0].strip(), None, None, None))

    inserted, skipped = 0, 0
    for e, fn, ln, lurl in rows:
        if not e: continue
        exists = db.execute(select(Contact).where(Contact.email == e)).scalar_one_or_none()
        if exists:
            if not exists.first_name and fn:  exists.first_name = fn
            if not exists.last_name and ln:   exists.last_name  = ln
            if not exists.linkedin_url and lurl: exists.linkedin_url = lurl   # <- NEW
            skipped += 1
        else:
            db.add(Contact(email=e, first_name=fn, last_name=ln, linkedin_url=lurl, status="new"))  # <- NEW
            inserted += 1
    db.commit()
    return UploadResponse(inserted=inserted, skipped=skipped)

@app.post("/contacts/validate", dependencies=[Depends(require_token)])
def bulk_validate(req: ValidationRequest, db: Session = Depends(get_db)):
    from concurrent.futures import ThreadPoolExecutor, as_completed

    targets = db.execute(select(Contact).where(Contact.status.in_(["new", "unknown", "risky"]))).scalars().all()
    if not targets:
        return {"validated": 0}

    timeout = float(req.timeout or float(os.getenv("VALIDATION_TIMEOUT", "6")))
    do_smtp = bool(req.use_smtp_probe or os.getenv("ALLOW_SMTP_PROBE", "false").lower() == "true")
    concurrency = int(req.concurrency or int(os.getenv("VALIDATION_CONCURRENCY", "20")))

    def work(c: Contact):
        res = validate_email_record(c.email, timeout=timeout, do_smtp=do_smtp)
        verdict = res["verdict"]
        status_map = {"valid":"valid","invalid":"invalid","risky":"risky"}
        return c.id, status_map.get(verdict, "unknown"), res.get("reason"), res.get("provider")

    updated = 0
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = [ex.submit(work, c) for c in targets]
        for f in as_completed(futures):
            cid, status, reason, provider = f.result()
            c = db.get(Contact, cid)
            c.status, c.reason, c.provider = status, reason, provider
            updated += 1
    db.commit()
    return {"validated": updated, "smtp_probe": do_smtp, "timeout": timeout, "concurrency": concurrency}

@app.post("/contacts/validate_one", response_model=None, dependencies=[Depends(require_token)])
def validate_one(payload: ValidateOneIn, use_smtp_probe: bool = Query(False), db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    row = db.execute(select(Contact).where(Contact.email == email)).scalar_one_or_none()
    if not row:
        row = Contact(email=email, status="new")
        db.add(row)
        try:
            db.commit(); db.refresh(row)
        except IntegrityError:
            db.rollback()
            row = db.execute(select(Contact).where(Contact.email == email)).scalar_one()

    res = validate_email_record(email, timeout=6.0, do_smtp=use_smtp_probe)
    status_map = {"valid": "valid", "invalid": "invalid", "risky": "risky"}
    row.status = status_map.get(res["verdict"], "unknown")
    row.reason = res.get("reason")
    row.provider = res.get("provider")
    db.commit()

    return {
        "id": row.id,
        "email": row.email,
        "status": row.status,
        "reason": row.reason,
        "provider": row.provider,
        "verdict": res["verdict"],
        "score": res["score"],
        "checks": res["checks"],
        "suggestion": res.get("suggestion")
    }

@app.get("/contacts/export", dependencies=[Depends(require_token)])
def export_contacts(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = select(Contact)
    if status: q = q.where(Contact.status == status)
    rows = db.execute(q).scalars().all()

    def to_csv():
        yield "id,first_name,last_name,email,linkedin_url,status,reason,provider\n"   # <- NEW header
        for r in rows:
            line = (
                f'{r.id},"{r.first_name or ""}","{r.last_name or ""}",'
                f'"{r.email}","{r.linkedin_url or ""}",{r.status},"{r.reason or ""}",{r.provider or ""}\n'
            )
            yield line

    return StreamingResponse(io.StringIO("".join(list(to_csv()))), media_type="text/csv")

# ----------------- Campaigns (UNCHANGED) -----------------
@app.post("/campaigns", response_model=CampaignOut, dependencies=[Depends(require_token)])
def create_campaign(payload: CampaignIn, db: Session = Depends(get_db)):
    c = Campaign(
        name=payload.name, subject=payload.subject, from_email=str(payload.from_email),
        html_body=payload.html_body, text_body=payload.text_body
    )
    db.add(c); db.commit(); db.refresh(c)
    return c

@app.post("/campaigns/{campaign_id}/send", dependencies=[Depends(require_token)])
def send_campaign(campaign_id: int, status_filter: str = "valid", db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if not campaign: raise HTTPException(404, "Campaign not found")
    contacts = db.execute(select(Contact).where(Contact.status == status_filter)).scalars().all()
    if not contacts:
        return {"enqueued": 0, "note": f"No contacts with status={status_filter}"}

    created = 0
    for c in contacts:
        m = Message(campaign_id=campaign_id, contact_id=c.id, status="queued")
        db.add(m); db.flush(); enqueue_send(m.id); enq += 1
    db.commit(); return {"enqueued": created}

@app.post("/campaigns/{campaign_id}/send_selected", dependencies=[Depends(require_token)])
def send_selected_contacts(campaign_id: int, payload: SendSelectedIn, db: Session = Depends(get_db)):
    camp = db.get(Campaign, campaign_id)
    if not camp: raise HTTPException(404, "Campaign not found")
    if not payload.contact_ids: return {"enqueued": 0, "note": "No contacts selected"}

    enq = 0
    for cid in payload.contact_ids:
        c = db.get(Contact, cid)
        if not c: continue
        m = Message(campaign_id=campaign_id, contact_id=cid, status="queued")
        db.add(m); db.flush(); enqueue_send(m.id); enq += 1
    db.commit(); return {"enqueued": enq}

@app.get("/campaigns/{campaign_id}/stats", response_model=CampaignStats, dependencies=[Depends(require_token)])
def campaign_stats(campaign_id: int, db: Session = Depends(get_db)):
    counts = dict(db.execute(
        select(Message.status, func.count()).where(Message.campaign_id == campaign_id).group_by(Message.status)
    ).all())
    return CampaignStats(queued=int(counts.get("queued", 0)), sent=int(counts.get("sent", 0)), failed=int(counts.get("failed", 0)))

# ----------------- Messages (UNCHANGED) -----------------
@app.get("/messages", dependencies=[Depends(require_token)])
def list_messages(status: Optional[str] = None, db: Session = Depends(get_db)):
    q = select(Message)
    if status: q = q.where(Message.status == status)
    rows = db.execute(q).scalars().all()
    return [{"id": r.id, "campaign_id": r.campaign_id, "contact_id": r.contact_id,
             "status": r.status, "error": r.error, "sent_at": str(r.sent_at) if r.sent_at else None} for r in rows]

# ----------------- NEW: Compose & Send -----------------
@app.post("/compose/send", dependencies=[Depends(require_token)])
def compose_and_send(payload: ComposeIn, db: Session = Depends(get_db)):
    camp = Campaign(
        name=payload.name,
        subject=payload.subject,
        from_email=str(payload.from_email),
        html_body=payload.html_body,
        text_body=payload.text_body,
    )
    db.add(camp); db.commit(); db.refresh(camp)

    target_ids = set(payload.to_ids + payload.cc_ids + payload.bcc_ids)

    extra_emails = set([str(x).lower() for x in (payload.to_extra + payload.cc_extra + payload.bcc_extra)])
    status_map = {"valid": "valid", "invalid": "invalid", "risky": "risky"}

    for addr in extra_emails:
        row = db.execute(select(Contact).where(Contact.email == addr)).scalar_one_or_none()
        if not row:
            row = Contact(email=addr, status="new")
            db.add(row); db.flush()
        if payload.validate_extras:
            res = validate_email_record(addr, timeout=6.0, do_smtp=False)
            row.status = status_map.get(res["verdict"], "unknown")
            row.reason = res.get("reason")
            row.provider = res.get("provider")
        target_ids.add(row.id)
    db.commit()

    if not target_ids:
        return {"campaign_id": camp.id, "selected": 0, "valid_recipients": 0, "enqueued": 0, "note": "No recipients"}

    valid_rows = db.execute(
        select(Contact).where(Contact.id.in_(list(target_ids))).where(Contact.status == "valid")
    ).scalars().all()

    enq = 0
    for c in valid_rows:
        m = Message(campaign_id=camp.id, contact_id=c.id, status="queued")
        db.add(m); db.flush(); enqueue_send(m.id); enq += 1
    db.commit()

    return {"campaign_id": camp.id, "selected": len(target_ids), "valid_recipients": len(valid_rows), "enqueued": enq}
