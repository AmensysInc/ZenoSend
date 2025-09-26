# app/routers/admin_users.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from pydantic.config import ConfigDict
from sqlalchemy.orm import Session

from deps import get_db, require_admin
from models import User, RoleEnum
from security import hash_password

router = APIRouter(prefix="/admin/users", tags=["admin:users"])

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.user

class UserOut(BaseModel):
    id: int
    email: str                 # allow anything that looks like a string
    role: RoleEnum             # keep enum type…
    # …and tell Pydantic to serialize enums as their .value ("user"/"admin")
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

@router.get("", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.id.desc()).all()

@router.post("", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = User(email=body.email, password_hash=hash_password(body.password), role=body.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
