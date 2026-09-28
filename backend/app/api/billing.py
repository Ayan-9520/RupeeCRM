"""Phase 2 billing: activate / cancel plan, wallet, team seats."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models import User
from app.plans import PLANS, cycle_price
from app.services.partners import generate_temp_password

router = APIRouter(prefix="/api/billing", tags=["billing"])


def _owner(user: User) -> UUID:
    return user.seat_owner_id or user.id


def _get_owner(db: Session, user: User) -> User:
    oid = _owner(user)
    if oid == user.id:
        return user
    owner = db.query(User).filter(User.id == oid).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Seat owner missing")
    return owner


def _seat_count(db: Session, owner_id: UUID) -> int:
    return (
        db.query(User)
        .filter(
            (User.id == owner_id) | (User.seat_owner_id == owner_id),
            User.is_active.is_(True),
        )
        .count()
    )


def _entitlements(owner: User) -> dict:
    plan = PLANS.get(owner.plan_id or "") if owner.plan_status == "active" else None
    modules = (plan or {}).get("modules") or {}
    seats = int((plan or {}).get("seats") or 1)
    return {
        "plan_id": owner.plan_id,
        "plan_name": (plan or {}).get("name"),
        "plan_cycle": owner.plan_cycle,
        "plan_status": owner.plan_status,
        "plan_started_at": owner.plan_started_at.isoformat() if owner.plan_started_at else None,
        "plan_ends_at": owner.plan_ends_at.isoformat() if owner.plan_ends_at else None,
        "wallet_balance": float(owner.wallet_balance or 0),
        "seat_limit": seats if plan else 1,
        "modules": modules,
        "has_active_plan": owner.plan_status == "active" and bool(plan),
    }


class ActivateIn(BaseModel):
    plan_id: str
    cycle: str = Field(default="monthly", pattern="^(monthly|quarterly|yearly)$")


class InviteIn(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "dsa"


class TeamMemberOut(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: str
    is_owner: bool
    is_active: bool


class BillingMeOut(BaseModel):
    entitlements: dict
    seats_used: int
    team: list[TeamMemberOut]
    available_plans: list[dict]


class ActivateOut(BaseModel):
    success: bool = True
    message: str
    entitlements: dict


@router.get("/me", response_model=BillingMeOut)
def billing_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> BillingMeOut:
    owner = _get_owner(db, user)
    used = _seat_count(db, owner.id)
    members = (
        db.query(User)
        .filter((User.id == owner.id) | (User.seat_owner_id == owner.id))
        .order_by(User.created_at.asc())
        .all()
    )
    team = [
        TeamMemberOut(
            id=m.id,
            email=m.email,
            full_name=m.full_name,
            role=m.role,
            is_owner=m.id == owner.id,
            is_active=m.is_active,
        )
        for m in members
    ]
    plans_out = []
    for pid, p in PLANS.items():
        monthly = int(p["monthly"])
        plans_out.append(
            {
                "id": pid,
                "name": p["name"],
                "seats": p["seats"],
                "lead_credits_monthly": p["lead_credits_monthly"],
                "modules": p["modules"],
                "price": {
                    "monthly": cycle_price(monthly, "monthly"),
                    "quarterly": cycle_price(monthly, "quarterly"),
                    "yearly": cycle_price(monthly, "yearly"),
                },
            }
        )
    return BillingMeOut(
        entitlements=_entitlements(owner),
        seats_used=used,
        team=team,
        available_plans=plans_out,
    )


@router.post("/activate", response_model=ActivateOut)
def activate_plan(
    body: ActivateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ActivateOut:
    """Manual activate (Razorpay later). Credits wallet + sets plan window."""
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only account owner can activate a plan")
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan")
    owner = user
    monthly = int(plan["monthly"])
    amount = cycle_price(monthly, body.cycle)
    credits = float(plan["lead_credits_monthly"])
    if body.cycle == "quarterly":
        credits *= 3
    elif body.cycle == "yearly":
        credits *= 12

    now = datetime.now(timezone.utc)
    if body.cycle == "quarterly":
        ends = now + timedelta(days=90)
    elif body.cycle == "yearly":
        ends = now + timedelta(days=365)
    else:
        ends = now + timedelta(days=30)

    owner.plan_id = body.plan_id
    owner.plan_cycle = body.cycle
    owner.plan_status = "active"
    owner.plan_started_at = now
    owner.plan_ends_at = ends
    owner.wallet_balance = float(owner.wallet_balance or 0) + credits
    db.commit()
    db.refresh(owner)
    return ActivateOut(
        message=f"Activated {plan['name']} ({body.cycle}) · ₹{amount} billed (manual) · ₹{int(credits)} credits added",
        entitlements=_entitlements(owner),
    )


@router.post("/cancel", response_model=ActivateOut)
def cancel_plan(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ActivateOut:
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only account owner can cancel")
    owner = user
    if owner.plan_status != "active":
        raise HTTPException(status_code=400, detail="No active plan")
    owner.plan_status = "cancelled"
    # Keep plan_ends_at; wallet credits remain
    db.commit()
    db.refresh(owner)
    return ActivateOut(
        message="Plan cancelled. Access until end date; lead credits stay in wallet.",
        entitlements=_entitlements(owner),
    )


@router.post("/team/invite")
def invite_seat(
    body: InviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only owner can invite")
    owner = user
    if owner.plan_status != "active":
        raise HTTPException(status_code=400, detail="Activate a plan first")
    plan = PLANS.get(owner.plan_id or "")
    if not plan:
        raise HTTPException(status_code=400, detail="No plan")
    limit = int(plan["seats"])
    used = _seat_count(db, owner.id)
    if used >= limit:
        raise HTTPException(status_code=400, detail=f"Seat limit reached ({limit}). Upgrade plan.")

    email = body.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = body.role if body.role in {"dsa", "caller", "coordinator"} else "dsa"
    temp = generate_temp_password()
    member = User(
        email=email,
        full_name=body.full_name.strip() or email.split("@")[0],
        password_hash=hash_password(temp),
        role=role,
        is_active=True,
        seat_owner_id=owner.id,
        plan_id=owner.plan_id,
        plan_status="active",
    )
    db.add(member)
    db.commit()
    return {
        "success": True,
        "email": email,
        "temporary_password": temp,
        "role": role,
        "message": "Seat created — share temp password with teammate",
    }
