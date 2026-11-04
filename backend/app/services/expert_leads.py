"""A customer who picks an expert on RupeeDial becomes an exclusive lead for that partner."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Lead, LeadPurchase, PartnerProfile, ProfileVisit, User
from app.plans import default_lead_price
from app.services.leads import create_lead_from_website_payload, normalize_phone


def _category(loan_type: str) -> tuple[str, str]:
    text = (loan_type or "").strip().lower()
    if "card" in text:
        return "credit_card", "credit_card"
    if "insurance" in text:
        return "insurance", "insurance"
    if "invest" in text:
        return "investment", "investment"
    return "loan", text or "personal"


def published_partner(db: Session, slug: str) -> tuple[PartnerProfile, User] | None:
    row = (
        db.query(PartnerProfile)
        .filter(
            PartnerProfile.slug == slug.lower().strip(),
            PartnerProfile.published.is_(True),
            PartnerProfile.suspended.is_(False),
        )
        .first()
    )
    if not row:
        return None
    owner = db.query(User).filter(User.id == row.owner_user_id, User.is_active.is_(True)).first()
    if not owner:
        return None
    return row, owner


def record_profile_visit(db: Session, slug: str, session_key: str) -> bool:
    found = published_partner(db, slug)
    if not found:
        return False
    row, owner = found
    key = re.sub(r"[^a-zA-Z0-9_-]", "", session_key)[:80]
    if len(key) < 8:
        return False
    exists = (
        db.query(ProfileVisit)
        .filter(ProfileVisit.slug == row.slug, ProfileVisit.session_key == key)
        .first()
    )
    if exists:
        return True
    db.add(ProfileVisit(slug=row.slug, partner_user_id=owner.id, session_key=key))
    db.commit()
    return True


def capture_expert_lead(
    db: Session,
    *,
    slug: str,
    name: str,
    mobile: str,
    loan_type: str,
    city: str,
    pincode: str,
    note: str,
) -> dict:
    found = published_partner(db, slug)
    if not found:
        raise ValueError("This expert is not available")
    profile, owner = found
    phone = normalize_phone(mobile)
    digits = re.sub(r"\D", "", phone)
    if len(digits) < 10:
        raise ValueError("Enter a 10-digit mobile number")
    category, subtype = _category(loan_type)
    price = default_lead_price(category)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = (
        db.query(Lead)
        .filter(Lead.full_phone == phone, Lead.source == "expert_profile", Lead.created_at >= since)
        .order_by(Lead.created_at.desc())
        .limit(20)
        .all()
    )
    for old in recent:
        if str((old.product_details or {}).get("expert_slug") or "") == profile.slug:
            paid = db.query(LeadPurchase).filter(LeadPurchase.lead_id == old.id).first()
            return {
                "lead_id": str(old.id),
                "price": float(old.price or price),
                "charged": bool(paid),
                "expert_name": profile.firm_name or owner.full_name,
                "duplicate": True,
            }

    lead = create_lead_from_website_payload(
        db,
        {
            "applicant_name": name.strip(),
            "full_phone": phone,
            "city": (city or profile.city or "").strip() or "Unknown",
            "loan_type": subtype,
            "product_category": category,
            "product_subtype": subtype,
            "price": price,
            "source": "expert_profile",
            "utm_source": "rupeedial",
            "utm_medium": "expert_profile",
            "utm_campaign": profile.slug,
            "is_marketplace": False,
            "sale_available": False,
            "status": "reserved",
            "pincode": re.sub(r"\D", "", pincode)[:6],
            "note": note.strip()[:500],
            "expert_slug": profile.slug,
            "reserved_for_user_id": str(owner.id),
        },
    )
    charged = _charge_owner(db, lead, owner, price)
    return {
        "lead_id": str(lead.id),
        "price": price,
        "charged": charged,
        "expert_name": profile.firm_name or owner.full_name,
        "duplicate": False,
    }


def _charge_owner(db: Session, lead: Lead, owner: User, price: float) -> bool:
    balance = float(owner.wallet_balance or 0)
    if balance < price:
        return False
    owner.wallet_balance = balance - price
    now = datetime.now(timezone.utc).isoformat()
    db.add(
        LeadPurchase(
            lead_id=lead.id,
            buyer_user_id=owner.id,
            price_paid=price,
            pipeline_stage="new",
            notes=[
                {
                    "at": now,
                    "text": f"Profile lead · ₹{price:.0f} from wallet",
                    "by": "system",
                    "kind": "expert_profile",
                }
            ],
        )
    )
    lead.status = "sold"
    lead.sale_available = False
    lead.is_marketplace = False
    db.commit()
    return True
