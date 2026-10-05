from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import DEFAULT_PIPELINE_STAGES, Lead, LeadPurchase, User
from app.schemas import LeadOut
from app.services.audit import write_audit
from app.services.leads import mask_phone, normalize_phone

router = APIRouter(prefix="/api", tags=["purchases"])


class PurchaseOut(BaseModel):
    id: UUID
    lead_id: UUID
    buyer_user_id: UUID
    price_paid: float
    pipeline_stage: str
    notes: list = Field(default_factory=list)
    next_followup_at: datetime | None = None
    converted: bool
    deal_value: float | None = None
    created_at: datetime
    updated_at: datetime
    lead: LeadOut | None = None

    model_config = {"from_attributes": True}


class PurchaseListOut(BaseModel):
    items: list[PurchaseOut]
    total: int
    stages: list[str]


class LeadUpdateIn(BaseModel):
    applicant_name: str | None = None
    full_phone: str | None = None
    email: str | None = None
    city: str | None = None
    state: str | None = None
    company_name: str | None = None
    employment_type: str | None = None
    loan_amount: float | None = None
    monthly_income: float | None = None
    product_subtype: str | None = None
    loan_type: str | None = None
    score: str | None = None
    product_details: dict[str, Any] | None = None


class PurchasePatch(BaseModel):
    pipeline_stage: str | None = None
    notes_text: str | None = None
    disposition: str | None = None
    next_followup_at: datetime | None = None
    clear_followup: bool | None = None
    converted: bool | None = None
    deal_value: float | None = None
    lead: LeadUpdateIn | None = None


# Call outcome → optional pipeline move. None keeps the current stage.
DISPOSITIONS: dict[str, tuple[str, str | None]] = {
    "connected": ("Connected", "contacted"),
    "not_reachable": ("Not reachable", None),
    "interested": ("Interested", "contacted"),
    "not_interested": ("Not interested", "rejected"),
    "callback": ("Callback scheduled", None),
    "wrong_number": ("Wrong number", "rejected"),
    "eligible": ("Eligible", None),
    "converted": ("Converted to case", "docs_collected"),
}

_STAGE_RANK = {
    "new": 0,
    "contacted": 1,
    "docs_collected": 2,
    "bank_submitted": 3,
    "sanctioned": 4,
    "disbursed": 5,
}


def _can_advance(current: str, target: str) -> bool:
    if target == "rejected":
        return current != "disbursed"
    if current not in _STAGE_RANK or target not in _STAGE_RANK:
        return False
    return _STAGE_RANK[target] > _STAGE_RANK[current]


class BuyOut(BaseModel):
    success: bool = True
    purchase_id: UUID
    full_phone: str
    pipeline_stage: str
    message: str = "Lead purchased"


def _purchase_out(db: Session, p: LeadPurchase) -> PurchaseOut:
    lead = db.query(Lead).filter(Lead.id == p.lead_id).first()
    return PurchaseOut(
        id=p.id,
        lead_id=p.lead_id,
        buyer_user_id=p.buyer_user_id,
        price_paid=p.price_paid,
        pipeline_stage=p.pipeline_stage,
        notes=p.notes or [],
        next_followup_at=p.next_followup_at,
        converted=p.converted,
        deal_value=p.deal_value,
        created_at=p.created_at,
        updated_at=p.updated_at,
        lead=LeadOut.model_validate(lead) if lead else None,
    )


def _apply_lead_updates(lead: Lead, body: LeadUpdateIn) -> None:
    data = body.model_dump(exclude_unset=True)
    details_patch = data.pop("product_details", None)
    if "full_phone" in data and data["full_phone"]:
        phone = normalize_phone(str(data["full_phone"]))
        lead.full_phone = phone
        lead.masked_phone = mask_phone(phone)
        data.pop("full_phone", None)
    for key, value in data.items():
        if hasattr(lead, key):
            setattr(lead, key, value)
    if details_patch is not None:
        merged = dict(lead.product_details or {})
        merged.update(details_patch)
        lead.product_details = merged


