"""Business loan 360 — website quick check + caller case workspace (rule engine, no AI)."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_current_user
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.models import Lead, User
from app.services.business_engine import FACILITIES, assess_business
from app.services.leads import mask_phone, normalize_phone

public_router = APIRouter(prefix="/api/public/business", tags=["business-public"])
router = APIRouter(prefix="/api/business", tags=["business"])

STAFF_ROLES = {"admin", "ceo", "super_admin", "caller", "coordinator"}
STAGES = ["quick_check", "business_data", "documents", "assessment", "loan_options", "lenders", "applied"]
DOC_STATUSES = {"pending", "received", "verified", "not_applicable"}
CASE_PREFIX = "BIZ-"


def require_staff(user: User = Depends(get_current_user)) -> User:
    if user.role not in STAFF_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Staff only")
    return user


class QuickCheckIn(BaseModel):
    mobile: str
    email: str | None = None
    contact_name: str | None = None
    company_name: str = Field(min_length=2, max_length=200)
    constitution: str | None = None
    pan: str | None = None
    gstin: str | None = None
    cin: str | None = None
    udyam_number: str | None = None
    vintage_years: float = Field(ge=0, le=100)
    annual_turnover: float = Field(gt=0)
    sector: str | None = None
    industry: str | None = None
    business_nature: str | None = None
    enterprise_size: str | None = None
    company_stage: str | None = None
    promoter_category: str | None = None
    facility: str = "term_loan"
    required_amount: float = Field(gt=0)
    collateral: str | None = None
    udyam_registered: str | None = None
    gst_regularity: str | None = None
    state: str | None = None
    city: str | None = None
    export_share: float | None = Field(default=None, ge=0, le=100)
    top_customer_share: float | None = Field(default=None, ge=0, le=100)
    existing_loans: str | None = None
    existing_emi: float | None = Field(default=None, ge=0)
    preferred_banks: list[str] = Field(default_factory=list)
    consent: bool = False
    website: str | None = None  # honeypot — must stay empty
    utm_source: str | None = None


class CasePatchIn(BaseModel):
    quick: dict[str, Any] | None = None
    data: dict[str, Any] | None = None
    financials: dict[str, Any] | None = None
    documents: dict[str, dict[str, Any]] | None = None
    stage: str | None = None
    selected_lenders: list[str] | None = None
    applied_to: list[dict[str, Any]] | None = None
    note: str | None = None
    is_marketplace: bool | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_case_id() -> str:
    return f"{CASE_PREFIX}{datetime.now(timezone.utc):%y%m%d}-{secrets.randbelow(90000) + 10000}"


def _clean_quick(body: QuickCheckIn) -> dict[str, Any]:
    data = body.model_dump(exclude={"consent", "website", "utm_source"})
    data["mobile"] = re.sub(r"\D", "", data["mobile"])[-10:]
    for k in ("pan", "gstin", "cin", "udyam_number"):
        if data.get(k):
            data[k] = str(data[k]).strip().upper()
    if data["facility"] not in FACILITIES:
        data["facility"] = "term_loan"
    data["preferred_banks"] = [b for b in data.get("preferred_banks") or [] if isinstance(b, str)][:15]
    return {k: v for k, v in data.items() if v not in (None, "", [])}


def _lead_score_price(eligible: float, grade: str) -> tuple[str, float]:
    if eligible >= 25 * 100_000 and grade in {"A", "B"}:
        return "hot", 299
    if eligible >= 5 * 100_000:
        return "warm", 199
    return "cold", 149


def _sync_lead_columns(lead: Lead, biz: dict[str, Any]) -> None:
    merged: dict[str, Any] = {}
    for section in ("quick", "data"):
        merged.update({k: v for k, v in (biz.get(section) or {}).items() if v not in (None, "")})
    if merged.get("contact_name") or merged.get("company_name"):
        lead.applicant_name = str(merged.get("contact_name") or merged.get("company_name"))[:200]
    if merged.get("company_name"):
        lead.company_name = str(merged["company_name"])[:200]
    if merged.get("email"):
        lead.email = str(merged["email"])[:255]
    if merged.get("city"):
        lead.city = str(merged["city"])[:120]
    if merged.get("state"):
        lead.state = str(merged["state"])[:120]
    if merged.get("required_amount"):
        try:
            lead.loan_amount = float(merged["required_amount"])
        except (TypeError, ValueError):
            pass
    facility = merged.get("facility")
    if facility in FACILITIES:
        lead.product_subtype = f"business_{facility}"


def _save_business(lead: Lead, biz: dict[str, Any]) -> None:
    biz["assessment"] = assess_business(biz)
    eligible = biz["assessment"]["summary"]["eligible_amount"]
    grade = biz["assessment"]["risk"]["grade"]
    score, price = _lead_score_price(eligible, grade)
    if lead.status != "sold":
        lead.score = score
        lead.price = price
    details = dict(lead.product_details or {})
    quick = biz.get("quick") or {}
    details.update({
        "business": biz,
        "form_source": "business_360",
        "lead_id": biz["case_id"],
        "company_name": quick.get("company_name"),
        "facility": FACILITIES.get(quick.get("facility", ""), {}).get("label"),
        "annual_turnover": quick.get("annual_turnover"),
        "eligible_amount": eligible,
        "risk_grade": grade,
    })
    lead.product_details = details
    flag_modified(lead, "product_details")


def _case_out(lead: Lead) -> dict[str, Any]:
    biz = (lead.product_details or {}).get("business") or {}
    return {
        "id": str(lead.id),
        "case_id": lead.website_lead_id,
        "applicant_name": lead.applicant_name,
        "company_name": lead.company_name,
        "full_phone": lead.full_phone,
        "email": lead.email,
        "city": lead.city,
        "state": lead.state,
        "loan_amount": lead.loan_amount,
        "status": lead.status,
        "score": lead.score,
        "is_marketplace": lead.is_marketplace,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
        "business": biz,
    }


def _summary_out(lead: Lead) -> dict[str, Any]:
    biz = (lead.product_details or {}).get("business") or {}
    a = biz.get("assessment") or {}
    quick = biz.get("quick") or {}
    return {
        "id": str(lead.id),
        "case_id": lead.website_lead_id,
        "applicant_name": lead.applicant_name,
        "company_name": lead.company_name,
        "full_phone": lead.full_phone,
        "city": lead.city,
        "facility": FACILITIES.get(quick.get("facility", ""), {}).get("label"),
        "required_amount": quick.get("required_amount"),
        "eligible_amount": (a.get("summary") or {}).get("eligible_amount"),
        "grade": (a.get("risk") or {}).get("grade"),
        "stage": biz.get("stage", "quick_check"),
        "status": lead.status,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
    }


def _find_case(db: Session, ref: str) -> Lead:
    ref = ref.strip()
    lead: Lead | None = None
    if ref.upper().startswith(CASE_PREFIX):
        lead = db.query(Lead).filter(func.upper(Lead.website_lead_id) == ref.upper()).first()
    else:
        try:
            lead = db.query(Lead).filter(Lead.id == UUID(ref)).first()
        except ValueError:
            lead = None
    if not lead or not (lead.website_lead_id or "").upper().startswith(CASE_PREFIX):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business case not found")
    return lead


@public_router.post("/assess")
def public_assess(body: dict[str, Any], request: Request) -> dict[str, Any]:
    """Instant indicative result — nothing stored."""
    check_rate_limit(request, limit=60, window_sec=60)
    return assess_business({"quick": body})


@public_router.post("/cases")
def public_create_case(body: QuickCheckIn, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    check_rate_limit(request, limit=8, window_sec=60)
    if body.website:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid submission")
    if not body.consent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consent is required")
    mobile = re.sub(r"\D", "", body.mobile)[-10:]
    if not re.fullmatch(r"[6-9]\d{9}", mobile):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid 10-digit mobile number")

    quick = _clean_quick(body)
    phone = normalize_phone(mobile)
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    lead = (
        db.query(Lead)
        .filter(Lead.full_phone == phone, Lead.website_lead_id.like(f"{CASE_PREFIX}%"), Lead.created_at >= since)
        .order_by(Lead.created_at.desc())
        .first()
    )

    if lead:
        biz = dict((lead.product_details or {}).get("business") or {})
        biz["quick"] = {**(biz.get("quick") or {}), **quick}
        biz.setdefault("history", []).append({"at": _now(), "by": "customer", "action": "Quick check re-submitted on website"})
    else:
        case_id = _new_case_id()
        while db.query(Lead.id).filter(Lead.website_lead_id == case_id).first():
            case_id = _new_case_id()
        biz = {
            "case_id": case_id,
            "stage": "quick_check",
            "completed": ["quick_check"],
            "quick": quick,
            "data": {},
            "financials": {},
            "documents": {},
            "selected_lenders": [],
            "applied_to": [],
            "notes": [],
            "history": [{"at": _now(), "by": "customer", "action": "Quick check submitted on website"}],
        }
        lead = Lead(
            applicant_name=(quick.get("contact_name") or quick["company_name"])[:200],
            full_phone=phone,
            masked_phone=mask_phone(phone),
            email=quick.get("email"),
            city=quick.get("city") or quick.get("state") or "Unknown",
            state=quick.get("state"),
            loan_amount=float(quick["required_amount"]),
            employment_type="Business owner",
            company_name=quick["company_name"][:200],
            loan_type="business",
            product_category="loan",
            product_subtype=f"business_{quick['facility']}",
            status="available",
            source="website",
            utm_source=body.utm_source,
            is_marketplace=True,
            sale_available=True,
            website_lead_id=case_id,
            raw_payload={"form": "business_360"},
            product_details={},
        )
        db.add(lead)

    _sync_lead_columns(lead, biz)
    _save_business(lead, biz)
    db.commit()
    db.refresh(lead)
    return {"success": True, "case_id": lead.website_lead_id, "assessment": biz["assessment"]}


@router.get("/cases")
def list_cases(
    q: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
) -> dict[str, Any]:
    query = db.query(Lead).filter(Lead.website_lead_id.like(f"{CASE_PREFIX}%"))
    if stage:
        query = query.filter(Lead.product_details["business"]["stage"].astext == stage)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Lead.website_lead_id.ilike(like),
                Lead.applicant_name.ilike(like),
                Lead.company_name.ilike(like),
                Lead.full_phone.ilike(like),
                Lead.city.ilike(like),
            )
        )
    total = query.with_entities(func.count(Lead.id)).scalar() or 0
    rows = query.order_by(Lead.created_at.desc()).limit(limit).all()
    return {"items": [_summary_out(r) for r in rows], "total": total}


@router.get("/cases/{ref}")
def get_case(ref: str, db: Session = Depends(get_db), _: User = Depends(require_staff)) -> dict[str, Any]:
    return _case_out(_find_case(db, ref))


@router.patch("/cases/{ref}")
def update_case(
    ref: str,
    body: CasePatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> dict[str, Any]:
    lead = _find_case(db, ref)
    biz = dict((lead.product_details or {}).get("business") or {})
    biz.setdefault("history", [])
    by = user.full_name or user.email

    for section in ("quick", "data", "financials"):
        incoming = getattr(body, section)
        if incoming is not None:
            biz[section] = {**(biz.get(section) or {}), **incoming}
    if body.documents is not None:
        docs = dict(biz.get("documents") or {})
        for key, val in body.documents.items():
            entry = {**(docs.get(key) or {}), **{k: v for k, v in val.items() if k in {"status", "note"}}}
            if entry.get("status") not in DOC_STATUSES:
                entry["status"] = "pending"
            docs[key] = entry
        biz["documents"] = docs
    if body.selected_lenders is not None:
        biz["selected_lenders"] = body.selected_lenders[:20]
    if body.applied_to is not None:
        biz["applied_to"] = body.applied_to[:20]
    if body.stage:
        if body.stage not in STAGES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown stage")
        completed = set(biz.get("completed") or [])
        completed.update(STAGES[: STAGES.index(body.stage)])
        biz["completed"] = [s for s in STAGES if s in completed]
        if biz.get("stage") != body.stage:
            biz["history"].append({"at": _now(), "by": by, "action": f"Moved to {body.stage.replace('_', ' ')}"})
        biz["stage"] = body.stage
    if body.note and body.note.strip():
        biz.setdefault("notes", []).append({"at": _now(), "by": by, "text": body.note.strip()[:2000]})
    if body.is_marketplace is not None and lead.status != "sold":
        lead.is_marketplace = body.is_marketplace
        lead.sale_available = body.is_marketplace

    biz["updated_by"] = by
    _sync_lead_columns(lead, biz)
    _save_business(lead, biz)
    db.commit()
    db.refresh(lead)
    return _case_out(lead)
