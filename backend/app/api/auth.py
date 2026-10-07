from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password, verify_password
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
