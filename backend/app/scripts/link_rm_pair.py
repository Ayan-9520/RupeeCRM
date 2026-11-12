"""Neeraj is RM1 and Ramesh is RM2 for every partner. They stay employees."""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User

STAFF = (
    ("neeraj@rupeedial.com", "Neeraj", "Neeraj@12345"),
    ("ramesh@rupeedial.com", "Ramesh", "Ramesh@12345"),
)
PARTNER_ROLES = ("dsa", "affiliate")


def upsert(db, email: str, name: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, full_name=name, password_hash=hash_password(password), role="coordinator", is_active=True)
        db.add(user)
        db.flush()
    user.full_name = name
    user.role = "coordinator"
    user.is_active = True
    user.finance_level = "rm"
    user.password_hash = hash_password(password)
    return user


def main() -> None:
    db = SessionLocal()
    try:
        neeraj = upsert(db, *STAFF[0])
        ramesh = upsert(db, *STAFF[1])
        linked = 0
        partners = db.query(User).filter(User.role.in_(PARTNER_ROLES), User.is_active.is_(True)).all()
        for partner in partners:
            if partner.id in {neeraj.id, ramesh.id}:
                continue
            partner.rm1_user_id = neeraj.id
            partner.rm2_user_id = ramesh.id
            linked += 1
        db.commit()
        present = {
            level: db.query(User).filter(User.finance_level == level, User.is_active.is_(True)).count()
            for level in ("manager", "business_head", "accounts")
        }
        missing = [level for level, count in present.items() if count == 0]
        print(f"rm1 {neeraj.email} rm2 {ramesh.email} partners {linked} missing {','.join(missing) or 'none'}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
