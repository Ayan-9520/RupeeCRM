"""Sales ladder T1 (Business Head) to T10 (Sales Executive), plus department heads."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import User

GRADES: dict[str, str] = {
    "T1": "Business Head",
    "T2": "VP",
    "T3": "ZSM",
    "T4": "RSM",
    "T5": "ASM",
    "T6": "Sales Manager",
    "T7": "RM2",
    "T8": "RM1",
    "T9": "Senior Sales Executive",
    "T10": "Sales Executive",
    "HR-M": "HR Manager",
    "HR-E": "HR Executive",
    "AC-M": "Accounts Manager",
    "AC-E": "Accounts Executive",
    "MK-M": "Marketing Manager",
    "MK-E": "Marketing Executive",
    "OP-M": "Operations Manager",
    "OP-E": "Operations Executive",
}


def grade_title(code: str | None) -> str | None:
    if not code:
        return None
    return GRADES.get(code)


def grade_rank(code: str | None) -> int | None:
    if not code or not code.startswith("T"):
        return None
    try:
        return int(code[1:])
    except ValueError:
        return None


def downline_ids(db: Session, user_id: UUID) -> set[UUID]:
    """People who report up to this user, including indirect reports."""
    rows = db.query(User.id, User.reports_to_user_id).all()
    children: dict[UUID, list[UUID]] = {}
    for uid, manager_id in rows:
        if manager_id:
            children.setdefault(manager_id, []).append(uid)
    found: set[UUID] = set()
    stack = list(children.get(user_id, []))
    while stack:
        current = stack.pop()
        if current in found or current == user_id:
            continue
        found.add(current)
        stack.extend(children.get(current, []))
    return found
