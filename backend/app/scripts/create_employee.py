"""Create the bank-desk employee Narender. Does not make him an RM."""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.partners import generate_temp_password

EMAIL = "narender@rupeedial.com"
NAME = "Narender"


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == EMAIL).first()
        if user:
            user.full_name = NAME
            user.role = "coordinator"
            user.is_active = True
            user.finance_level = None
            db.commit()
            print(f"exists {EMAIL} role=employee finance_level=none")
            return
        temp = generate_temp_password()
        db.add(
            User(
                email=EMAIL,
                full_name=NAME,
                password_hash=hash_password(temp),
                role="coordinator",
                is_active=True,
                finance_level=None,
            )
        )
        db.commit()
        print(f"created {EMAIL} password {temp}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