@router.post("/leads/{lead_id}/purchase", response_model=BuyOut)
def purchase_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BuyOut:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    existing = (
        db.query(LeadPurchase)
        .filter(LeadPurchase.lead_id == lead_id, LeadPurchase.buyer_user_id == user.id)
        .first()
    )
    if existing:
        return BuyOut(
            purchase_id=existing.id,
            full_phone=lead.full_phone,
            pipeline_stage=existing.pipeline_stage,
            message="Already purchased",
        )

    if lead.status == "sold" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead no longer available")

    price = float(lead.price or 0)
    # Debit account owner's wallet (seat members share the pool)
    owner = user
    if user.seat_owner_id and user.seat_owner_id != user.id:
        owner = db.query(User).filter(User.id == user.seat_owner_id).first() or user
    if user.role != "admin":
        bal = float(owner.wallet_balance or 0)
        if bal < price:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient wallet balance (₹{bal:.0f}). Activate/recharge a plan.",
            )
        owner.wallet_balance = bal - price

    purchase = LeadPurchase(
        lead_id=lead.id,
        buyer_user_id=user.id,
        price_paid=price,
        pipeline_stage="new",
        notes=[
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Lead purchased · ₹{price:.0f} from wallet",
                "by": user.email,
                "kind": "system",
            }
        ],
    )
    lead.status = "sold"
    lead.sale_available = False
    db.add(purchase)
    write_audit(
        db,
        action="lead_purchase",
        actor_user_id=user.id,
        entity_type="lead",
        entity_id=str(lead.id),
        detail={"price": price, "purchase_id": str(purchase.id), "buyer": user.email},
    )
    db.commit()
    db.refresh(purchase)
    return BuyOut(
        purchase_id=purchase.id,
        full_phone=lead.full_phone,
        pipeline_stage=purchase.pipeline_stage,
    )


@router.get("/my-leads", response_model=PurchaseListOut)
def my_leads(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseListOut:
    q = db.query(LeadPurchase)
    if user.role != "admin":
        q = q.filter(LeadPurchase.buyer_user_id == user.id)
    rows = q.order_by(LeadPurchase.created_at.desc()).limit(300).all()
    items = [_purchase_out(db, p) for p in rows]
    return PurchaseListOut(items=items, total=len(items), stages=DEFAULT_PIPELINE_STAGES)


@router.patch("/my-leads/{purchase_id}", response_model=PurchaseOut)
def patch_my_lead(
    purchase_id: UUID,
    body: PurchasePatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseOut:
    p = db.query(LeadPurchase).filter(LeadPurchase.id == purchase_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    if user.role != "admin" and p.buyer_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lead")

    notes = list(p.notes or [])
    lead = db.query(Lead).filter(Lead.id == p.lead_id).first()

    if body.disposition:
        code = body.disposition.strip().lower()
        spec = DISPOSITIONS.get(code)
        if spec is None:
            raise HTTPException(status_code=400, detail="Invalid disposition")
        label, target = spec
        if code == "callback" and body.next_followup_at is None:
            raise HTTPException(status_code=400, detail="Callback needs a follow-up time")
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Disposition: {label}",
                "by": user.email,
                "kind": "disposition",
                "code": code,
            }
        )
        if target and _can_advance(p.pipeline_stage, target):
            old = p.pipeline_stage
            p.pipeline_stage = target
            notes.append(
                {
                    "at": datetime.now(timezone.utc).isoformat(),
                    "text": f"Stage: {old} → {target}",
                    "by": user.email,
                    "kind": "stage",
                }
            )
            if target == "rejected":
                p.converted = False

    if body.pipeline_stage is not None:
        if body.pipeline_stage not in DEFAULT_PIPELINE_STAGES:
            raise HTTPException(status_code=400, detail="Invalid pipeline stage")
        old = p.pipeline_stage
        p.pipeline_stage = body.pipeline_stage
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Stage: {old} → {body.pipeline_stage}",
                "by": user.email,
                "kind": "stage",
            }
        )
        if body.pipeline_stage == "disbursed":
            p.converted = True
            if p.deal_value is None and lead is not None:
                p.deal_value = float(lead.loan_amount or 0)
        if body.pipeline_stage == "rejected":
            p.converted = False

    if body.converted is not None:
        p.converted = body.converted
    if body.deal_value is not None:
        p.deal_value = body.deal_value
    if body.clear_followup:
        p.next_followup_at = None
    elif body.next_followup_at is not None:
        p.next_followup_at = body.next_followup_at
    if body.notes_text:
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": body.notes_text,
                "by": user.email,
                "kind": "note",
            }
        )

    if body.lead is not None and lead is not None:
        _apply_lead_updates(lead, body.lead)
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": "Lead details updated",
                "by": user.email,
                "kind": "edit",
            }
        )

    p.notes = notes
    db.commit()
    db.refresh(p)
    return _purchase_out(db, p)
