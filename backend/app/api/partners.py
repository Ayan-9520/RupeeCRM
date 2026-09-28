from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import PartnerApplication, User
from app.schemas import (
    PartnerApproveIn,
    PartnerApproveOut,
    PartnerListOut,
    PartnerOut,
    PartnerRejectIn,
)
from app.services.partners import approve_partner, reject_partner

router = APIRouter(prefix="/api/partners", tags=["partners"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.get("", response_model=PartnerListOut)
def list_partners(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PartnerListOut:
    q = db.query(PartnerApplication).order_by(PartnerApplication.created_at.desc())
    if status_filter and status_filter != "all":
        q = q.filter(PartnerApplication.status == status_filter.lower())
    rows = q.limit(500).all()
    return PartnerListOut(items=rows, total=len(rows))


@router.get("/{application_id}", response_model=PartnerOut)
def get_partner(
    application_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> PartnerApplication:
    row = db.query(PartnerApplication).filter(PartnerApplication.id == application_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    return row


@router.post("/{application_id}/approve", response_model=PartnerApproveOut)
def approve(
    application_id: UUID,
    body: PartnerApproveIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> PartnerApproveOut:
    row = db.query(PartnerApplication).filter(PartnerApplication.id == application_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    try:
        app, user, temp = approve_partner(db, row, admin, body.notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PartnerApproveOut(
        dsa_id=app.generated_dsa_id or "",
        application_id=app.id,
        user_id=user.id,
        email=user.email,
        temporary_password=temp,
    )


@router.post("/{application_id}/reject")
def reject(
    application_id: UUID,
    body: PartnerRejectIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    row = db.query(PartnerApplication).filter(PartnerApplication.id == application_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Application not found")
    try:
        reject_partner(db, row, admin, body.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"success": True}
