"""One-time public cleanup: hide Forms Test, show approved partners, one marketplace lead per form."""

from __future__ import annotations

from app.db.session import SessionLocal
from app.models import Lead, LeadPurchase, PartnerProfile, User
from app.plans import default_lead_price
from app.services.partners import backfill_approved_profiles

SAMPLES = [
    ("personal-loan", "Personal Loan", "loan", "loan_personal", 500000, "salaried"),
    ("home-loan", "Home Loan", "loan", "home_loan", 2500000, "salaried"),
    ("lap-loan", "Loan Against Property", "loan", "loan_lap", 1800000, "salaried"),
    ("auto-loan", "Auto Loan", "loan", "loan_auto_new", 700000, "salaried"),
    ("msme-loan", "MSME Loan", "loan", "loan_msme", 1000000, "business-owner"),
    ("mudra-loan", "Mudra Loan", "loan", "loan_mudra", 300000, "trading"),
    ("education-loan", "Education Loan", "loan", "education_loan", 800000, "salaried"),
    ("machinery-loan", "Machinery Loan", "loan", "machinery_loan", 1500000, "business-owner"),
    ("business-loan", "Business Loan", "loan", "business-loan", 2000000, "business-owner"),
    ("bnpl", "BNPL Pay Later", "loan", "bnpl-pay-later", 20000, "salaried"),
    ("credit-card", "Credit Card", "credit_card", "credit_card", 0, "salaried"),
    ("insurance", "Health Insurance", "insurance", "insurance", 0, "salaried"),
]


def _mask(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 4:
        return phone
    return f"{digits[:2]}XXXXXX{digits[-2:]}"


def main() -> None:
    db = SessionLocal()
    try:
        created_profiles = backfill_approved_profiles(db)
        hidden = (
            db.query(PartnerProfile)
            .filter(
                (PartnerProfile.slug == "formstest")
                | (PartnerProfile.firm_name.ilike("forms test"))
            )
            .update({PartnerProfile.published: False, PartnerProfile.directory_featured: False, PartnerProfile.suspended: True}, synchronize_session=False)
        )
        shown = (
            db.query(PartnerProfile)
            .filter(
                PartnerProfile.owner_user_id.in_(
                    db.query(User.id).filter(User.is_active.is_(True), User.role.in_(("dsa", "affiliate")))
                ),
                PartnerProfile.slug != "formstest",
                PartnerProfile.firm_name.notilike("forms test"),
            )
            .update({PartnerProfile.published: True, PartnerProfile.suspended: False}, synchronize_session=False)
        )

        purchased_ids = db.query(LeadPurchase.lead_id)
        junk = db.query(Lead).filter(Lead.is_marketplace.is_(True), Lead.sale_available.is_(True), Lead.status == "available")
        removed = junk.filter(~Lead.id.in_(purchased_ids)).delete(synchronize_session=False)
        parked = junk.filter(Lead.id.in_(purchased_ids)).update(
            {Lead.is_marketplace: False, Lead.sale_available: False},
            synchronize_session=False,
        )

        added = 0
        for index, (key, label, category, subtype, amount, employment) in enumerate(SAMPLES, start=1):
            website_id = f"SAMPLE-FORM-{key}"
            if db.query(Lead.id).filter(Lead.website_lead_id == website_id).first():
                continue
            phone = f"9000000{index:03d}"
            price = default_lead_price(category)
            db.add(
                Lead(
                    applicant_name=label,
                    full_phone=phone,
                    masked_phone=_mask(phone),
                    city="New Delhi",
                    state="Delhi",
                    loan_amount=amount,
                    employment_type=employment,
                    loan_type=subtype[:40],
                    product_category=category,
                    product_subtype=subtype,
                    status="available",
                    score="warm",
                    price=price,
                    source="website",
                    utm_source="rupeedial",
                    utm_medium="sample-form",
                    is_marketplace=True,
                    sale_available=True,
                    phone_verified=False,
                    website_lead_id=website_id,
                    product_details={"sample": True, "form": key},
                    quality_factors={},
                )
            )
            added += 1
        db.commit()
        print(f"profiles_backfilled={created_profiles} hidden={hidden} shown={shown} removed={removed} parked={parked} added={added}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
