# app/init_db.py
from db import Base, engine, SessionLocal
from models import Contact, User, RoleEnum
from sqlalchemy import text, inspect
from passlib.hash import bcrypt
from security import hash_password   # <-- add this import


def create_all():
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        insp = inspect(conn)
        # add owner_id to contacts
        cols = {c["name"] for c in insp.get_columns("contacts")}
        if "owner_id" not in cols:
            conn.execute(text("ALTER TABLE contacts ADD COLUMN owner_id INTEGER REFERENCES users(id)"))

    # seed an admin if none exists
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == RoleEnum.admin).first()
        if not admin:
            admin = User(
                email="admin@local.test",
                password_hash=bcrypt.hash("admin123"),
                role=RoleEnum.admin
            )
            db.add(admin); db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    create_all()
