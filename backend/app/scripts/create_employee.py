"""Create the bank-desk employee Narender. Does not make him an RM."""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User

EMAIL = "narender@rupeedial.com"
NAME = "Narender"
PASSWORD = "Narender@12345"


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == EMAIL).first()
        if user:
            user.full_name = NAME
            user.role = "coordinator"
            user.is_active = True
            user.finance_level = None
            user.department = "OPS"
            user.sales_grade = "OP-E"
            user.password_hash = hash_password(PASSWORD)
            db.commit()
            print(f"ready {EMAIL} password {PASSWORD}")
            return
        db.add(
            User(
                email=EMAIL,
                full_name=NAME,
                password_hash=hash_password(PASSWORD),
                role="coordinator",
                is_active=True,
                finance_level=None,
                department="OPS",
                sales_grade="OP-E",
            )
        )
        db.commit()
        print(f"created {EMAIL} password {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
