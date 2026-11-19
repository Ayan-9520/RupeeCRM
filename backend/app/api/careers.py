from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CAREER_STATUSES, CareerApplication, User
from app.schemas import CareerListOut, CareerOut, CareerStatusIn

router = APIRouter(prefix="/api/careers", tags=["careers"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.get("", response_model=CareerListOut)
def list_careers(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> CareerListOut:
    rows = db.query(CareerApplication).order_by(CareerApplication.created_at.desc()).limit(300).all()
    return CareerListOut(items=[CareerOut.model_validate(row) for row in rows], total=len(rows))


@router.patch("/{application_id}", response_model=CareerOut)
def set_career_status(
    application_id: UUID,
    body: CareerStatusIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CareerOut:
    status_value = body.status.strip().lower()
    if status_value not in CAREER_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be new, shortlisted, or rejected")
    row = db.get(CareerApplication, application_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    row.status = status_value
    db.commit()
    db.refresh(row)
    return CareerOut.model_validate(row)
