"""Self, Team and Combined business.

A case is credited to exactly one person: the partner on the file, or the staff owner
when no partner is set. Team = everyone below the user in the existing hierarchy:
staff via reports_to_user_id, partners via rm1/rm2, and sub-partners via active
network links. Nothing outside that tree is ever returned for a non-admin user.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable, Iterable
from uuid import UUID

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models import User

SCOPES = ("self", "team", "combined")
MAX_DEPTH = 12
SUBMITTED = {"submitted", "logged_in", "sanctioned", "disbursed", "disbursed_confirmed", "collected"}
LOGGED_IN = SUBMITTED - {"submitted"}
SANCTIONED = LOGGED_IN - {"logged_in"}
DISBURSED = {"disbursed", "disbursed_confirmed", "collected"}
PENDING = {"draft", "submitted", "logged_in", "sanctioned"}


def credited_to(row) -> UUID | None:
    return getattr(row, "partner_user_id", None) or getattr(row, "owner_user_id", None)


def walk_team(root: UUID, children_of: Callable[[list[UUID]], Iterable[UUID]]) -> set[UUID]:
    seen = {root}
    frontier = [root]
    for _ in range(MAX_DEPTH):
        nxt = [kid for kid in set(children_of(frontier)) if kid and kid not in seen]
        if not nxt:
            break
        seen.update(nxt)
        frontier = nxt
    seen.discard(root)
    return seen


def _children_from_db(db: Session) -> Callable[[list[UUID]], list[UUID]]:
    from sqlalchemy import or_

    from app.models import NetworkLink, User

    def children(parents: list[UUID]) -> list[UUID]:
        staff = db.query(User.id).filter(
            or_(
                User.reports_to_user_id.in_(parents),
                User.rm1_user_id.in_(parents),
                User.rm2_user_id.in_(parents),
            )
        )
        links = db.query(NetworkLink.child_user_id).filter(
            NetworkLink.parent_user_id.in_(parents),
            NetworkLink.child_user_id.isnot(None),
            NetworkLink.status == "active",
        )
        return [row[0] for row in staff.all()] + [row[0] for row in links.all()]

    return children


def team_ids(db: Session, user: User) -> set[UUID]:
    return walk_team(user.id, _children_from_db(db))


def split(rows: Iterable, me: UUID, team: set[UUID], sees_all: bool) -> tuple[list, list]:
    """Self rows and team rows. A row lands in at most one list."""
    mine, theirs = [], []
    for row in rows:
        owner = credited_to(row)
        if owner == me:
            mine.append(row)
        elif owner in team or sees_all:
            theirs.append(row)
    return mine, theirs


def pick(rows: Iterable, me: UUID, team: set[UUID], sees_all: bool, scope: str, member: UUID | None = None) -> list:
    if scope not in SCOPES:
        raise ValueError("Unknown business scope")
    if member is not None:
        if member != me and member not in team and not sees_all:
            raise PermissionError("This person is not in your team")
        return [row for row in rows if credited_to(row) == member]
    mine, theirs = split(rows, me, team, sees_all)
    if scope == "self":
        return mine
    if scope == "team":
        return theirs
    return mine + theirs


def metrics(rows: list, money: Callable[[object], dict], partner: bool = False) -> dict:
    live = [row for row in rows if getattr(row, "flag", "") != "cancelled"]
    disbursed = [row for row in live if row.stage in DISBURSED]
    confirmed = [row for row in live if row.stage in {"disbursed_confirmed", "collected"} and getattr(row, "counted", False)]
    collected = [row for row in live if float(getattr(row, "collected_amount", 0) or 0) > 0 or row.stage == "collected"]
    submitted = sum(1 for row in live if row.stage in SUBMITTED)
    revenue_key = "payable_amount" if partner else "net_revenue"
    return {
        "cases": len(rows),
        "submitted": submitted,
        "logged_in": sum(1 for row in live if row.stage in LOGGED_IN),
        "sanctioned": sum(1 for row in live if row.stage in SANCTIONED),
        "disbursed": len(disbursed),
        "disbursed_amount": round(sum(money(row)["base_amount"] for row in disbursed), 2),
        "collected": len(collected),
        "collected_amount": round(sum(float(getattr(row, "collected_amount", 0) or 0) for row in live), 2),
        "pending": sum(1 for row in live if row.stage in PENDING),
        "revenue": round(sum(money(row)[revenue_key] for row in confirmed), 2),
        "conversion": round(len(disbursed) / submitted * 100, 1) if submitted else 0,
    }
