"""Lender rate sheets and case-only adjustments.

Receivable is what the lender pays RupeeDial.
Payable percent is the connector's share of that receivable.
This matches loan case closure math and does not touch GST or TDS.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import LoanCase, PayoutAdjustment, PayoutGrid, User
from app.services.audit import write_audit

KINDS = ("subvention", "special", "clawback", "other")
LOCKED_PAYOUTS = {"paid", "setoff"}


def _round(value: float) -> float:
    return round(float(value or 0), 2)


def quote(
    amount: float,
    receivable_percent: float,
    payable_percent: float,
    subvention_points: float = 0,
    other_points: float = 0,
) -> dict:
    if amount < 0:
        raise HTTPException(status_code=400, detail="Amount cannot be negative")
    if not 0 <= payable_percent <= 100:
        raise HTTPException(status_code=400, detail="DSA share must be between 0 and 100")
    effective = _round(receivable_percent - subvention_points - other_points)
    if effective < 0 or effective > 100:
        raise HTTPException(status_code=400, detail="Rate after deductions must stay between 0 and 100")
    gross = _round(amount * effective / 100)
    payable = _round(gross * payable_percent / 100)
    left = _round(gross - payable)
    agent = _round(left / 2)
    company = _round(left - agent)
    return {
        "amount": _round(amount),
        "effective_percent": effective,
        "gross_commission": gross,
        "dsa_payout": payable,
        "left_before_split": left,
        "agent_share": agent,
        "company_net": company,
    }


def _grid_out(row: PayoutGrid, names: dict[UUID, str]) -> dict:
    return {
        "id": str(row.id),
        "channel_name": row.channel_name,
        "product": row.product,
        "effective_from": row.effective_from.isoformat(),
        "receivable_percent": float(row.receivable_percent),
        "payable_percent": float(row.payable_percent),
        "note": row.note,
        "status": row.status,
        "created_by_name": names.get(row.created_by) if row.created_by else None,
        "approved_by_name": names.get(row.approved_by) if row.approved_by else None,
        "approved_at": row.approved_at.isoformat() if row.approved_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _names(db: Session, rows: list) -> dict[UUID, str]:
    ids = {i for row in rows for i in (getattr(row, "created_by", None), getattr(row, "approved_by", None)) if i}
    if not ids:
        return {}
    users = db.query(User).filter(User.id.in_(ids)).all()
    return {u.id: u.full_name for u in users}


def list_grids(db: Session) -> list[dict]:
    rows = db.query(PayoutGrid).order_by(PayoutGrid.effective_from.desc(), PayoutGrid.created_at.desc()).all()
    names = _names(db, rows)
    return [_grid_out(row, names) for row in rows]


def create_grid(db: Session, actor: User, payload: dict) -> dict:
    channel = str(payload["channel_name"]).strip()
    product = str(payload["product"]).strip()
    if not channel or not product:
        raise HTTPException(status_code=400, detail="Lender and product are required")
    receivable = float(payload["receivable_percent"])
    payable = float(payload["payable_percent"])
    if receivable < 0 or receivable > 100 or not 0 <= payable <= 100:
        raise HTTPException(status_code=400, detail="Check the percents")
    row = PayoutGrid(
        channel_name=channel,
        product=product,
        effective_from=payload["effective_from"],
        receivable_percent=receivable,
        payable_percent=payable,
        note=str(payload.get("note") or "").strip(),
        status="pending",
        created_by=actor.id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="payout_grid_submit",
        actor_user_id=actor.id,
        entity_type="payout_grid",
        entity_id=str(row.id),
        detail={"channel": channel, "product": product, "from": row.effective_from.isoformat()},
    )
    db.commit()
    db.refresh(row)
    return _grid_out(row, {actor.id: actor.full_name})


def decide_grid(db: Session, actor: User, grid_id: UUID, approve: bool) -> dict:
    row = db.query(PayoutGrid).filter(PayoutGrid.id == grid_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Rate sheet not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending sheet can be approved or rejected")
    if approve:
        clash = (
            db.query(PayoutGrid)
            .filter(
                PayoutGrid.id != row.id,
                PayoutGrid.status == "approved",
                PayoutGrid.channel_name == row.channel_name,
                PayoutGrid.product == row.product,
                PayoutGrid.effective_from == row.effective_from,
            )
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="An approved sheet already starts on this date for this lender and product")
        row.status = "approved"
        row.approved_by = actor.id
        row.approved_at = datetime.now(timezone.utc)
    else:
        row.status = "rejected"
        row.approved_by = actor.id
        row.approved_at = datetime.now(timezone.utc)
    write_audit(
        db,
        action="payout_grid_approve" if approve else "payout_grid_reject",
        actor_user_id=actor.id,
        entity_type="payout_grid",
        entity_id=str(row.id),
        detail={"status": row.status},
    )
    db.commit()
    db.refresh(row)
    return _grid_out(row, _names(db, [row]))


def rate_for(db: Session, channel: str, product: str, on: date) -> dict | None:
    row = (
        db.query(PayoutGrid)
        .filter(
            PayoutGrid.status == "approved",
            PayoutGrid.channel_name.ilike(channel.strip()),
            PayoutGrid.product.ilike(product.strip()),
            PayoutGrid.effective_from <= on,
        )
        .order_by(PayoutGrid.effective_from.desc())
        .first()
    )
    if not row:
        return None
    return _grid_out(row, _names(db, [row]))


def _case_locked(row: LoanCase) -> str | None:
    if row.payout_status in LOCKED_PAYOUTS:
        return "This case payout is already paid or set off"
    if row.stage == "collected" or float(row.collected_amount or 0) > 0:
        return "Money is already collected on this case"
    return None


def _adj_out(row: PayoutAdjustment, names: dict[UUID, str]) -> dict:
    return {
        "id": str(row.id),
        "deal_no": row.deal_no,
        "kind": row.kind,
        "subvention_points": float(row.subvention_points or 0),
        "other_points": float(row.other_points or 0),
        "payable_percent": None if row.payable_percent is None else float(row.payable_percent),
        "reason": row.reason,
        "before_receivable": row.before_receivable,
        "before_payable": row.before_payable,
        "after_receivable": row.after_receivable,
        "after_payable": row.after_payable,
        "status": row.status,
        "created_by_name": names.get(row.created_by) if row.created_by else None,
        "approved_by_name": names.get(row.approved_by) if row.approved_by else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_adjustments(db: Session) -> list[dict]:
    rows = db.query(PayoutAdjustment).order_by(PayoutAdjustment.created_at.desc()).limit(50).all()
    names = _names(db, rows)
    return [_adj_out(row, names) for row in rows]


def create_adjustment(db: Session, actor: User, payload: dict) -> dict:
    deal = str(payload["deal_no"]).strip()
    case = db.query(LoanCase).filter(LoanCase.deal_no == deal).first()
    if not case:
        raise HTTPException(status_code=404, detail="No closure file with that deal number")
    locked = _case_locked(case)
    if locked:
        raise HTTPException(status_code=400, detail=locked)
    kind = str(payload.get("kind") or "subvention")
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail="Unknown adjustment type")
    reason = str(payload.get("reason") or "").strip()
    if len(reason) < 4:
        raise HTTPException(status_code=400, detail="Write a reason")
    subvention = float(payload.get("subvention_points") or 0)
    other = float(payload.get("other_points") or 0)
    payable = payload.get("payable_percent")
    if subvention < 0 or other < 0:
        raise HTTPException(status_code=400, detail="Deductions cannot be negative")
    if payable is not None and not 0 <= float(payable) <= 100:
        raise HTTPException(status_code=400, detail="DSA share must be between 0 and 100")
    quote(
        float(case.sanctioned_amount or 0) or float(case.loan_amount or 0),
        float(case.receivable_percent or 0),
        float(payable if payable is not None else case.payable_percent or 0),
        subvention,
        other,
    )
    row = PayoutAdjustment(
        loan_case_id=case.id,
        deal_no=case.deal_no,
        kind=kind,
        subvention_points=subvention,
        other_points=other,
        payable_percent=None if payable is None else float(payable),
        reason=reason,
        status="pending",
        created_by=actor.id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db,
        action="payout_adjustment_submit",
        actor_user_id=actor.id,
        entity_type="payout_adjustment",
        entity_id=str(row.id),
        detail={"deal_no": case.deal_no, "kind": kind},
    )
    db.commit()
    db.refresh(row)
    return _adj_out(row, {actor.id: actor.full_name})


def decide_adjustment(db: Session, actor: User, adjustment_id: UUID, approve: bool) -> dict:
    row = db.query(PayoutAdjustment).filter(PayoutAdjustment.id == adjustment_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    if row.status != "pending":
        raise HTTPException(status_code=400, detail="Only a pending adjustment can be approved or rejected")
    case = db.query(LoanCase).filter(LoanCase.id == row.loan_case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Closure file is gone")
    if approve:
        locked = _case_locked(case)
        if locked:
            raise HTTPException(status_code=400, detail=locked)
        before_r = float(case.receivable_percent or 0)
        before_p = float(case.payable_percent or 0)
        after_p = before_p if row.payable_percent is None else float(row.payable_percent)
        quoted = quote(
            float(case.sanctioned_amount or 0) or float(case.loan_amount or 0),
            before_r,
            after_p,
            float(row.subvention_points or 0),
            float(row.other_points or 0),
        )
        row.before_receivable = before_r
        row.before_payable = before_p
        row.after_receivable = quoted["effective_percent"]
        row.after_payable = after_p
        case.receivable_percent = quoted["effective_percent"]
        case.payable_percent = after_p
        row.status = "approved"
    else:
        row.status = "rejected"
    row.approved_by = actor.id
    row.approved_at = datetime.now(timezone.utc)
    write_audit(
        db,
        action="payout_adjustment_approve" if approve else "payout_adjustment_reject",
        actor_user_id=actor.id,
        entity_type="loan_case",
        entity_id=str(case.id),
        detail={"deal_no": case.deal_no, "status": row.status, "after_receivable": row.after_receivable},
    )
    db.commit()
    db.refresh(row)
    return _adj_out(row, _names(db, [row]))
