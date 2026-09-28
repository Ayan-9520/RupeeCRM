"""Phase 7 admin trust: KYC, suspend, dead-number credit, audit list."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import AuditEvent, Lead, LeadPurchase, PartnerProfile, User
from app.services.audit import write_audit

router = APIRouter(prefix="/api/admin/trust", tags=["admin-trust"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


class KycIn(BaseModel):
    user_id: UUID
    verified: bool = True


class SuspendIn(BaseModel):
    owner_user_id: UUID
    suspended: bool = True
    reason: str | None = None


class DeadNumberIn(BaseModel):
    purchase_id: UUID
    credit_wallet: bool = True
    reopen_lead: bool = True
    reason: str = Field(min_length=3)


class AuditOut(BaseModel):
    id: UUID
    actor_user_id: UUID | None
    action: str
    entity_type: str | None
    entity_id: str | None
    detail: dict
    created_at: str | None

    model_config = {"from_attributes": True}


@router.post("/kyc")
def set_kyc(
    body: KycIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.kyc_verified = body.verified
    write_audit(
        db,
        action="kyc_set",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(user.id),
        detail={"verified": body.verified, "email": user.email},
    )
    db.commit()
    return {"success": True, "user_id": str(user.id), "kyc_verified": user.kyc_verified}


@router.post("/suspend-profile")
def suspend_profile(
    body: SuspendIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    row = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == body.owner_user_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    row.suspended = body.suspended
    if body.suspended:
        row.published = False
        row.directory_featured = False
    write_audit(
        db,
        action="profile_suspend" if body.suspended else "profile_unsuspend",
        actor_user_id=admin.id,
        entity_type="partner_profile",
        entity_id=str(row.id),
        detail={"slug": row.slug, "reason": body.reason},
    )
    db.commit()
    return {"success": True, "slug": row.slug, "suspended": row.suspended, "published": row.published}


@router.post("/dead-number-credit")
def dead_number_credit(
    body: DeadNumberIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    """Refund purchase price to buyer wallet and optionally reopen marketplace lead."""
    purchase = db.query(LeadPurchase).filter(LeadPurchase.id == body.purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    buyer = db.query(User).filter(User.id == purchase.buyer_user_id).first()
    if not buyer:
        raise HTTPException(status_code=404, detail="Buyer missing")
    owner = buyer
    if buyer.seat_owner_id and buyer.seat_owner_id != buyer.id:
        owner = db.query(User).filter(User.id == buyer.seat_owner_id).first() or buyer

    credit = float(purchase.price_paid or 0)
    if body.credit_wallet and credit > 0:
        owner.wallet_balance = float(owner.wallet_balance or 0) + credit

    lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
    if body.reopen_lead and lead:
        lead.status = "available"
        lead.sale_available = True
        lead.fraud_risk = "dead_number"
        lead.is_marketplace = True

    write_audit(
        db,
        action="dead_number_credit",
        actor_user_id=admin.id,
        entity_type="lead_purchase",
        entity_id=str(purchase.id),
        detail={
            "reason": body.reason,
            "credit": credit,
            "buyer": buyer.email,
            "reopen": body.reopen_lead,
            "lead_id": str(purchase.lead_id),
        },
    )
    db.commit()
    return {
        "success": True,
        "credited": credit if body.credit_wallet else 0,
        "wallet_balance": float(owner.wallet_balance or 0),
        "lead_reopened": bool(body.reopen_lead and lead),
    }


@router.get("/audit", response_model=list[AuditOut])
def list_audit(
    action: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> list[AuditOut]:
    q = db.query(AuditEvent).order_by(AuditEvent.created_at.desc())
    if action:
        q = q.filter(AuditEvent.action == action)
    rows = q.limit(limit).all()
    return [
        AuditOut(
            id=r.id,
            actor_user_id=r.actor_user_id,
            action=r.action,
            entity_type=r.entity_type,
            entity_id=r.entity_id,
            detail=r.detail or {},
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
