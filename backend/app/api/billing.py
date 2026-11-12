"""Phase 2 billing: activate / cancel plan, wallet, team seats."""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models import BillingPayment, User
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
    phone: str | None = None
    is_owner: bool
    is_active: bool
    rm2_name: str | None = None
    rm2_status: str = "Not set"


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
    from app.services.joining_credit import grant_joining_credit

    grant_joining_credit(db, user)
    owner = _get_owner(db, user)
    used = _seat_count(db, owner.id)
    members = (
        db.query(User)
        .filter((User.id == owner.id) | (User.seat_owner_id == owner.id))
        .order_by(User.created_at.asc())
        .all()
    )
    rm_ids = {m.rm2_user_id for m in members if m.rm2_user_id}
    rm_names = {
        u.id: u.full_name
        for u in (db.query(User).filter(User.id.in_(rm_ids)).all() if rm_ids else [])
    }
    team = [
        TeamMemberOut(
            id=m.id,
            email=m.email,
            full_name=m.full_name,
            role=m.role,
            phone=m.phone,
            is_owner=m.id == owner.id,
            is_active=m.is_active,
            rm2_name=rm_names.get(m.rm2_user_id) if m.rm2_user_id else None,
            rm2_status="Assigned" if m.rm2_user_id else "Not set",
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


def _apply_plan(db: Session, owner: User, plan_id: str, cycle: str, record_payment: bool = True) -> str:
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
    if record_payment:
        db.add(
            BillingPayment(
                id=uuid4(),
                user_id=owner.id,
                description=f"{plan['name']} plan · {cycle}",
                amount=float(amount),
                status="paid",
                provider="offline",
                plan_id=plan_id,
                cycle=cycle,
                paid_at=now,
            )
        )
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


# Paid amount is what the partner transferred. Bonus is extra lead credit, not cash.
RECHARGE_BONUS_SLABS: tuple[tuple[float, float], ...] = (
    (10000, 0.10),
    (5000, 0.05),
)


def recharge_bonus(paid: float) -> tuple[float, float]:
    rate = 0.0
    for minimum, pct in RECHARGE_BONUS_SLABS:
        if paid >= minimum:
            rate = pct
            break
    return round(paid * rate, 2), rate


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
    paid = round(float(body.amount), 2)
    bonus, rate = recharge_bonus(paid)
    credited = round(paid + bonus, 2)
    owner.wallet_balance = float(owner.wallet_balance or 0) + credited
    db.add(
        BillingPayment(
            id=uuid4(),
            user_id=owner.id,
            description="Wallet recharge",
            amount=paid,
            status="paid",
            provider="offline",
            paid_at=datetime.now(timezone.utc),
        )
    )
    write_audit(
        db,
        action="wallet_credit",
        actor_user_id=admin.id,
        entity_type="user",
        entity_id=str(owner.id),
        detail={"paid": paid, "bonus": bonus, "credited": credited, "bonus_rate": rate, "note": body.note.strip()},
    )
    db.commit()
    db.refresh(owner)
    bonus_bit = f" + ₹{bonus:,.0f} extra credit" if bonus else ""
    return {
        "success": True,
        "message": f"₹{paid:,.0f} paid{bonus_bit} → ₹{credited:,.0f} in {owner.full_name}'s wallet",
        "paid": paid,
        "bonus": bonus,
        "credited": credited,
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


class PaymentOut(BaseModel):
    id: UUID
    user_id: UUID
    partner_name: str
    email: str
    description: str
    amount: float
    status: str
    provider: str
    created_at: datetime | None = None
    paid_at: datetime | None = None


def _payment_out(row: BillingPayment, user: User) -> PaymentOut:
    return PaymentOut(
        id=row.id,
        user_id=row.user_id,
        partner_name=user.full_name,
        email=user.email,
        description=row.description,
        amount=float(row.amount or 0),
        status=row.status,
        provider=row.provider,
        created_at=row.created_at,
        paid_at=row.paid_at,
    )


@router.get("/payments", response_model=list[PaymentOut])
def my_payments(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[PaymentOut]:
    owner = _get_owner(db, user)
    rows = (
        db.query(BillingPayment)
        .filter(BillingPayment.user_id == owner.id)
        .order_by(BillingPayment.created_at.desc())
        .limit(100)
        .all()
    )
    return [_payment_out(row, owner) for row in rows]


@router.get("/admin/payments", response_model=list[PaymentOut])
def admin_payments(db: Session = Depends(get_db), _admin: User = Depends(require_admin)) -> list[PaymentOut]:
    rows = db.query(BillingPayment).order_by(BillingPayment.created_at.desc()).limit(200).all()
    ids = [row.user_id for row in rows]
    users = {u.id: u for u in (db.query(User).filter(User.id.in_(ids)).all() if ids else [])}

    class Missing:
        full_name = "Partner"
        email = ""

    return [_payment_out(row, users.get(row.user_id) or Missing()) for row in rows]


class RazorpayOrderIn(BaseModel):
    plan_id: str
    cycle: str = Field(pattern="^(monthly|quarterly|yearly)$")


@router.get("/razorpay/status")
def razorpay_status() -> dict:
    return {"enabled": settings.razorpay_enabled}


@router.post("/razorpay/order")
def razorpay_order(
    body: RazorpayOrderIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Creates a pending payment and a Razorpay order. Checkout opens only when keys are set."""
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the account owner can pay for a plan")
    if not settings.razorpay_enabled:
        raise HTTPException(status_code=503, detail="Online payment is not connected yet")
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(status_code=400, detail="Unknown plan")
    amount = cycle_price(int(plan["monthly"]), body.cycle)
    row = BillingPayment(
        id=uuid4(),
        user_id=user.id,
        description=f"{plan['name']} plan · {body.cycle}",
        amount=float(amount),
        status="pending",
        provider="razorpay",
        plan_id=body.plan_id,
        cycle=body.cycle,
    )
    db.add(row)
    db.commit()
    import base64
    import urllib.request

    payload = json.dumps({"amount": amount * 100, "currency": "INR", "receipt": str(row.id)}).encode()
    token = base64.b64encode(f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()).decode()
    request = urllib.request.Request(
        "https://api.razorpay.com/v1/orders",
        data=payload,
        headers={"Authorization": f"Basic {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            order = json.loads(response.read().decode())
    except Exception as exc:
        row.status = "failed"
        db.commit()
        raise HTTPException(status_code=502, detail="Razorpay did not create the order") from exc
    row.provider_order_id = str(order.get("id") or "")
    db.commit()
    return {
        "ready": True,
        "payment_id": str(row.id),
        "order_id": row.provider_order_id,
        "key_id": settings.razorpay_key_id,
        "amount": amount,
        "currency": "INR",
    }


def _settle_razorpay(db: Session, row: BillingPayment, payment_id: str) -> None:
    if row.status == "paid":
        return
    row.status = "paid"
    row.paid_at = datetime.now(timezone.utc)
    row.provider_payment_id = payment_id or None
    if row.plan_id:
        owner = db.query(User).filter(User.id == row.user_id).first()
        if owner:
            _apply_plan(db, owner, row.plan_id, row.cycle or "monthly", record_payment=False)
            return
    db.commit()


class RazorpayConfirmIn(BaseModel):
    payment_id: UUID
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@router.post("/razorpay/confirm")
def razorpay_confirm(
    body: RazorpayConfirmIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Browser checkout callback. The plan turns on only after the signature matches."""
    if not settings.razorpay_key_secret:
        raise HTTPException(status_code=503, detail="Online payment is not connected yet")
    owner = _get_owner(db, user)
    row = db.query(BillingPayment).filter(BillingPayment.id == body.payment_id, BillingPayment.user_id == owner.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payment not found")
    if row.provider_order_id != body.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order does not match this payment")
    signed = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(settings.razorpay_key_secret.encode(), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment signature did not match")
    _settle_razorpay(db, row, body.razorpay_payment_id)
    return {"success": True, "message": "Payment confirmed. Your plan is active."}


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)) -> dict:
    raw = await request.body()
    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not set")
    signature = request.headers.get("x-razorpay-signature") or ""
    expected = hmac.new(settings.razorpay_webhook_secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid Razorpay signature")
    event = json.loads(raw.decode() or "{}")
    payment = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
    if event.get("event") != "payment.captured":
        return {"ok": True}
    order_id = str(payment.get("order_id") or "")
    row = db.query(BillingPayment).filter(BillingPayment.provider_order_id == order_id).first()
    if not row:
        return {"ok": True}
    _settle_razorpay(db, row, str(payment.get("id") or ""))
    return {"ok": True}
