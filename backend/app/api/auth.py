from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import check_rate_limit
from app.core.security import (
    create_access_token,
    create_reset_token,
    decode_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.services.mailer import send_email, send_password_reset
from app.db.session import get_db
from app.models import User
from app.schemas import LoginIn, TokenOut, UserOut, UserUpdateIn
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    allowed = {
        "admin",
        "ceo",
        "super_admin",
        "dsa",
        "caller",
        "coordinator",
        "affiliate",
        "lender",
        "customer",
    }
    if user.role not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Login not allowed for this role yet")
    token = create_access_token(str(user.id), {"role": user.role, "email": user.email})
    return TokenOut(
        access_token=token,
        role=user.role,
        full_name=user.full_name,
        email=user.email,
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    user.password_hash = hash_password(body.new_password)
    db.add(user)
    db.commit()
    return {"success": True}


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=2000)
    new_password: str = Field(min_length=8, max_length=128)


FORGOT_REPLY = {"success": True, "message": "If that email has an account, a reset link is on its way."}


@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordIn,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    check_rate_limit(request, limit=5, window_sec=300, scope="forgot")
    if not settings.smtp_enabled:
        raise HTTPException(status_code=503, detail="Email reset is not set up yet. Ask your admin to reset your password.")
    user = db.query(User).filter(User.email == body.email.lower().strip()).first()
    if user and user.is_active:
        token = create_reset_token(str(user.id), user.password_hash)
        link = f"{settings.crm_public_url.rstrip('/')}/reset-password?token={token}"
        background.add_task(send_password_reset, user.email, user.full_name, link)
    return FORGOT_REPLY


@router.post("/reset-password")
def reset_password_with_token(body: ResetPasswordIn, request: Request, db: Session = Depends(get_db)) -> dict:
    check_rate_limit(request, limit=10, window_sec=300, scope="reset")
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired. Request a new one.")
    payload = decode_token(body.token)
    if not payload or payload.get("purpose") != "password_reset":
        raise invalid
    try:
        user_id = UUID(str(payload.get("sub")))
    except (TypeError, ValueError):
        raise invalid
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active or payload.get("pwf") != password_fingerprint(user.password_hash):
        raise invalid
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"success": True, "message": "Password updated. Sign in with your new password."}


@router.post("/smtp-test")
def smtp_test(user: User = Depends(get_current_user)) -> dict:
    if user.role not in {"admin", "ceo", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin only")
    if not settings.smtp_enabled:
        raise HTTPException(status_code=503, detail="SMTP_USER / SMTP_PASSWORD are not set in backend/.env")
    ok = send_email(user.email, "RupeeDial SMTP test", "SMTP is working. Password reset emails will be delivered.")
    if not ok:
        raise HTTPException(
            status_code=502,
            detail="Email could not be sent. Check SMTP_USER / SMTP_PASSWORD in backend/.env, then run: docker compose -f docker-compose.prod.yml logs api --tail 30",
        )
    return {"success": True, "message": f"Test email sent to {user.email}"}


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UserUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if body.full_name is not None:
        name = body.full_name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="full_name too short")
        user.full_name = name
    if body.phone is not None:
        phone = body.phone.strip()
        user.phone = phone or None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
