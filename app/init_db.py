# app/init_db.py
from .db import Base, engine
from .models import Contact, Campaign, Message
from sqlalchemy import text, inspect


def create_all():
    # Create all tables from SQLAlchemy models
    Base.metadata.create_all(bind=engine)

    # Safely add linkedin_url to contacts if it doesn't exist (works across DBs)
    with engine.begin() as conn:
        insp = inspect(conn)
        cols = {c["name"] for c in insp.get_columns("contacts")}
        if "linkedin_url" not in cols:
            conn.execute(text("ALTER TABLE contacts ADD COLUMN linkedin_url VARCHAR(255)"))


if __name__ == "__main__":
    create_all()
