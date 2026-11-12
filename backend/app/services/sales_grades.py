"""Company ladder.

Sales: Telecaller, RM, Team Leader, Sales Manager, ASM, RSM, ZSM, Business Head, CEO.
Other departments: Executive, Team Leader, Manager, Head, then Business Head, then CEO.
A lower rank number is more senior.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import User

GRADES: dict[str, str] = {
    "T1": "CEO",
    "T2": "Business Head",
    "T3": "ZSM",
    "T4": "RSM",
    "T5": "ASM",
    "T6": "Sales Manager",
    "T7": "Team Leader",
    "T8": "RM",
    "T9": "Telecaller",
    "HR-H": "HR Head",
    "HR-M": "HR Manager",
    "HR-L": "HR Team Leader",
    "HR-E": "HR Executive",
    "OP-H": "Operations Head",
    "OP-M": "Operations Manager",
    "OP-L": "Operations Team Leader",
    "OP-E": "Operations Executive",
    "MK-H": "IT & Marketing Head",
    "MK-M": "IT & Marketing Manager",
    "MK-L": "IT & Marketing Team Leader",
    "MK-E": "IT & Marketing Executive",
    "AC-H": "Accounts Head",
    "AC-M": "Accounts Manager",
    "AC-L": "Accounts Team Leader",
    "AC-E": "Accounts Executive",
}

RANK: dict[str, int] = {
    "T1": 1,
    "T2": 2,
    "T3": 3,
    "T4": 4,
    "T5": 5,
    "T6": 6,
    "T7": 7,
    "T8": 8,
    "T9": 9,
    "HR-H": 3,
    "OP-H": 3,
    "MK-H": 3,
    "AC-H": 3,
    "HR-M": 6,
    "OP-M": 6,
    "MK-M": 6,
    "AC-M": 6,
    "HR-L": 7,
    "OP-L": 7,
    "MK-L": 7,
    "AC-L": 7,
    "HR-E": 9,
    "OP-E": 9,
    "MK-E": 9,
    "AC-E": 9,
}


def grade_title(code: str | None) -> str | None:
    if not code:
        return None
    return GRADES.get(code)


def grade_rank(code: str | None) -> int | None:
    if not code:
        return None
    return RANK.get(code)


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
