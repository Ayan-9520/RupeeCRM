"""Add five company telecallers. Does not change anyone who already has a login.

Each new caller gets a random password stored for the admin Users page.
They are not under a partner, so they only see leads an admin assigns.
"""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.partners import generate_temp_password, remember_issued_password

CALLERS = (
    "Priya Sharma",
    "Neha Verma",
    "Anjali Singh",
    "Kavita Joshi",
    "Sneha Patel",
)


def main() -> None:
    db = SessionLocal()
    try:
        manager = db.query(User).filter(User.email == "sumit@rupeedial.com").first()
        for name in CALLERS:
            first = name.split()[0].lower()
            email = f"{first}.caller@rupeedial.com"
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                print(f"exists {email}")
                continue
            password = generate_temp_password()
            user = User(
                email=email,
                full_name=name,
                password_hash=hash_password(password),
                role="caller",
                is_active=True,
                department="SALES",
                sales_grade="T9",
                reports_to_user_id=manager.id if manager else None,
            )
            db.add(user)
            db.flush()
            remember_issued_password(db, user, password)
            print(f"created {email} {password}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
