"""Append-only audit helper."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import AuditEvent


def write_audit(
    db: Session,
    *,
    action: str,
    actor_user_id: UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    detail: dict | None = None,
    commit: bool = False,
) -> AuditEvent:
    row = AuditEvent(
        id=uuid4(),
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        detail=detail or {},
    )
    db.add(row)
    if commit:
        db.commit()
        db.refresh(row)
    return row
