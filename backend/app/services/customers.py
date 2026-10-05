"""Customer applications created from Check Eligibility. Not a lender BRE."""

from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Lead, User
from app.services.leads import create_lead_from_website_payload, normalize_phone
from app.services.partners import generate_temp_password

RECOMMENDED = {
    "business": ["Credit Card", "Overdraft (OD)", "Loan Against Property", "Insurance"],
    "home": ["Insurance", "Home Loan top-up", "Balance transfer"],
    "auto": ["Insurance", "Auto refinance"],
    "personal": ["Credit Card", "Insurance"],
    "card": ["Personal Loan", "Insurance"],
}


def recommended_for(product: str | None) -> list[str]:
    text = (product or "").lower()
    if any(word in text for word in ("business", "msme", "gst", "mudra", "working", "od", "cc")):
        return RECOMMENDED["business"]
    if any(word in text for word in ("home", "property", "lap")):
        return RECOMMENDED["home"]
    if any(word in text for word in ("auto", "car", "vehicle")):
        return RECOMMENDED["auto"]
    if "card" in text:
        return RECOMMENDED["card"]
    return RECOMMENDED["personal"]


def _digits(value: str | None) -> str:
    return "".join(ch for ch in (value or "") if ch.isdigit())[-10:]


def ensure_customer(db: Session, email: str, name: str, phone: str) -> str | None:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        if existing.role == "customer" and phone and not existing.phone:
            existing.phone = phone
            db.commit()
        return None
    temp = generate_temp_password()
    db.add(
        User(
            email=email.lower(),
            full_name=name or "Customer",
            password_hash=hash_password(temp),
            role="customer",
            phone=phone or None,
            is_active=True,
        )
    )
    db.commit()
    return temp


def save_eligibility_application(db: Session, payload: dict) -> tuple[Lead, str | None]:
    email = (payload.get("email") or "").strip().lower()
    phone = normalize_phone(payload.get("mobile") or payload.get("full_phone") or "")
    name = (payload.get("full_name") or payload.get("applicant_name") or "").strip()
    product = (payload.get("product") or "").strip()
    details = {
        "employment": payload.get("employment"),
        "existing_emi": payload.get("existing_emi"),
        "cibil": payload.get("cibil"),
        "requested_amount": payload.get("requested_amount"),
        "eligible_amount": payload.get("eligible_amount"),
        "interest_rate": payload.get("interest_rate"),
        "emi": payload.get("emi"),
        "selected_bank": payload.get("selected_bank"),
        "consent": True,
        "application_status": "submitted",
        "documents": payload.get("documents") or [],
    }
    lead = create_lead_from_website_payload(
        db,
        {
            "applicant_name": name,
            "full_phone": phone,
            "email": email or None,
            "city": payload.get("city") or "",
            "loan_amount": payload.get("eligible_amount") or payload.get("requested_amount") or 0,
            "monthly_income": payload.get("monthly_income"),
            "employment_type": payload.get("employment"),
            "product_category": "credit_card" if "card" in product.lower() else "loan",
            "product_subtype": product or "eligibility",
            "loan_type": product or "personal",
            "source": "eligibility",
            "status": "submitted",
            "is_marketplace": False,
            "sale_available": False,
            "price": 0,
            "product_details": details,
            "lead_id": payload.get("website_lead_id"),
        },
    )
    password = ensure_customer(db, email, name, phone) if email else None
    return lead, password


def applications_for(db: Session, user: User) -> list[dict]:
    phone = _digits(user.phone)
    filters = [Lead.email.ilike(user.email)]
    if phone:
        filters.append(Lead.full_phone.ilike(f"%{phone}"))
    rows = (
        db.query(Lead)
        .filter(or_(*filters), Lead.source == "eligibility")
        .order_by(Lead.created_at.desc())
        .limit(50)
        .all()
    )
    items = []
    for lead in rows:
        details = lead.product_details or {}
        status = str(details.get("application_status") or lead.status or "submitted")
        items.append(
            {
                "id": str(lead.id),
                "reference": lead.website_lead_id or str(lead.id)[:8],
                "product": lead.product_subtype or "Loan",
                "city": lead.city,
                "amount": float(details.get("eligible_amount") or lead.loan_amount or 0),
                "income": float(lead.monthly_income or 0),
                "lender": details.get("selected_bank") or "",
                "rate": details.get("interest_rate"),
                "emi": details.get("emi"),
                "status": status,
                "documents": details.get("documents") or [],
                "sanction": details.get("sanction_amount"),
                "disbursement": details.get("disbursement_amount"),
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
                "recommended": recommended_for(lead.product_subtype),
            }
        )
    return items
