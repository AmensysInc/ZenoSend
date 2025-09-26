# app/routers/contacts.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, func
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from deps import get_db, get_current_user
from models import Contact, User
from email_validation import validate_email_record

router = APIRouter(prefix="/contacts", tags=["contacts"])

# ---------- Schemas ----------
class ContactOut(BaseModel):
    id: int
    email: EmailStr
    status: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    owner_email: Optional[str] = None
    reason: Optional[str] = None
    provider: Optional[str] = None

    class Config:
        from_attributes = True  # pydantic v2 (orm_mode=True on v1)

class ContactIn(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    linkedin_url: Optional[str] = None

class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: Optional[str] = None  # allow admin/owner to set if needed

def _row_to_out(c: Contact) -> ContactOut:
    return ContactOut(
        id=c.id,
        email=c.email,
        status=getattr(c, "status", None),
        first_name=getattr(c, "first_name", None),
        last_name=getattr(c, "last_name", None),
        linkedin_url=getattr(c, "linkedin_url", None),
        reason=getattr(c, "reason", None),
        provider=getattr(c, "provider", None),
        owner_email=c.owner.email if c.owner else None,
    )

# ---------- Routes ----------
@router.get("", response_model=List[ContactOut])
def list_contacts(
    status: Optional[str] = None,
    q: Optional[str] = Query(None, description="search email/first/last/linkedin"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Contact)
    if user.role != "admin":
        stmt = stmt.where(Contact.owner_id == user.id)
    if status:
        stmt = stmt.where(Contact.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Contact.email).like(like),
                func.lower(Contact.first_name).like(like),
                func.lower(Contact.last_name).like(like),
                func.lower(Contact.linkedin_url).like(like),
            )
        )
    rows = db.execute(stmt).scalars().all()
    return [_row_to_out(c) for c in rows]

@router.post("", response_model=ContactOut, status_code=201)
def create_contact(
    body: ContactIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    e = body.email.lower()

    # upsert: if exists, update fields; else create and stamp owner
    row = db.execute(select(Contact).where(Contact.email == e)).scalar_one_or_none()
    if not row:
        row = Contact(
            email=e,
            first_name=body.first_name,
            last_name=body.last_name,
            linkedin_url=body.linkedin_url,
            owner_id=user.id,
            status=getattr(row, "status", "new"),
        )
        db.add(row)
    else:
        # only owner or admin may change an existing record
        if user.role != "admin" and row.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        row.first_name = body.first_name or row.first_name
        row.last_name = body.last_name or row.last_name
        row.linkedin_url = body.linkedin_url or row.linkedin_url

    db.commit(); db.refresh(row)
    return _row_to_out(row)

@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int,
    body: ContactUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.get(Contact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    if user.role != "admin" and c.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if body.first_name is not None:
        c.first_name = body.first_name
    if body.last_name is not None:
        c.last_name = body.last_name
    if body.linkedin_url is not None:
        c.linkedin_url = body.linkedin_url
    if body.status is not None:
        c.status = body.status

    db.commit(); db.refresh(c)
    return _row_to_out(c)

@router.delete("/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    c = db.get(Contact, contact_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contact not found")
    if user.role != "admin" and c.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(c); db.commit()
    return

# ------- Inline validation endpoint for "Validate & Save" -------
@router.post("/validate_one")
def validate_one_api(
    payload: dict,
    use_smtp_probe: bool = Query(True, description="SMTP probe on by default"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    email = str(payload.get("email", "")).strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="email required")

    # create if missing, stamp owner
    row = db.execute(select(Contact).where(Contact.email == email)).scalar_one_or_none()
    if not row:
        row = Contact(email=email, owner_id=user.id, status="new")
        db.add(row); db.commit(); db.refresh(row)

    res = validate_email_record(email, timeout=6.0, do_smtp=use_smtp_probe)
    status_map = {"valid": "valid", "invalid": "invalid", "risky": "risky"}
    row.status   = status_map.get(res["verdict"], "unknown")
    row.reason   = res.get("reason")
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
    }
