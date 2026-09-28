from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models import PartnerApplication, User
from app.services.partners import generate_temp_password

router = APIRouter(prefix="/api/users", tags=["users"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class UserAdminOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    phone: str | None = None
    dsa_id: str | None = None
    is_active: bool
    kyc_verified: bool = False
    created_at: str | None = None

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    items: list[UserAdminOut]
    total: int
    pending_partners: int


class ResetPasswordOut(BaseModel):
    success: bool = True
    email: str
    temporary_password: str


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.get("", response_model=UserListOut)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserListOut:
    rows = db.query(User).order_by(User.created_at.desc()).limit(500).all()
    pending = (
        db.query(PartnerApplication)
        .filter(PartnerApplication.status.in_(["pending", "under_review"]))
        .count()
    )
    items = [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            phone=u.phone,
            dsa_id=u.dsa_id,
            is_active=u.is_active,
            kyc_verified=bool(u.kyc_verified),
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in rows
    ]
    return UserListOut(items=items, total=len(items), pending_partners=pending)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ResetPasswordOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    temp = generate_temp_password()
    user.password_hash = hash_password(temp)
    user.is_active = True
    db.commit()
    return ResetPasswordOut(email=user.email, temporary_password=temp)
