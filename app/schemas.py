# app/schemas.py
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, field_validator
import re

# ---------------- Email normalization helpers ----------------
# Cleans values like "<sam@example.com>" or "  Sam@Example.COM  " → "sam@example.com"
_EMAIL_CAPTURE = re.compile(r'^[<\s]*(?P<addr>[^<>\s]+@[^<>\s]+)[>\s]*$')

def normalize_email(v):
    if v is None:
        return None
    s = str(v).strip().lower()
    m = _EMAIL_CAPTURE.match(s)
    return m.group("addr") if m else s

def normalize_email_list(values):
    if values is None:
        return None
    return [normalize_email(v) for v in values]

# ------------ Contacts ------------
class ContactIn(BaseModel):
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email: EmailStr
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _clean_email(cls, v):
        return normalize_email(v)

class ContactOut(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email: EmailStr
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    reason: Optional[str] = None
    provider: Optional[str] = None
    owner_email: Optional[str] = None

    class Config:
        from_attributes = True

    @field_validator("email", mode="before")
    @classmethod
    def _clean_email(cls, v):
        return normalize_email(v)

# ------------ Campaigns ------------
class CampaignIn(BaseModel):
    name: str
    subject: str
    from_email: EmailStr
    html_body: Optional[str] = None
    text_body: Optional[str] = None

    @field_validator("from_email", mode="before")
    @classmethod
    def _clean_from_email(cls, v):
        return normalize_email(v)

class CampaignOut(BaseModel):
    id: int
    name: str
    subject: str
    from_email: EmailStr

    class Config:
        from_attributes = True

    @field_validator("from_email", mode="before")
    @classmethod
    def _clean_from_email(cls, v):
        return normalize_email(v)

class CampaignStats(BaseModel):
    queued: int
    sent: int
    failed: int

class SendSelectedIn(BaseModel):
    contact_ids: List[int]

# ------------ Validation ------------
class ValidationRequest(BaseModel):
    use_smtp_probe: bool = False
    concurrency: int = 20
    timeout: float = 6.0

class ValidateOneIn(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def _clean_email(cls, v):
        return normalize_email(v)

class ValidationDetail(BaseModel):
    email: EmailStr
    verdict: str
    score: float
    checks: Dict[str, Any]
    provider: Optional[str] = None
    suggestion: Optional[str] = None
    reason: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _clean_email(cls, v):
        return normalize_email(v)

# ------------ Quick Compose ------------
class ComposeIn(BaseModel):
    name: str = "Quick Send"
    subject: str
    from_email: EmailStr
    html_body: Optional[str] = None
    text_body: Optional[str] = None

    to_ids: List[int] = []
    cc_ids: List[int] = []
    bcc_ids: List[int] = []

    to_extra: List[EmailStr] = []
    cc_extra: List[EmailStr] = []
    bcc_extra: List[EmailStr] = []

    validate_extras: bool = True

    @field_validator("from_email", mode="before")
    @classmethod
    def _clean_from_email(cls, v):
        return normalize_email(v)

    @field_validator("to_extra", "cc_extra", "bcc_extra", mode="before")
    @classmethod
    def _clean_lists(cls, v):
        return normalize_email_list(v)
