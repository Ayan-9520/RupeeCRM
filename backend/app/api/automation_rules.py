"""On/off switches for the built-in case rules. Each user keeps their own setting."""

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
VIEW_ROLES = {"ceo", "super_admin", "admin", "dsa"}


class RuleToggle(BaseModel):
    enabled: bool


def _allowed(user: User) -> None:
    if user.role not in VIEW_ROLES:
        raise HTTPException(status_code=403, detail="Not allowed")


@router.get("")
def list_rules(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    _allowed(user)
    saved = {
        row.rule_key: row.enabled
        for row in db.query(AutomationRulePref).filter(AutomationRulePref.user_id == user.id).all()
    }
    return {
        "rows": [
            {"id": key, "rule_key": key, "name": name, "enabled": saved.get(key, True)}
            for key, name in RULES
        ]
    }


@router.put("/{rule_key}")
def set_rule(
    rule_key: str,
    body: RuleToggle,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _allowed(user)
    if rule_key not in ALLOWED:
        raise HTTPException(status_code=400, detail="Unknown automation rule")
    row = (
        db.query(AutomationRulePref)
        .filter(AutomationRulePref.user_id == user.id, AutomationRulePref.rule_key == rule_key)
        .one_or_none()
    )
    if row is None:
        row = AutomationRulePref(id=uuid.uuid4(), user_id=user.id, rule_key=rule_key, enabled=body.enabled)
        db.add(row)
    else:
        row.enabled = body.enabled
        row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"rule_key": rule_key, "enabled": body.enabled}
