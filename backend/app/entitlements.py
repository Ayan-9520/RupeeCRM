"""Plan feature checks (Phase 2)."""

from __future__ import annotations

from app.models import User
from app.plans import PLANS


def owner_plan_modules(owner: User) -> dict[str, bool]:
    if owner.plan_status != "active" or not owner.plan_id:
        return {}
    plan = PLANS.get(owner.plan_id) or {}
    return dict(plan.get("modules") or {})


def has_module(owner: User, module: str) -> bool:
    return bool(owner_plan_modules(owner).get(module))
