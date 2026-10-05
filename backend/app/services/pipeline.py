"""Admin data intake. Not public, and not a lender decision."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.models import Lead, LeadPurchase, User
from app.services.audit import write_audit
from app.services.leads import mask_phone, normalize_phone

SOURCES = {
    "campaign": "Digital campaign",
    "customer_db": "Existing customers",
    "partner": "Partner leads",
    "telecalling": "Telecalling data",
    "motorcart": "MotorCart finance",
    "propancer": "Propancer finance",
    "external": "External authorised dataset",
    "website": "Website product forms",
}

STEPS = ["imported", "consent", "campaign", "telecalling", "qualified", "allocated"]
ASSIGN_ROLES = {"admin", "ceo", "super_admin", "dsa", "caller", "coordinator"}


def _digits(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit())


def _tail(phone: str) -> str:
    digits = _digits(phone)
    return digits[-10:] if len(digits) >= 10 else digits


def _intake(lead: Lead) -> dict[str, Any]:
    details = lead.product_details or {}
    raw = details.get("intake")
    return dict(raw) if isinstance(raw, dict) else {}


def _save_intake(lead: Lead, intake: dict[str, Any]) -> None:
    details = dict(lead.product_details or {})
    details["intake"] = intake
    lead.product_details = details
    flag_modified(lead, "product_details")


def _find_phone(db: Session, phone: str) -> Lead | None:
    tail = _tail(phone)
    if len(tail) < 10:
        return None
    return db.query(Lead).filter(Lead.full_phone.like(f"%{tail}")).first()


def _row(lead: Lead) -> dict[str, Any]:
    intake = _intake(lead)
    return {
        "id": str(lead.id),
        "name": lead.applicant_name,
        "phone": lead.full_phone,
        "city": lead.city,
        "product": lead.loan_type,
        "source": intake.get("source") or lead.source,
        "source_label": SOURCES.get(str(intake.get("source") or lead.source or ""), lead.source or ""),
        "campaign": intake.get("campaign") or lead.utm_campaign or "",
        "stage": intake.get("stage") or "imported",
        "consent": bool(intake.get("consent")),
        "allocated_to": intake.get("allocated_to") or "",
        "marketplace": bool(lead.is_marketplace),
    }


def summary(db: Session) -> dict[str, Any]:
    leads = db.query(Lead).filter(Lead.product_details.has_key("intake")).all()
    by_source = {key: 0 for key in SOURCES}
    by_stage = {key: 0 for key in STEPS}
    for lead in leads:
        intake = _intake(lead)
        source = str(intake.get("source") or "")
        stage = str(intake.get("stage") or "")
        if source in by_source:
            by_source[source] += 1
        if stage in by_stage:
            by_stage[stage] += 1
    return {
        "total": len(leads),
        "sources": [{"key": key, "label": label, "count": by_source[key]} for key, label in SOURCES.items()],
        "stages": [{"key": key, "count": by_stage[key]} for key in STEPS],
        "oneflo": "not_connected",
    }


def list_rows(db: Session, source: str | None, stage: str | None) -> list[dict[str, Any]]:
    leads = (
        db.query(Lead)
        .filter(Lead.product_details.has_key("intake"))
        .order_by(Lead.created_at.desc())
        .limit(200)
        .all()
    )
    rows = [_row(lead) for lead in leads]
    if source:
        rows = [row for row in rows if row["source"] == source]
    if stage:
        rows = [row for row in rows if row["stage"] == stage]
    return rows


def import_rows(
    db: Session,
    actor: User,
    source: str,
    campaign: str,
    consent: bool,
    rows: list[dict[str, Any]],
) -> dict[str, Any]:
    if source not in SOURCES:
        raise ValueError("Unknown source")
    if not rows:
        raise ValueError("Add at least one row")
    if len(rows) > 50:
        raise ValueError("Import up to 50 rows at a time")

    created = 0
    duplicates = 0
    results: list[dict[str, Any]] = []
    for raw in rows:
        name = str(raw.get("name") or "").strip()
        phone = normalize_phone(str(raw.get("phone") or ""))
        if len(name) < 2 or len(_tail(phone)) < 10:
            results.append({"name": name or "—", "status": "skipped", "reason": "Name and a 10-digit phone are required"})
            continue
        existing = _find_phone(db, phone)
        if existing:
            duplicates += 1
            results.append(
                {
                    "name": name,
                    "status": "duplicate",
                    "lead_id": str(existing.id),
                    "reason": "This phone is already in the CRM",
                }
            )
            continue
        stage = "imported"
        if consent and campaign.strip():
            stage = "campaign"
        elif consent:
            stage = "consent"
        lead = Lead(
            applicant_name=name,
            full_phone=phone,
            masked_phone=mask_phone(phone),
            city=str(raw.get("city") or "").strip(),
            loan_type=str(raw.get("product") or "personal").strip() or "personal",
            product_category="loan",
            source=source,
            utm_campaign=campaign.strip() or None,
            status="available",
            is_marketplace=False,
            sale_available=False,
            price=0,
            product_details={
                "intake": {
                    "source": source,
                    "campaign": campaign.strip(),
                    "stage": stage,
                    "consent": bool(consent),
                    "consent_at": datetime.now(timezone.utc).isoformat() if consent else None,
                    "allocated_to": "",
                }
            },
        )
        db.add(lead)
        db.flush()
        created += 1
        results.append({"name": name, "status": "created", "lead_id": str(lead.id), "stage": stage})

    write_audit(
        db,
        action="pipeline.import",
        actor_user_id=actor.id,
        entity_type="pipeline",
        detail={"source": source, "created": created, "duplicates": duplicates},
    )
    db.commit()
    return {"created": created, "duplicates": duplicates, "results": results}


def intake_product_form(
    db: Session,
    name: str,
    phone: str,
    city: str,
    product: str,
    amount: float,
    email: str = "",
    income: float = 0,
    employment: str = "",
    preference: str = "",
) -> dict[str, Any]:
    """Website loan form. Shows in the CRM lead list. Does not match a lender."""
    clean_phone = normalize_phone(phone)
    if len(name.strip()) < 2 or len(_tail(clean_phone)) < 10:
        raise ValueError("Name and a 10-digit mobile are required")
    label = product.strip() or "Loan"
    existing = _find_phone(db, clean_phone)
    if existing and not existing.is_marketplace:
        existing.loan_amount = float(amount or existing.loan_amount or 0)
        if city.strip():
            existing.city = city.strip()
        if email.strip():
            existing.email = email.strip()
        if income:
            existing.monthly_income = float(income)
        if employment.strip():
            existing.employment_type = employment.strip()
        existing.product_subtype = label
        existing.loan_type = "personal" if "personal" in label.lower() else existing.loan_type
        details = dict(existing.product_details or {})
        intake = dict(details.get("intake") or {})
        intake["preference"] = preference
        details["intake"] = intake
        details["bank_preference"] = preference
        existing.product_details = details
        flag_modified(existing, "product_details")
        db.commit()
        ref = existing.website_lead_id or str(existing.id)[:8].upper()
        return {"success": True, "duplicate": True, "reference_id": ref}
    if existing:
        ref = existing.website_lead_id or str(existing.id)[:8].upper()
        return {"success": True, "duplicate": True, "reference_id": ref}
    ref = f"RD-{uuid4().hex[:8].upper()}"
    lead = Lead(
        applicant_name=name.strip(),
        full_phone=clean_phone,
        masked_phone=mask_phone(clean_phone),
        email=email.strip() or None,
        city=city.strip(),
        loan_amount=float(amount or 0),
        monthly_income=float(income) if income else None,
        employment_type=employment.strip() or None,
        loan_type="personal" if "personal" in label.lower() else label,
        product_subtype=label,
        product_category="loan",
        source="website",
        utm_campaign=label,
        website_lead_id=ref,
        status="available",
        is_marketplace=False,
        sale_available=False,
        price=0,
        score="warm",
        notes="Website application received. Bank is not contacted from this form.",
        product_details={
            "intake": {
                "source": "website",
                "campaign": label,
                "stage": "campaign",
                "consent": True,
                "consent_at": datetime.now(timezone.utc).isoformat(),
                "allocated_to": "",
                "preference": preference,
            },
            "bank_preference": preference,
        },
    )
    db.add(lead)
    write_audit(
        db,
        action="pipeline.website",
        entity_type="lead",
        entity_id=ref,
        detail={"product": label, "duplicate": False},
    )
    db.commit()
    return {"success": True, "duplicate": False, "reference_id": ref}


def advance(db: Session, actor: User, lead_id: UUID, step: str, campaign: str, assignee_email: str, note: str) -> dict[str, Any]:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead or not _intake(lead):
        raise LookupError("Pipeline lead not found")
    intake = _intake(lead)
    current = str(intake.get("stage") or "imported")
    if step not in STEPS[1:]:
        raise ValueError("Unknown step")
    expected = STEPS[STEPS.index(current) + 1] if current in STEPS and current != "allocated" else ""
    if step != expected:
        raise ValueError(f"Next step is {expected or 'none'}")
    if step != "consent" and not intake.get("consent"):
        raise ValueError("Consent is required before this step")

    if step == "consent":
        intake["consent"] = True
        intake["consent_at"] = datetime.now(timezone.utc).isoformat()
    elif step == "campaign":
        label = campaign.strip() or str(intake.get("campaign") or "")
        if not label:
            raise ValueError("Enter a campaign name")
        intake["campaign"] = label
        lead.utm_campaign = label
    elif step == "qualified":
        intake["note"] = note.strip()
    elif step == "allocated":
        email = assignee_email.strip().lower()
        assignee = db.query(User).filter(User.email == email, User.is_active.is_(True)).first()
        if not assignee or assignee.role not in ASSIGN_ROLES:
            raise ValueError("Allocate to an active admin, partner, telecaller, or coordinator")
        owned = db.query(LeadPurchase).filter(LeadPurchase.lead_id == lead.id).first()
        if owned and owned.buyer_user_id != assignee.id:
            raise ValueError("This case is already with another user")
        if not owned:
            db.add(
                LeadPurchase(
                    lead_id=lead.id,
                    buyer_user_id=assignee.id,
                    price_paid=0,
                    pipeline_stage="new",
                    notes=[
                        {
                            "at": datetime.now(timezone.utc).isoformat(),
                            "text": "Allocated from the data pipeline",
                            "by": actor.email,
                            "kind": "system",
                        }
                    ],
                )
            )
        intake["allocated_to"] = assignee.email
        lead.status = "allocated"
        lead.sale_available = False
        lead.is_marketplace = False

    intake["stage"] = step
    _save_intake(lead, intake)
    write_audit(
        db,
        action="pipeline.step",
        actor_user_id=actor.id,
        entity_type="lead",
        entity_id=str(lead.id),
        detail={"step": step, "allocated_to": intake.get("allocated_to") or ""},
    )
    db.commit()
    db.refresh(lead)
    return _row(lead)
