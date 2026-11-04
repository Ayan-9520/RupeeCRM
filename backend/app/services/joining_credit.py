"""Give a partner ₹500 lead credit once, the first time they sign in."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import User
from app.services.audit import write_audit

JOINING_CREDIT = 500.0
PARTNER_ROLES = {"dsa", "affiliate"}


def grant_joining_credit(db: Session, user: User) -> bool:
    if user.role not in PARTNER_ROLES:
        return False
    owner = user
    if user.seat_owner_id and user.seat_owner_id != user.id:
        owner = db.query(User).filter(User.id == user.seat_owner_id).first() or user
    if owner.role not in PARTNER_ROLES or owner.joining_credit_at is not None:
        return False
    owner.wallet_balance = float(owner.wallet_balance or 0) + JOINING_CREDIT
    owner.joining_credit_at = datetime.now(timezone.utc)
    write_audit(
        db,
        action="joining_credit",
        actor_user_id=user.id,
        entity_type="user",
        entity_id=str(owner.id),
        detail={"amount": JOINING_CREDIT},
    )
    db.commit()
    db.refresh(owner)
    if owner.id != user.id:
        db.refresh(user)
    return True
