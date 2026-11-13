"""Add the two empty company seats and put Rakesh Gupta back to New.

Rishika is the telecaller. Vijay is the CEO. Does not change anyone else's password.
Run once. A second run resets Rakesh Gupta to New again.
"""

from __future__ import annotations

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import CustomerLosPipeline, Lead, LeadPurchase, LoanCase, PayoutRequest, User

SEATS = (
    ("rishika@rupeedial.com", "Rishika", "Rishika@12345", "caller", "SALES", "T9"),
    ("vijay@rupeedial.com", "Vijay", "Vijay@12345", "ceo", None, "T1"),
)


def upsert(db, email: str, name: str, password: str, role: str, department: str | None, grade: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(email=email, full_name=name, password_hash=hash_password(password), role=role, is_active=True)
        db.add(user)
        db.flush()
    user.full_name = name
    user.role = role
    user.is_active = True
    user.finance_level = None
    user.department = department
    user.sales_grade = grade
    user.password_hash = hash_password(password)
    return user


def rewind_rakesh(db) -> None:
    leads = db.query(Lead).filter(Lead.applicant_name.ilike("%Rakesh Gupta%")).all()
    purchases = (
        db.query(LeadPurchase).filter(LeadPurchase.lead_id.in_([row.id for row in leads])).all() if leads else []
    )
    taken: set[str] = set()
    for invoice in db.query(PayoutRequest).all():
        for case_id in (invoice.bank_snapshot or {}).get("case_ids") or []:
            taken.add(str(case_id))
    if not purchases:
        print("rakesh none")
        return
    reset = 0
    for purchase in purchases:
        if str(purchase.id) in taken:
            print(f"rakesh invoiced {purchase.id}")
            continue
        purchase.pipeline_stage = "new"
        purchase.converted = False
        purchase.next_followup_at = None
        purchase.deal_value = None
        purchase.notes = []
        for case in (
            db.query(LoanCase)
            .filter(LoanCase.lead_purchase_id == purchase.id, LoanCase.client_name.ilike("%Rakesh Gupta%"), LoanCase.payout_status != "paid")
            .all()
        ):
            db.delete(case)
        for pipeline in db.query(CustomerLosPipeline).filter(CustomerLosPipeline.lead_purchase_id == purchase.id).all():
            pipeline.current_stage = "lead_purchased"
        reset += 1
        print(f"rakesh new {purchase.id}")
    print(f"rakesh reset {reset}")


def main() -> None:
    db = SessionLocal()
    try:
        people = {email: upsert(db, email, name, password, role, department, grade) for email, name, password, role, department, grade in SEATS}
        rishika = people["rishika@rupeedial.com"]
        vijay = people["vijay@rupeedial.com"]
        sumit = db.query(User).filter(User.email == "sumit@rupeedial.com").first()
        arvind = db.query(User).filter(User.email == "arvind@rupeedial.com").first()
        rishika.reports_to_user_id = sumit.id if sumit else None
        vijay.reports_to_user_id = None
        if arvind:
            arvind.reports_to_user_id = vijay.id
        rewind_rakesh(db)
        db.commit()
        print("ready rishika@rupeedial.com Rishika@12345 employee-login")
        print("ready vijay@rupeedial.com Vijay@12345 employee-login")
        print(f"rishika reports {sumit.full_name if sumit else 'nobody'} vijay above {arvind.full_name if arvind else 'nobody'}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
