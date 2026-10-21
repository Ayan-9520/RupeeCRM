"""Notifications for the signed-in user, and logs for the built-in case rules."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.customer_activity import _text
from app.api.customer_workspace import _require_purchase
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CustomerAutomationLog, LeadPurchase, User, UserNotification

router = APIRouter(prefix="/api", tags=["customer-ops"])

NOTE_TYPES = {"docs_pending", "followup_due"}
RULES = {
    "docs_pending_reminder",
    "sanction_disbursal_task",
    "payout_followup",
    "unreachable_retry",
    "rejected_lender_alt",
}
LOG_STATUSES = {"success", "failed"}


class NotificationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    title: str
    body: str | None = None
    link: str | None = None


class AutomationLogIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    rule_key: str
    status: str
    message: str
    task_id: str | None = None
    retry_at: str | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _link(value: str | None) -> str | None:
    text = _text(value, 200)
    if text is None:
        return None
    if not text.startswith("/dashboard/") or ".." in text or text.startswith("//"):
        raise HTTPException(status_code=400, detail="Notification link is invalid")
    return text


def _when(value: str | None) -> datetime | None:
    text = _text(value, 40)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Enter a valid date")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _note_out(row: UserNotification) -> dict:
    return {
        "id": str(row.id),
        "type": row.type,
        "title": row.title,
        "body": row.body,
        "link": row.link,
        "read_at": _iso(row.read_at),
        "created_at": _iso(row.created_at),
        "metadata": {},
    }


@router.get("/notifications")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    rows = (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(30)
        .all()
    )
    return {"rows": [_note_out(row) for row in rows]}


@router.post("/notifications")
def create_notification(
    body: NotificationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    note_type = (body.type or "").strip().lower()
    if note_type not in NOTE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    title = _text(body.title, 200)
    if not title:
        raise HTTPException(status_code=400, detail="Notification title is required")
    count = db.query(UserNotification).filter(UserNotification.user_id == user.id).count()
    if count >= 100:
        oldest = (
            db.query(UserNotification)
            .filter(UserNotification.user_id == user.id)
            .order_by(UserNotification.created_at.asc())
            .first()
        )
        if oldest:
            db.delete(oldest)
    row = UserNotification(
        user_id=user.id,
        type=note_type,
        title=title,
        body=_text(body.body, 500),
        link=_link(body.link),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _note_out(row)


def _owned_note(db: Session, user: User, note_id: UUID) -> UserNotification:
    row = db.query(UserNotification).filter(UserNotification.id == note_id, UserNotification.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")
    return row


@router.post("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    now = datetime.now(timezone.utc)
    (
        db.query(UserNotification)
        .filter(UserNotification.user_id == user.id, UserNotification.read_at.is_(None))
        .update({UserNotification.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {"ok": True}


@router.post("/notifications/{note_id}/read")
def mark_read(note_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_note(db, user, note_id)
    if row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
    return _note_out(row)


@router.get("/automation-logs")
def list_automation_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase_ids = [row.id for row in db.query(LeadPurchase.id).filter(LeadPurchase.buyer_user_id == user.id).all()]
    if not purchase_ids:
        return {"rows": []}
    rows = (
        db.query(CustomerAutomationLog)
        .filter(CustomerAutomationLog.lead_purchase_id.in_(purchase_ids))
        .order_by(CustomerAutomationLog.created_at.desc())
        .limit(50)
        .all()
    )
    return {
        "rows": [
            {
                "id": str(row.id),
                "rule_key": row.rule_key,
                "dsa_id": str(row.dsa_id),
                "lead_purchase_id": str(row.lead_purchase_id),
                "status": row.status,
                "message": row.message,
                "task_id": str(row.task_id) if row.task_id else None,
                "retry_at": _iso(row.retry_at),
                "created_at": _iso(row.created_at),
            }
            for row in rows
        ]
    }


@router.post("/my-leads/{purchase_id}/automation-logs")
def create_automation_log(
    purchase_id: UUID,
    body: AutomationLogIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rule = (body.rule_key or "").strip()
    if rule not in RULES:
        raise HTTPException(status_code=400, detail="Unknown automation rule")
    status_value = (body.status or "").strip().lower()
    if status_value not in LOG_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid automation status")
    message = _text(body.message, 300)
    if not message:
        raise HTTPException(status_code=400, detail="Automation message is required")
    task_id = None
    if body.task_id:
        try:
            task_id = UUID(str(body.task_id))
        except ValueError:
            raise HTTPException(status_code=400, detail="Task is invalid")
    row = CustomerAutomationLog(
        lead_purchase_id=purchase.id,
        dsa_id=purchase.buyer_user_id,
        rule_key=rule,
        status=status_value,
        message=message,
        task_id=task_id,
        retry_at=_when(body.retry_at),
        actor_user_id=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": str(row.id), "status": row.status}
