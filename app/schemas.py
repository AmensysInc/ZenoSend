from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any

class ContactIn(BaseModel):
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email: EmailStr
    linkedin_url: Optional[str] = None            # <- NEW

class ContactOut(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name:  Optional[str] = None
    email: EmailStr
    linkedin_url: Optional[str] = None            # <- NEW
    status: str
    reason: Optional[str] = None
    provider: Optional[str] = None
    class Config:
        from_attributes = True

class CampaignIn(BaseModel):
    name: str
    subject: str
    from_email: EmailStr
    html_body: Optional[str] = None
    text_body: Optional[str] = None

class CampaignOut(BaseModel):
    id: int
    name: str
    subject: str
    from_email: EmailStr
    class Config:
        from_attributes = True

class UploadResponse(BaseModel):
    inserted: int
    skipped: int

class ValidationRequest(BaseModel):
    use_smtp_probe: bool = False
    concurrency: int = 20
    timeout: float = 6.0

class CampaignStats(BaseModel):
    queued: int
    sent: int
    failed: int

class ValidateOneIn(BaseModel):
    email: EmailStr

class SendSelectedIn(BaseModel):
    contact_ids: List[int]

class ValidationDetail(BaseModel):
    email: EmailStr
    verdict: str                 # valid | risky | invalid
    score: float                 # 0..1
    checks: Dict[str, Any]       # has_mx_or_a_record, is_disposable, ...
    provider: Optional[str] = None
    suggestion: Optional[str] = None
    reason: Optional[str] = None

# --- NEW: compose (From / To / CC / BCC) payload for a quick-send flow ---
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
