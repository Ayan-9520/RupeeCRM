"""Seed admin user if missing."""

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.joining_credit import grant_pending_joining_credits
from app.services.lead_upload import publish_admin_leads


def main() -> None:
    db = SessionLocal()
    try:
        email = settings.admin_email.lower().strip()
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"Admin already exists: {email}")
            credited = grant_pending_joining_credits(db)
            moved = publish_admin_leads(db)
            print(f"joining_credits={credited} admin_board={moved}")
            return
        user = User(
            email=email,
            full_name=settings.admin_name,
            password_hash=hash_password(settings.admin_password),
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Seeded admin: {email}")
        credited = grant_pending_joining_credits(db)
        moved = publish_admin_leads(db)
        print(f"joining_credits={credited} admin_board={moved}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
