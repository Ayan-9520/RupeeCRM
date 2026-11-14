"""Create Sahil, the company calling team leader, and point company telecallers at him.

Does not change passwords of people who already exist.
Does not move a telecaller who sits under a partner.
"""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User
from app.services.partners import generate_temp_password, remember_issued_password

EMAIL = "sahil.leader@rupeedial.com"


def main() -> None:
    db = SessionLocal()
    try:
        manager = db.query(User).filter(User.email == "sumit@rupeedial.com").first()
        sahil = db.query(User).filter(User.email == EMAIL).first()
        if sahil:
            print(f"exists {EMAIL}")
        else:
            password = generate_temp_password()
            sahil = User(
                email=EMAIL,
                full_name="Sahil",
                password_hash=hash_password(password),
                role="coordinator",
                is_active=True,
                department="SALES",
                sales_grade="T7",
                reports_to_user_id=manager.id if manager else None,
            )
            db.add(sahil)
            db.flush()
            remember_issued_password(db, sahil, password)
            print(f"created {EMAIL} {password}")
        sahil.role = "coordinator"
        sahil.department = "SALES"
        sahil.sales_grade = "T7"
        sahil.finance_level = None
        sahil.seat_owner_id = None
        if manager and sahil.reports_to_user_id != manager.id:
            sahil.reports_to_user_id = manager.id
        partners = {row.id for row in db.query(User).filter(User.role.in_(("dsa", "affiliate"))).all()}
        callers = db.query(User).filter(User.role == "caller").all()
        for caller in callers:
            if caller.seat_owner_id and caller.seat_owner_id in partners:
                continue
            if caller.reports_to_user_id != sahil.id:
                caller.reports_to_user_id = sahil.id
                print(f"reports {caller.email}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
