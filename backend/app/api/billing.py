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
from app.services.audit import write_audit
from app.services.partners import generate_temp_password

router = APIRouter(prefix="/api/billing", tags=["billing"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


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


def _apply_plan(db: Session, owner: User, plan_id: str, cycle: str) -> str:
    plan = PLANS.get(plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan")
    monthly = int(plan["monthly"])
    amount = cycle_price(monthly, cycle)
    months = {"monthly": 1, "quarterly": 3, "yearly": 12}[cycle]
    credits = float(plan["lead_credits_monthly"]) * months
    days = {"monthly": 30, "quarterly": 90, "yearly": 365}[cycle]

    now = datetime.now(timezone.utc)
    owner.plan_id = plan_id
    owner.plan_cycle = cycle
    owner.plan_status = "active"
    owner.plan_started_at = now
    owner.plan_ends_at = now + timedelta(days=days)
    owner.wallet_balance = float(owner.wallet_balance or 0) + credits
    db.commit()
    db.refresh(owner)
    return f"Activated {plan['name']} ({cycle}) · ₹{amount} · ₹{int(credits)} lead credits added"


@router.post("/activate", response_model=ActivateOut)
def activate_plan(
    body: ActivateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ActivateOut:
    """Online checkout is not live, so only admins may activate. Partners pay offline and an admin activates."""
    if user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=402,
            detail="Online payment isn't live yet. Pay RupeeDial by UPI/bank transfer and an admin will activate your plan.",
        )
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only account owner can activate a plan")
    message = _apply_plan(db, user, body.plan_id, body.cycle)
    return ActivateOut(message=message, entitlements=_entitlements(user))


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


class AdminActivateIn(ActivateIn):
    user_id: UUID


class AdminCancelIn(BaseModel):
    user_id: UUID


@router.get("/admin/subscriptions")
def admin_subscriptions(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> dict:
    owners = (
        db.query(User)
        .filter(User.seat_owner_id.is_(None), User.role.notin_(tuple(ADMIN_ROLES) + ("customer",)))
        .order_by(User.created_at.desc())
        .all()
    )
    items = []
    for u in owners:
        plan = PLANS.get(u.plan_id or "")
        items.append(
            {
                "user_id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "plan_id": u.plan_id,
                "plan_name": (plan or {}).get("name"),
                "plan_cycle": u.plan_cycle,
                "plan_status": u.plan_status,
                "plan_started_at": u.plan_started_at.isoformat() if u.plan_started_at else None,
                "plan_ends_at": u.plan_ends_at.isoformat() if u.plan_ends_at else None,
                "amount": cycle_price(int(plan["monthly"]), u.plan_cycle or "monthly") if plan else 0,
                "wallet_balance": float(u.wallet_balance or 0),
                "seats_used": _seat_count(db, u.id),
            }
        )
    active = [i for i in items if i["plan_status"] == "active"]
    return {
        "items": items,
        "active_count": len(active),
        "active_value": sum(i["amount"] for i in active),
        "plans": [{"id": pid, "name": p["name"]} for pid, p in PLANS.items()],
    }


@router.post("/admin/activate", response_model=ActivateOut)
def admin_activate(body: AdminActivateIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> ActivateOut:
    owner = db.query(User).filter(User.id == body.user_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")
    if owner.seat_owner_id and owner.seat_owner_id != owner.id:
        raise HTTPException(status_code=400, detail="This user is a team seat. Activate the account owner instead.")
    write_audit(
        db,
        action="plan_activate",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(owner.id),
        detail={"plan_id": body.plan_id, "cycle": body.cycle},
    )
    message = _apply_plan(db, owner, body.plan_id, body.cycle)
    return ActivateOut(message=f"{owner.full_name}: {message}", entitlements=_entitlements(owner))


class WalletCreditIn(BaseModel):
    user_id: UUID
    amount: float = Field(gt=0, le=500000)
    note: str = Field(default="", max_length=200)


@router.post("/admin/wallet-credit")
def admin_wallet_credit(
    body: WalletCreditIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    """Credit a partner wallet after an offline (UPI / bank) payment is confirmed."""
    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    owner = target
    if target.seat_owner_id and target.seat_owner_id != target.id:
        owner = db.query(User).filter(User.id == target.seat_owner_id).first() or target
    amount = round(float(body.amount), 2)
    owner.wallet_balance = float(owner.wallet_balance or 0) + amount
    write_audit(
        db,
        action="wallet_credit",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(owner.id),
        detail={"amount": amount, "note": body.note.strip()},
    )
    db.commit()
    db.refresh(owner)
    return {
        "success": True,
        "message": f"₹{amount:,.0f} added to {owner.full_name}'s wallet",
        "wallet_balance": float(owner.wallet_balance or 0),
    }


@router.post("/admin/cancel", response_model=ActivateOut)
def admin_cancel(body: AdminCancelIn, db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> ActivateOut:
    owner = db.query(User).filter(User.id == body.user_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")
    if owner.plan_status != "active":
        raise HTTPException(status_code=400, detail="No active plan")
    owner.plan_status = "cancelled"
    db.commit()
    db.refresh(owner)
    return ActivateOut(message=f"{owner.full_name}: plan cancelled", entitlements=_entitlements(owner))


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
