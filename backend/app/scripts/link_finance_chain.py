"""Connect the invoice chain.

Neeraj RM1, Ramesh RM2, Sumit Manager, Arvind Business Head, Naveen Accounts.
Every active partner points at Neeraj and Ramesh. The three later seats are one person each.
"""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User

STAFF = (
    ("neeraj@rupeedial.com", "Neeraj", "Neeraj@12345", "rm"),
    ("ramesh@rupeedial.com", "Ramesh", "Ramesh@12345", "rm"),
    ("sumit@rupeedial.com", "Sumit", "Sumit@12345", "manager"),
    ("arvind@rupeedial.com", "Arvind", "Arvind@12345", "business_head"),
    ("naveen@rupeedial.com", "Naveen", "Naveen@12345", "accounts"),
)
PARTNER_ROLES = ("dsa", "affiliate")
SINGLE_SEATS = ("manager", "business_head", "accounts")


def upsert(db, email: str, name: str, password: str, level: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            full_name=name,
            password_hash=hash_password(password),
            role="coordinator",
            is_active=True,
        )
        db.add(user)
        db.flush()
    user.full_name = name
    user.role = "coordinator"
    user.is_active = True
    user.finance_level = level
    user.password_hash = hash_password(password)
    return user


def main() -> None:
    db = SessionLocal()
    try:
        people = {email: upsert(db, email, name, password, level) for email, name, password, level in STAFF}
        neeraj = people["neeraj@rupeedial.com"]
        ramesh = people["ramesh@rupeedial.com"]
        sumit = people["sumit@rupeedial.com"]
        arvind = people["arvind@rupeedial.com"]
        naveen = people["naveen@rupeedial.com"]

        keep = {sumit.id, arvind.id, naveen.id}
        cleared = []
        for level in SINGLE_SEATS:
            for extra in db.query(User).filter(User.finance_level == level, User.id.notin_(keep)).all():
                cleared.append(f"{extra.email} was {level}")
                extra.finance_level = None

        linked = 0
        partners = db.query(User).filter(User.role.in_(PARTNER_ROLES), User.is_active.is_(True)).all()
        for partner in partners:
            if partner.id in {neeraj.id, ramesh.id, sumit.id, arvind.id, naveen.id}:
                continue
            partner.rm1_user_id = neeraj.id
            partner.rm2_user_id = ramesh.id
            linked += 1

        old_department = {
            "sales": "SALES",
            "operation": "OPS",
            "it_marketing": "ITM",
            "hr": "HR",
            "accounts": "ACC",
            "associate": None,
        }
        for row in db.query(User).all():
            if row.department in old_department:
                row.department = old_department[row.department]

        neeraj.department, neeraj.sales_grade = "SALES", "T8"
        ramesh.department, ramesh.sales_grade = "SALES", "T8"
        sumit.department, sumit.sales_grade = "SALES", "T6"
        arvind.department, arvind.sales_grade = None, "T2"
        naveen.department, naveen.sales_grade = "ACC", "AC-H"
        neeraj.reports_to_user_id = sumit.id
        ramesh.reports_to_user_id = sumit.id
        sumit.reports_to_user_id = arvind.id
        naveen.reports_to_user_id = arvind.id
        ceo = db.query(User).filter(User.role == "ceo", User.is_active.is_(True)).order_by(User.created_at.asc()).first()
        arvind.reports_to_user_id = ceo.id if ceo else None
        narender = db.query(User).filter(User.email == "narender@rupeedial.com").first()
        if narender:
            narender.department = "OPS"
            narender.sales_grade = "OP-E"
            narender.reports_to_user_id = arvind.id
        callers = 0
        for caller in db.query(User).filter(User.role == "caller", User.is_active.is_(True)).all():
            caller.department = caller.department or "SALES"
            caller.sales_grade = caller.sales_grade or "T9"
            if caller.reports_to_user_id is None:
                caller.reports_to_user_id = sumit.id
                callers += 1
        db.commit()
        print(
            "chain "
            f"rm1 {neeraj.email} rm2 {ramesh.email} "
            f"manager {sumit.email} business_head {arvind.email} accounts {naveen.email} "
            f"partners {linked} callers_linked {callers} cleared {','.join(cleared) or 'none'}"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
