import os, datetime, jwt
from passlib.hash import bcrypt
from passlib.context import CryptContext


JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

pwd_ctx = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(pw: str) -> str:
    return bcrypt.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.verify(pw, hashed)

def create_access_token(sub: str, role: str):
    now = datetime.datetime.utcnow()
    exp = now + datetime.timedelta(minutes=JWT_EXPIRE_MIN)
    payload = {"sub": sub, "role": role, "iat": now.timestamp(), "exp": exp.timestamp()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def decode_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
