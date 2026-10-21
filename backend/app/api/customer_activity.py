"""Follow-up history, lender login tracking, and a read-only activity timeline."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.customer_workspace import _require_purchase
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    CustomerBankLogin,
    CustomerDocumentEvent,
    CustomerFollowup,
    CustomerProfile,
    CustomerCasePayout,
    CustomerDisbursal,
    CustomerSanctionDisbursal,
    CustomerTask,
    LeadPurchase,
    User,
)

router = APIRouter(prefix="/api", tags=["customer-activity"])

ROW_LIMIT = 40
NOTE_TYPES = {"call", "whatsapp", "meeting", "email", "other"}
PRIORITIES = {"low", "medium", "high"}
LOGIN_STATUSES = {
    "draft",
    "logged_in",
    "under_review",
    "approved",
    "rejected",
    "sanctioned",
    "disbursed",
    "closed",
}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^\d{2}:\d{2}$")
TIMELINE_TYPES = {"call", "whatsapp", "email", "meeting"}


class FollowupIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    note_type: str | None = None
    followup_date: str | None = None
    followup_time: str | None = None
    priority: str | None = None
    discussion_notes: str | None = None
    outcome: str | None = None
    next_action: str | None = None
    completed: bool | None = None


class BankLoginIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    bank_name: str | None = None
    product: str | None = None
    login_date: str | None = None
    login_amount: float | None = None
    roi_percent: float | None = None
    tenure_months: float | None = None
    banker_name: str | None = None
    banker_mobile: str | None = None
    branch: str | None = None
    login_status: str | None = None
    sanction_amount: float | None = None
    approved_amount: float | None = None
    rejection_reason: str | None = None
    processing_fees: float | None = None
    disbursal_status: str | None = None
    expected_disbursal_date: str | None = None
    sort_order: int | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _text(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > limit:
        raise HTTPException(status_code=400, detail=f"Value is longer than {limit} characters")
    return text


def _day(value: str | None) -> str | None:
    text = _text(value, 10)
    if text is None:
        return None
    if not DATE_RE.match(text):
        raise HTTPException(status_code=400, detail="Enter a valid date")
    try:
        date.fromisoformat(text)
    except ValueError:
        raise HTTPException(status_code=400, detail="Enter a valid date")
    return text


def _clock(value: str | None) -> str | None:
    text = _text(value, 5)
    if text is None:
        return None
    if not TIME_RE.match(text):
        raise HTTPException(status_code=400, detail="Enter a valid time")
    hour, minute = text.split(":")
    if int(hour) > 23 or int(minute) > 59:
        raise HTTPException(status_code=400, detail="Enter a valid time")
    return text


def _money(value: float | None) -> float | None:
    if value is None:
        return None
    amount = float(value)
    if amount < 0 or amount > 1_000_000_000_000:
        raise HTTPException(status_code=400, detail="Amount is out of range")
    return amount


def _roi(value: float | None) -> float | None:
    if value is None:
        return None
    rate = float(value)
    if rate < 0 or rate > 100:
        raise HTTPException(status_code=400, detail="ROI must be between 0 and 100")
    return rate


def _tenure(value: float | None) -> int | None:
    if value is None:
        return None
    months = int(round(float(value)))
    if months < 0 or months > 600:
        raise HTTPException(status_code=400, detail="Tenure must be between 0 and 600 months")
    return months


def _mobile(value: str | None) -> str | None:
    text = _text(value, 20)
    if text is None:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Banker mobile must be 10 digits")
    return digits


def _profile(db: Session, purchase: LeadPurchase) -> CustomerProfile:
    profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Open the customer workspace before saving this record")
    return profile


def _followup_out(row: CustomerFollowup) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "dsa_id": str(row.dsa_id),
        "note_type": row.note_type,
        "followup_date": row.followup_date,
        "followup_time": row.followup_time,
        "priority": row.priority,
        "assigned_user_id": str(row.assigned_user_id) if row.assigned_user_id else None,
        "discussion_notes": row.discussion_notes,
        "outcome": row.outcome,
        "next_action": row.next_action,
        "completed": row.completed,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _bank_out(row: CustomerBankLogin) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "dsa_id": str(row.dsa_id),
        "bank_name": row.bank_name,
        "product": row.product,
        "login_date": row.login_date,
        "login_amount": row.login_amount,
        "roi_percent": row.roi_percent,
        "tenure_months": row.tenure_months,
        "banker_name": row.banker_name,
        "banker_mobile": row.banker_mobile,
        "branch": row.branch,
        "login_status": row.login_status,
        "sanction_amount": row.sanction_amount,
        "approved_amount": row.approved_amount,
        "rejection_reason": row.rejection_reason,
        "processing_fees": row.processing_fees,
        "disbursal_status": row.disbursal_status,
        "expected_disbursal_date": row.expected_disbursal_date,
        "sort_order": row.sort_order,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def _owned_followup(db: Session, user: User, row_id: UUID) -> CustomerFollowup:
    row = db.query(CustomerFollowup).filter(CustomerFollowup.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


def _owned_bank(db: Session, user: User, row_id: UUID) -> CustomerBankLogin:
    row = db.query(CustomerBankLogin).filter(CustomerBankLogin.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Bank login not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


def _apply_followup(row: CustomerFollowup, body: FollowupIn, present: set[str]) -> None:
    if "note_type" in present:
        note_type = (body.note_type or "other").strip().lower()
        if note_type not in NOTE_TYPES:
            raise HTTPException(status_code=400, detail="Invalid follow-up type")
        row.note_type = note_type
    if "followup_date" in present:
        row.followup_date = _day(body.followup_date)
    if "followup_time" in present:
        row.followup_time = _clock(body.followup_time)
    if "priority" in present:
        priority = (body.priority or "medium").strip().lower()
        if priority not in PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")
        row.priority = priority
    if "discussion_notes" in present:
        row.discussion_notes = _text(body.discussion_notes, 4000)
    if "outcome" in present:
        row.outcome = _text(body.outcome, 200)
    if "next_action" in present:
        row.next_action = _text(body.next_action, 200)
    if "completed" in present and body.completed is not None:
        row.completed = bool(body.completed)


def _apply_bank(row: CustomerBankLogin, body: BankLoginIn, present: set[str]) -> None:
    if "bank_name" in present:
        row.bank_name = _text(body.bank_name, 120)
    if "product" in present:
        row.product = _text(body.product, 120)
    if "login_date" in present:
        row.login_date = _day(body.login_date)
    if "login_amount" in present:
        row.login_amount = _money(body.login_amount)
    if "roi_percent" in present:
        row.roi_percent = _roi(body.roi_percent)
    if "tenure_months" in present:
        row.tenure_months = _tenure(body.tenure_months)
    if "banker_name" in present:
        row.banker_name = _text(body.banker_name, 120)
    if "banker_mobile" in present:
        row.banker_mobile = _mobile(body.banker_mobile)
    if "branch" in present:
        row.branch = _text(body.branch, 120)
    if "login_status" in present:
        status_value = (body.login_status or "draft").strip().lower()
        if status_value not in LOGIN_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid login status")
        row.login_status = status_value
    if "sanction_amount" in present:
        row.sanction_amount = _money(body.sanction_amount)
    if "approved_amount" in present:
        row.approved_amount = _money(body.approved_amount)
    if "rejection_reason" in present:
        row.rejection_reason = _text(body.rejection_reason, 2000)
    if "processing_fees" in present:
        row.processing_fees = _money(body.processing_fees)
    if "disbursal_status" in present:
        row.disbursal_status = _text(body.disbursal_status, 80)
    if "expected_disbursal_date" in present:
        row.expected_disbursal_date = _day(body.expected_disbursal_date)
    if "sort_order" in present and body.sort_order is not None:
        order = int(body.sort_order)
        if order < 0 or order > 500:
            raise HTTPException(status_code=400, detail="Sort order is out of range")
        row.sort_order = order


@router.get("/my-leads/{purchase_id}/followups")
def list_followups(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerFollowup)
        .filter(CustomerFollowup.lead_purchase_id == purchase.id)
        .order_by(CustomerFollowup.created_at.desc())
        .all()
    )
    return {"rows": [_followup_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/followups")
def create_followup(
    purchase_id: UUID,
    body: FollowupIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerFollowup).filter(CustomerFollowup.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Follow-up limit reached")
    present = set(body.model_fields_set) or {"discussion_notes", "note_type", "priority", "completed"}
    notes = _text(body.discussion_notes, 4000)
    if notes is None and _day(body.followup_date) is None:
        raise HTTPException(status_code=400, detail="Add notes or a follow-up date")
    row = CustomerFollowup(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        assigned_user_id=user.id,
        note_type="other",
        priority="medium",
        completed=False,
    )
    _apply_followup(row, body, present)
    if row.discussion_notes is None and row.followup_date is None:
        raise HTTPException(status_code=400, detail="Add notes or a follow-up date")
    db.add(row)
    db.commit()
    db.refresh(row)
    return _followup_out(row)


@router.patch("/customer-followups/{followup_id}")
def update_followup(
    followup_id: UUID,
    body: FollowupIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_followup(db, user, followup_id)
    _apply_followup(row, body, set(body.model_fields_set))
    db.commit()
    db.refresh(row)
    return _followup_out(row)


@router.delete("/customer-followups/{followup_id}")
def delete_followup(followup_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_followup(db, user, followup_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/my-leads/{purchase_id}/bank-logins")
def list_bank_logins(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerBankLogin)
        .filter(CustomerBankLogin.lead_purchase_id == purchase.id)
        .order_by(CustomerBankLogin.sort_order, CustomerBankLogin.created_at)
        .all()
    )
    return {"rows": [_bank_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/bank-logins")
def create_bank_login(
    purchase_id: UUID,
    body: BankLoginIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerBankLogin).filter(CustomerBankLogin.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Bank login limit reached")
    row = CustomerBankLogin(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        login_status="draft",
        sort_order=count,
    )
    _apply_bank(row, body, set(body.model_fields_set))
    db.add(row)
    db.commit()
    db.refresh(row)
    return _bank_out(row)


@router.patch("/customer-bank-logins/{login_id}")
def update_bank_login(
    login_id: UUID,
    body: BankLoginIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_bank(db, user, login_id)
    _apply_bank(row, body, set(body.model_fields_set))
    db.commit()
    db.refresh(row)
    return _bank_out(row)


@router.delete("/customer-bank-logins/{login_id}")
def delete_bank_login(login_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_bank(db, user, login_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


def _note_type(note: dict[str, Any]) -> str:
    kind = str(note.get("kind") or "note")
    text = str(note.get("text") or "")
    if kind in {"stage", "disposition"}:
        return "stage"
    if text.startswith("Call:"):
        return "call"
    if text.startswith("Follow-up:"):
        return "followup"
    return "note"


def _entry(entry_id: str, activity: str, title: str, body: str, created_at: str, created_by: str | None = None) -> dict:
    return {
        "id": entry_id,
        "activity_type": activity,
        "title": title,
        "body": body,
        "metadata": {},
        "created_by": created_by,
        "created_at": created_at,
    }


@router.get("/my-leads/{purchase_id}/timeline")
def activity_timeline(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    entries: list[dict] = []
    purchased_at = _iso(purchase.created_at)
    if purchased_at:
        entries.append(_entry("purchased", "stage", "Purchased", "Lead purchased", purchased_at))
    for index, note in enumerate(list(purchase.notes or [])):
        if not isinstance(note, dict):
            continue
        created = str(note.get("at") or "")
        if not created:
            continue
        text = str(note.get("text") or "").strip()
        if not text:
            continue
        activity = _note_type(note)
        entries.append(_entry(f"note-{index}", activity, activity.replace("_", " ").title(), text, created, note.get("by")))

    events = (
        db.query(CustomerDocumentEvent)
        .filter(CustomerDocumentEvent.lead_purchase_id == purchase.id)
        .order_by(CustomerDocumentEvent.created_at.desc())
        .limit(100)
        .all()
    )
    for event in events:
        created = _iso(event.created_at)
        if not created:
            continue
        detail = event.file_name or event.action
        if event.status:
            detail = f"{detail} · {event.status}"
        if event.note:
            detail = f"{detail} · {event.note[:180]}"
        entries.append(
            _entry(
                str(event.id),
                "document",
                f"Document {event.action}",
                detail,
                created,
                str(event.actor_user_id) if event.actor_user_id else None,
            )
        )

    followups = (
        db.query(CustomerFollowup)
        .filter(CustomerFollowup.lead_purchase_id == purchase.id)
        .order_by(CustomerFollowup.created_at.desc())
        .limit(100)
        .all()
    )
    for row in followups:
        created = _iso(row.created_at)
        if not created:
            continue
        activity = row.note_type if row.note_type in TIMELINE_TYPES else "followup"
        parts = [row.discussion_notes or "Follow-up"]
        if row.outcome:
            parts.append(row.outcome)
        if row.next_action:
            parts.append(row.next_action)
        if row.followup_date:
            parts.append(row.followup_date)
        entries.append(_entry(str(row.id), activity, f"{row.note_type} follow-up", " · ".join(parts), created))

    logins = (
        db.query(CustomerBankLogin)
        .filter(CustomerBankLogin.lead_purchase_id == purchase.id)
        .order_by(CustomerBankLogin.created_at.desc())
        .limit(40)
        .all()
    )
    for row in logins:
        created = _iso(row.created_at)
        if not created:
            continue
        label = row.bank_name or "Bank"
        product = f" · {row.product}" if row.product else ""
        entries.append(_entry(str(row.id), "login", "Bank login", f"{label}{product} · {row.login_status}", created))

    tasks = (
        db.query(CustomerTask)
        .filter(CustomerTask.lead_purchase_id == purchase.id)
        .order_by(CustomerTask.created_at.desc())
        .limit(40)
        .all()
    )
    for row in tasks:
        created = _iso(row.created_at)
        if created:
            entries.append(_entry(str(row.id), "task", "Task", f"{row.title} · {row.status}", created))

    sanction = (
        db.query(CustomerSanctionDisbursal)
        .filter(CustomerSanctionDisbursal.lead_purchase_id == purchase.id)
        .first()
    )
    if sanction and sanction.created_at:
        amount = f"₹{sanction.sanction_amount:g}" if sanction.sanction_amount is not None else "Recorded"
        entries.append(_entry(str(sanction.id), "sanction", "Sanction", amount, _iso(sanction.created_at) or ""))

    disbursals = (
        db.query(CustomerDisbursal)
        .filter(CustomerDisbursal.lead_purchase_id == purchase.id)
        .order_by(CustomerDisbursal.created_at.desc())
        .limit(40)
        .all()
    )
    for row in disbursals:
        created = _iso(row.created_at)
        if not created:
            continue
        figure = f" · ₹{row.disbursed_amount:g}" if row.disbursed_amount is not None else ""
        entries.append(_entry(str(row.id), "disbursal", "Disbursal", f"{row.disbursal_status}{figure}", created))

    payouts = (
        db.query(CustomerCasePayout)
        .filter(CustomerCasePayout.lead_purchase_id == purchase.id)
        .order_by(CustomerCasePayout.created_at.desc())
        .limit(40)
        .all()
    )
    for row in payouts:
        created = _iso(row.created_at)
        if not created:
            continue
        figure = f" · ₹{row.payout_amount:g}" if row.payout_amount is not None else ""
        entries.append(_entry(str(row.id), "payout", "Payout", f"{row.payout_type} · {row.payout_status}{figure}", created))

    entries.sort(key=lambda item: item["created_at"], reverse=True)
    return {"entries": entries[:150]}
