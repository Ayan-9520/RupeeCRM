"""Partner network. Share percentages always come from network_settings."""

from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy.orm import Session

from app.services.commission import rate_fraction
from app.models import Lead, LeadPurchase, NetworkLink, NetworkSettings, User

MAX_LEVELS = 5


def _blank_settings(db: Session) -> NetworkSettings:
    row = NetworkSettings(id=1, levels=[])
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_settings(db: Session) -> NetworkSettings:
    row = db.query(NetworkSettings).filter(NetworkSettings.id == 1).first()
    if row is None:
        return _blank_settings(db)
    return row


def save_levels(db: Session, levels: list[dict]) -> NetworkSettings:
    cleaned = []
    for index, item in enumerate(levels[:MAX_LEVELS], start=1):
        label = str(item.get("label") or f"Level {index}").strip()[:80]
        try:
            share = float(item.get("share_percent"))
        except (TypeError, ValueError) as exc:
            raise ValueError("Each level needs a share percent") from exc
        if share < 0 or share > 100:
            raise ValueError("Share percent must be between 0 and 100")
        cleaned.append({"level": index, "label": label or f"Level {index}", "share_percent": round(share, 2)})
    row = get_settings(db)
    row.levels = cleaned
    db.commit()
    db.refresh(row)
    return row


def _would_cycle(db: Session, parent_id: UUID, child_id: UUID) -> bool:
    if parent_id == child_id:
        return True
    seen = {child_id}
    frontier = [child_id]
    while frontier:
        links = (
            db.query(NetworkLink)
            .filter(NetworkLink.parent_user_id.in_(frontier), NetworkLink.child_user_id.isnot(None))
            .all()
        )
        frontier = []
        for link in links:
            child = link.child_user_id
            if child in seen or child is None:
                continue
            if child == parent_id:
                return True
            seen.add(child)
            frontier.append(child)
    return False


def attach_sponsor(db: Session, child: User, code: str) -> None:
    token = (code or "").strip()
    if not token:
        return
    existing = (
        db.query(NetworkLink)
        .filter(NetworkLink.child_user_id == child.id, NetworkLink.status == "active")
        .first()
    )
    if existing:
        return

    invite = db.query(NetworkLink).filter(NetworkLink.invite_code == token).first()
    parent: User | None = None
    if invite and invite.child_user_id is None and not _would_cycle(db, invite.parent_user_id, child.id):
        invite.child_user_id = child.id
        invite.status = "active"
        if not invite.invite_name:
            invite.invite_name = child.full_name
        return
    if invite and invite.parent_user_id:
        parent = db.query(User).filter(User.id == invite.parent_user_id).first()
    if parent is None:
        parent = db.query(User).filter(User.dsa_id == token).first()
    if parent is None or _would_cycle(db, parent.id, child.id):
        return
    already = (
        db.query(NetworkLink)
        .filter(NetworkLink.parent_user_id == parent.id, NetworkLink.child_user_id == child.id)
        .first()
    )
    if already:
        already.status = "active"
        return
    db.add(
        NetworkLink(
            parent_user_id=parent.id,
            child_user_id=child.id,
            invite_name=child.full_name,
            invite_phone=child.phone or "",
            invite_email=child.email,
            invite_code=f"NW-{secrets.token_hex(4).upper()}",
            status="active",
        )
    )


def create_invite(db: Session, parent: User, name: str, phone: str, email: str) -> NetworkLink:
    row = NetworkLink(
        parent_user_id=parent.id,
        invite_name=name.strip(),
        invite_phone=phone.strip(),
        invite_email=email.strip().lower(),
        invite_code=f"NW-{secrets.token_hex(4).upper()}",
        status="invited",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _money_for(db: Session, user_id: UUID) -> tuple[float, int, int]:
    rows = db.query(LeadPurchase).filter(LeadPurchase.buyer_user_id == user_id).all()
    disbursed = 0.0
    closed = 0
    for row in rows:
        if not (row.converted or row.pipeline_stage == "disbursed"):
            continue
        closed += 1
        if row.deal_value:
            disbursed += float(row.deal_value)
            continue
        lead = db.query(Lead).filter(Lead.id == row.lead_id).first()
        disbursed += float(lead.loan_amount or 0) if lead else 0.0
    return disbursed, closed, len(rows)


def _children(db: Session, parent_ids: list[UUID]) -> list[NetworkLink]:
    if not parent_ids:
        return []
    return (
        db.query(NetworkLink)
        .filter(NetworkLink.parent_user_id.in_(parent_ids), NetworkLink.child_user_id.isnot(None), NetworkLink.status == "active")
        .all()
    )


def network_view(db: Session, user: User) -> dict:
    settings = get_settings(db)
    levels = list(settings.levels or [])
    depth = min(len(levels), MAX_LEVELS)
    direct = (
        db.query(NetworkLink)
        .filter(NetworkLink.parent_user_id == user.id)
        .order_by(NetworkLink.created_at.desc())
        .all()
    )
    level_rows: list[list[NetworkLink]] = []
    parent_ids = [user.id]
    seen: set[UUID] = set()
    for _ in range(depth):
        links = [link for link in _children(db, parent_ids) if link.child_user_id not in seen]
        for link in links:
            if link.child_user_id:
                seen.add(link.child_user_id)
        level_rows.append(links)
        parent_ids = [link.child_user_id for link in links if link.child_user_id]
        if not parent_ids:
            break

    reward_rows = []
    business = 0.0
    revenue = 0.0
    disbursed_cases = 0
    purchased = 0
    for index, links in enumerate(level_rows):
        rule = levels[index] if index < len(levels) else {"label": f"Level {index + 1}", "share_percent": 0}
        share = float(rule.get("share_percent") or 0)
        level_business = 0.0
        for link in links:
            if not link.child_user_id:
                continue
            amount, closed, total = _money_for(db, link.child_user_id)
            level_business += amount
            disbursed_cases += closed
            purchased += total
        commission = round(level_business * rate_fraction(db), 2)
        reward = round(commission * share / 100, 2)
        business += level_business
        revenue += reward
        reward_rows.append(
            {
                "level": index + 1,
                "label": str(rule.get("label") or f"Level {index + 1}"),
                "share_percent": share,
                "connectors": len(links),
                "business": round(level_business, 2),
                "reward": reward,
            }
        )

    connectors = []
    for link in direct:
        child = db.query(User).filter(User.id == link.child_user_id).first() if link.child_user_id else None
        amount = 0.0
        if child:
            amount, _, _ = _money_for(db, child.id)
        connectors.append(
            {
                "id": str(link.id),
                "name": child.full_name if child else link.invite_name,
                "email": child.email if child else link.invite_email,
                "phone": child.phone if child and child.phone else link.invite_phone,
                "code": link.invite_code,
                "status": "active" if child and child.is_active and link.status == "active" else link.status,
                "business": round(amount, 2),
            }
        )
    active = [item for item in connectors if item["status"] == "active"]
    return {
        "levels": levels,
        "connectors": connectors,
        "connector_count": len(connectors),
        "active_count": len(active),
        "business": round(business, 2),
        "revenue": round(revenue, 2),
        "performance": round((disbursed_cases / purchased) * 100, 1) if purchased else 0,
        "rewards": reward_rows,
    }
