"""Add five company demo leads Sahil can give to his telecallers.

Skips a lead when that phone already exists. Does not touch partner files.
The buyer is the company admin, and the partner has no telecaller, so the
team leader's queue can assign them.
"""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models import Lead, LeadPurchase, User
from app.services.leads import mask_phone

LEADS = (
    ("Amit Khanna", "9800000101", "amit.demo@example.com", "Delhi", "Delhi", "personal", "personal-loan", 500000),
    ("Pooja Nair", "9800000102", "pooja.demo@example.com", "Mumbai", "Maharashtra", "business", "business-loan", 1200000),
    ("Rahul Das", "9800000103", "rahul.demo@example.com", "Jaipur", "Rajasthan", "home", "home-loan", 2500000),
    ("Imran Qureshi", "9800000104", "imran.demo@example.com", "Lucknow", "Uttar Pradesh", "personal", "personal-loan", 300000),
    ("Meera Iyer", "9800000105", "meera.demo@example.com", "Bengaluru", "Karnataka", "lap", "lap", 4000000),
)


def main() -> None:
    db = SessionLocal()
    try:
        buyer = db.query(User).filter(User.role == "admin", User.is_active.is_(True)).order_by(User.created_at.asc()).first()
        if not buyer:
            print("no admin")
            return
        for name, phone, email, city, state, loan_type, subtype, amount in LEADS:
            existing = db.query(Lead).filter(Lead.full_phone == phone).first()
            if existing:
                print(f"exists {name}")
                continue
            lead = Lead(
                applicant_name=name,
                full_phone=phone,
                masked_phone=mask_phone(phone),
                email=email,
                city=city,
                state=state,
                loan_amount=amount,
                loan_type=loan_type,
                product_category="loan",
                product_subtype=subtype,
                status="sold",
                score="warm",
                price=0,
                source="company-demo",
                is_marketplace=False,
                sale_available=False,
                product_details={"demo": True},
            )
            db.add(lead)
            db.flush()
            db.add(
                LeadPurchase(
                    lead_id=lead.id,
                    buyer_user_id=buyer.id,
                    price_paid=0,
                    pipeline_stage="new",
                    notes=[
                        {
                            "text": "Company demo lead for the calling team",
                            "kind": "system",
                            "by": "setup",
                        }
                    ],
                )
            )
            print(f"created {name} {city}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
