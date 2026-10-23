"""One customer name across the lead card, the workspace profile and the lead's case file."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import CustomerProfile, Lead, LeadPurchase, LoanCase


def sync_customer_name(db: Session, purchase: LeadPurchase, new_name: str | None, previous: list[str | None]) -> None:
    """Copy a renamed customer to the lead and profile. The case file follows only while it still shows an
    earlier name (or none), so a client name an admin typed on the case is kept. Caller commits."""
    name = (new_name or "").strip()[:200]
    if not name:
        return
    old = {(value or "").strip() for value in previous if (value or "").strip()}

    lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
    if lead is not None and lead.applicant_name != name:
        lead.applicant_name = name

    profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase.id).first()
    if profile is not None and (profile.full_name or "") != name:
        profile.full_name = name

    case = db.query(LoanCase).filter(LoanCase.lead_purchase_id == purchase.id).first()
    if case is not None:
        current = (case.client_name or "").strip()
        if current != name and (not current or current in old):
            case.client_name = name
