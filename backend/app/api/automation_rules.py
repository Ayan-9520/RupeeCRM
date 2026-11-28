"""On/off switches for the built-in case rules.

Only platform admins can switch a rule. The latest admin setting is the system-wide
state; partners can read it but never change it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import AutomationRulePref, User

router = APIRouter(prefix="/api/automation-rules", tags=["automation-rules"])

RULES = (
    ("docs_pending_reminder", "Docs pending > 3 days"),
    ("sanction_disbursal_task", "Sanction to disbursal task"),
    ("payout_followup", "Payout pending > 7 days"),
    ("unreachable_retry", "Unreachable retry"),
    ("rejected_lender_alt", "Rejected lender to alternate"),
)
ALLOWED = {key for key, _name in RULES}
ADMIN_ROLES = {"ceo", "super_admin", "admin"}
VIEW_ROLES = ADMIN_ROLES | {"dsa"}


class RuleToggle(BaseModel):
    enabled: bool


def _allowed(user: User) -> None:
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Not allowed")


def _system_state(db: Session) -> dict[str, tuple[bool, datetime | None]]:
    rows = (
        db.query(AutomationRulePref)
        .join(User, User.id == AutomationRulePref.user_id)
        .filter(User.role.in_(ADMIN_ROLES))
        .order_by(AutomationRulePref.updated_at.asc())
        .all()
    )
    state: dict[str, tuple[bool, datetime | None]] = {}
    for row in rows:
        state[row.rule_key] = (row.enabled, row.updated_at)
    return state


@router.get("")
def list_rules(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    _allowed(user)
    state = _system_state(db)
    return {
        "can_edit": user.role in ADMIN_ROLES,
        "rows": [
            {
                "id": key,
                "rule_key": key,
                "name": name,
                "enabled": state.get(key, (True, None))[0],
                "updated_at": state[key][1].isoformat() if key in state and state[key][1] else None,
            }
            for key, name in RULES
        ],
    }


@router.put("/{rule_key}")
def set_rule(
    rule_key: str,
    body: RuleToggle,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only an admin can change automation rules")
    if rule_key not in ALLOWED:
        raise HTTPException(status_code=400, detail="Unknown automation rule")
    row = (
        db.query(AutomationRulePref)
        .filter(AutomationRulePref.user_id == user.id, AutomationRulePref.rule_key == rule_key)
        .one_or_none()
    )
    now = datetime.now(timezone.utc)
    if row is None:
        row = AutomationRulePref(id=uuid.uuid4(), user_id=user.id, rule_key=rule_key, enabled=body.enabled, updated_at=now)
        db.add(row)
    else:
        row.enabled = body.enabled
        row.updated_at = now
    db.commit()
    return {"rule_key": rule_key, "enabled": body.enabled}
