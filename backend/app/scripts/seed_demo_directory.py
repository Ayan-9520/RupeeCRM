"""Demo expert cards from the DSA sheet. Login stays off. Delete only these rows."""

from __future__ import annotations

import secrets
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import PartnerProfile, User
from app.services.partners import _slugify

MARK = "demo_directory"
EMAIL_DOMAIN = "rupeedial.invalid"

ROWS = [
    ("Instant Loans", "Instant Loans", "Naraina Vihar", "Delhi", "", "Personal Loan Agents, Personal Loan Providers, Business Loan Services, Home Loan Services"),
    ("My Credit Bazar", "My Credit Bazar", "Lakshmi Nagar", "Delhi", "", "Personal Loan Agents, Business Loans, Home Loans, Loan Against Property"),
    ("Tiny Loan", "Tiny Loan", "Bhikaji Cama Place", "Delhi", "", "Personal Loan Agents, Financial Services, Business Loan Services, Personal Loan Providers"),
    ("Early Credit", "Early Credit", "Bhikaji Cama Place", "Delhi", "110066", "Personal Loan Agents, Personal Loan Lenders, Agents"),
    ("AS Marketing and Sales", "AS Marketing and Sales", "Uttam Nagar", "Delhi", "110059", "Personal Loan Agents, Business Loans, Personal Loans, Agents"),
    ("JBBK Loan Seva", "JBBK Loan Seva", "Saket", "Delhi", "", "Personal Loan Agents, Personal Loan Lenders, Home Loans, Car Loans, Business Loans, Loan Against Property"),
    ("Pushpa Capital Services", "Pushpa Capital Services", "Laxmi Bai Nagar", "Delhi", "110092", "Finance Solutions, Home Loans, Car Loans, Personal Loans, Insurance Consultants"),
    ("North East Region Finance Services Limited", "North East Region Finance Services Limited", "Vikas Puri", "Delhi", "", "Financial Services"),
    ("Royal Services", "Royal Services", "Gurugram", "Haryana", "", "exact product to confirm"),
    ("Care 2 Earn Services", "Care 2 Earn Services", "Gurugram", "Haryana", "", "exact product to confirm"),
    ("Akshay Kumar (CP)", "Akshay Kumar (CP)", "Gurugram", "Haryana", "", "exact product to confirm"),
    ("Sbj Bpo Services Pvt Ltd", "Sbj Bpo Services Pvt Ltd", "Gurugram", "Haryana", "", "exact product to confirm"),
    ("Home Shed", "Home Shed", "Noida", "Uttar Pradesh", "", "exact product to confirm"),
    ("Generation Next BPO Services", "Generation Next BPO Services", "Noida", "Uttar Pradesh", "", "exact product to confirm"),
]


def _products(text: str) -> list[str]:
    low = text.lower()
    if "exact product" in low:
        return ["Loan services"]
    found: list[str] = []
    for key, label in (
        ("credit card", "Credit Card"),
        ("against property", "Loan Against Property"),
        ("home", "Home Loan"),
        ("car", "Car Loan"),
        ("personal", "Personal Loan"),
        ("business", "Business Loan"),
        ("msme", "MSME Loan"),
    ):
        if key in low and label not in found:
            found.append(label)
    if not found:
        return [(text.split(",")[0].strip() or "Loan services")[:40]]
    return found[:6]


def _delete(db) -> None:
    users = db.query(User).filter(User.email.like(f"demo.directory.%@{EMAIL_DOMAIN}")).all()
    removed = 0
    for user in users:
        profile = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == user.id).first()
        if profile is None or not (profile.theme or {}).get(MARK):
            continue
        db.delete(profile)
        db.delete(user)
        removed += 1
    db.commit()
    print(f"removed {removed} demo expert cards")


def _seed(db) -> None:
    added = skipped = 0
    for contact, firm, city, state, pin, products in ROWS:
        slug = _slugify(firm)
        email = f"demo.directory.{slug}@{EMAIL_DOMAIN}"
        if db.query(User).filter(User.email == email).first():
            skipped += 1
            continue
        base = slug
        n = 2
        while db.query(PartnerProfile).filter(PartnerProfile.slug == slug).first():
            slug = f"{base}{n}"[:40]
            n += 1
        user = User(
            email=email,
            full_name=contact[:120],
            password_hash=hash_password(secrets.token_urlsafe(32)),
            role="dsa",
            is_active=False,
            plan_status="none",
            payout_bank={},
            hr_profile={},
        )
        db.add(user)
        db.flush()
        labels = _products(products)
        db.add(
            PartnerProfile(
                owner_user_id=user.id,
                firm_name=firm[:200],
                slug=slug,
                tagline=f"Loan services in {city}.",
                city=city[:120],
                state=state[:120],
                email=email,
                products=labels,
                theme={
                    "pincode": pin,
                    "years": "",
                    "designation": "Loan Agent / DSA",
                    "show_phone": False,
                    "show_whatsapp": False,
                    MARK: True,
                },
                published=True,
                directory_featured=False,
                suspended=False,
            )
        )
        added += 1
    db.commit()
    print(f"added {added} demo expert cards, skipped {skipped}")


def main() -> None:
    db = SessionLocal()
    try:
        if "--delete" in sys.argv:
            _delete(db)
        else:
            _seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
