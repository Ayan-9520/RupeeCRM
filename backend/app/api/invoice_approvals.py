"""Staff side of the partner invoice approval chain."""

from __future__ import annotations

import io
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.payouts import HistoryOut, RequestOut, _to_out, history_out
from app.db.session import get_db
from app.models import InvoiceApproval, PayoutRequest, User
from app.services.audit import write_audit
from app.services.invoice_flow import (
    ADMIN_ROLES,
    NOTIFY_LINK_PARTNER,
    PAYMENT_MODES,
    STAGE_LABELS,
    STAGES,
    can_act,
    invoice_number,
    is_staff,
    log_step,
    next_stage,
    notify,
    notify_stage,
    status_for,
)

router = APIRouter(prefix="/api/invoice-approvals", tags=["invoice-approvals"])
IST = timezone(timedelta(hours=5, minutes=30))


class QueueRow(RequestOut):
    can_act: bool = False
    partner_dsa_id: str | None = None
    rm1_name: str | None = None
    rm2_name: str | None = None
    history: list[HistoryOut] = []


class ActionIn(BaseModel):
    action: str = Field(pattern="^(approve|query|reject|processing)$")
    comment: str | None = Field(default=None, max_length=2000)


class PayIn(BaseModel):
    payment_mode: str
    payment_bank: str = Field(min_length=2, max_length=120)
    transaction_id: str = Field(min_length=4, max_length=80)
    payment_date: date
    paid_amount: float | None = Field(default=None, gt=0)
    remarks: str | None = Field(default=None, max_length=2000)


def require_staff(user: User = Depends(get_current_user)) -> User:
    if not is_staff(user):
        raise HTTPException(status_code=403, detail="Invoice approvals are for RM, Manager, Business Head, Accounts or admin")
    return user


def _names(db: Session, ids: set[UUID]) -> dict[UUID, User]:
    if not ids:
        return {}
    return {u.id: u for u in db.query(User).filter(User.id.in_(list(ids))).all()}


def _rows_out(db: Session, rows: list[PayoutRequest], actor: User) -> list[QueueRow]:
    partners = _names(db, {r.user_id for r in rows})
    rm_ids = {p.rm1_user_id for p in partners.values() if p.rm1_user_id} | {
        p.rm2_user_id for p in partners.values() if p.rm2_user_id
    }
    rms = _names(db, rm_ids)
    history: dict[UUID, list[InvoiceApproval]] = {}
    if rows:
        for h in (
            db.query(InvoiceApproval)
            .filter(InvoiceApproval.request_id.in_([r.id for r in rows]))
            .order_by(InvoiceApproval.created_at.asc())
            .all()
        ):
            history.setdefault(h.request_id, []).append(h)
    out: list[QueueRow] = []
    for r in rows:
        partner = partners.get(r.user_id)
        base = _to_out(r, partner).model_dump()
        out.append(
            QueueRow(
                **base,
                can_act=can_act(actor, r, partner),
                partner_dsa_id=partner.dsa_id if partner else None,
                rm1_name=rms[partner.rm1_user_id].full_name if partner and partner.rm1_user_id in rms else None,
                rm2_name=rms[partner.rm2_user_id].full_name if partner and partner.rm2_user_id in rms else None,
                history=[
                    HistoryOut(
                        stage=h.stage,
                        stage_label=STAGE_LABELS.get(h.stage, h.stage),
                        action=h.action,
                        comment=h.comment,
                        actor_name=h.actor_name,
                        created_at=h.created_at,
                    )
                    for h in history.get(r.id, [])
                ],
            )
        )
    return out


def _filtered(
    db: Session,
    stage: str | None,
    date_from: date | None,
    date_to: date | None,
) -> list[PayoutRequest]:
    q = db.query(PayoutRequest).filter(PayoutRequest.stage.isnot(None))
    if stage and stage != "all":
        q = q.filter(PayoutRequest.stage == stage)
    if date_from:
        q = q.filter(PayoutRequest.created_at >= datetime.combine(date_from, datetime.min.time(), IST))
    if date_to:
        q = q.filter(PayoutRequest.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), IST))
    return q.order_by(PayoutRequest.created_at.desc()).limit(500).all()


@router.get("", response_model=list[QueueRow])
def queue(
    scope: str = Query(default="mine", pattern="^(mine|all)$"),
    stage: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> list[QueueRow]:
    rows = _filtered(db, stage, date_from, date_to)
    out = _rows_out(db, rows, user)
    if scope == "mine":
        out = [row for row in out if row.can_act]
    return out


def _load(db: Session, request_id: UUID) -> tuple[PayoutRequest, User | None]:
    row = db.query(PayoutRequest).filter(PayoutRequest.id == request_id, PayoutRequest.stage.isnot(None)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    partner = db.query(User).filter(User.id == row.user_id).first()
    return row, partner


@router.post("/{request_id}/action", response_model=QueueRow)
def act(
    request_id: UUID,
    body: ActionIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> QueueRow:
    row, partner = _load(db, request_id)
    if not can_act(user, row, partner):
        raise HTTPException(status_code=403, detail="This invoice is not at your approval level")
    stage = row.stage or ""
    comment = (body.comment or "").strip()
    number = invoice_number(row)
    if body.action == "approve":
        if stage == "accounts":
            raise HTTPException(status_code=400, detail="Accounts closes the invoice with payment details")
        row.stage = next_stage(stage)
        row.status = status_for(row.stage)
        log_step(db, row, stage, "approved", user, comment)
        notify_stage(db, row, partner)
    elif body.action == "processing":
        if stage != "accounts":
            raise HTTPException(status_code=400, detail="Only Accounts can start payment processing")
        row.status = "processing"
        log_step(db, row, stage, "processing", user, comment)
    elif body.action in {"query", "reject"}:
        if not comment:
            raise HTTPException(status_code=400, detail="Write a note for the partner")
        row.rejection_reason = comment
        if body.action == "query":
            row.queried_stage = stage
            row.stage = "query"
            row.status = "query"
            title = f"Query on invoice {number}"
        else:
            row.stage = "rejected"
            row.status = "rejected"
            title = f"Invoice {number} rejected"
        log_step(db, row, stage, "query" if body.action == "query" else "rejected", user, comment)
        if partner:
            notify(db, [partner], title, comment, NOTIFY_LINK_PARTNER)
    row.reviewed_by = user.id
    row.reviewed_at = datetime.now(timezone.utc)
    write_audit(
        db,
        action=f"invoice_{body.action}",
        actor_user_id=user.id,
        entity_type="payout_request",
        entity_id=str(row.id),
        detail={"stage": stage, "invoice_number": number},
    )
    db.commit()
    db.refresh(row)
    return _rows_out(db, [row], user)[0]


@router.post("/{request_id}/pay", response_model=QueueRow)
def pay(
    request_id: UUID,
    body: PayIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> QueueRow:
    row, partner = _load(db, request_id)
    if row.stage != "accounts":
        raise HTTPException(status_code=400, detail="Invoice is not at the Accounts step")
    if not can_act(user, row, partner):
        raise HTTPException(status_code=403, detail="Only Accounts can record the payment")
    mode = body.payment_mode.strip().upper()
    if mode not in PAYMENT_MODES:
        raise HTTPException(status_code=400, detail="Payment mode must be NEFT, RTGS, IMPS, UPI or CHEQUE")
    if body.payment_date > datetime.now(IST).date():
        raise HTTPException(status_code=400, detail="Payment date cannot be in the future")
    row.payment_mode = mode
    row.payment_bank = body.payment_bank.strip()
    row.utr = body.transaction_id.strip()
    row.payment_date = body.payment_date
    row.paid_amount = round(float(body.paid_amount or row.net_payable or row.amount or 0), 2)
    row.stage = "paid"
    row.status = "paid"
    row.reviewed_by = user.id
    row.reviewed_at = datetime.now(timezone.utc)
    log_step(
        db,
        row,
        "accounts",
        "paid",
        user,
        f"{mode} · {row.utr} · {row.payment_bank}" + (f" · {body.remarks.strip()}" if body.remarks and body.remarks.strip() else ""),
    )
    number = invoice_number(row)
    if partner:
        notify(
            db,
            [partner],
            f"Invoice {number} paid",
            f"Rs {row.paid_amount:,.0f} via {mode}, ref {row.utr}",
            NOTIFY_LINK_PARTNER,
        )
    write_audit(
        db,
        action="invoice_paid",
        actor_user_id=user.id,
        entity_type="payout_request",
        entity_id=str(row.id),
        detail={"invoice_number": number, "mode": mode, "amount": row.paid_amount},
    )
    db.commit()
    db.refresh(row)
    return _rows_out(db, [row], user)[0]


def _fmt_dt(value: datetime | None) -> str:
    return value.astimezone(IST).strftime("%d-%m-%Y %H:%M") if value else ""


@router.get("/export.xlsx")
def export_xlsx(
    stage: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff),
) -> StreamingResponse:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    rows = _rows_out(db, _filtered(db, stage, date_from, date_to), user)
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoices"
    level_cols = [STAGE_LABELS[s] for s in STAGES]
    headers = [
        "Invoice no",
        "Raised on",
        "Partner",
        "Partner email",
        "DSA ID",
        "RM 1",
        "RM 2",
        "Cases",
        "Disbursed total",
        "Commission",
        "GST",
        "TDS",
        "Net payable",
        "Current step",
        "Status",
        *[f"{label} (by / on)" for label in level_cols],
        "Payment mode",
        "Paid from bank",
        "Transaction ID / UTR",
        "Payment date",
        "Paid amount",
        "Query / reject note",
    ]
    ws.append(headers)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="10662A")
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    for r in rows:
        snap = r.bank_snapshot or {}
        done: dict[str, str] = {}
        for h in r.history:
            if h.action in {"approved", "paid"}:
                done[h.stage] = f"{h.actor_name or ''} / {_fmt_dt(h.created_at)}"
        ws.append(
            [
                snap.get("invoice_number") or r.note or "",
                _fmt_dt(r.created_at),
                r.user_name or "",
                r.user_email or "",
                r.partner_dsa_id or "",
                r.rm1_name or "",
                r.rm2_name or "",
                len(snap.get("case_ids") or []),
                float(snap.get("disbursed_total") or 0),
                float(r.amount or 0),
                float(r.gst_amount or 0),
                float(r.tds_amount or 0),
                float(r.net_payable or r.amount or 0),
                r.stage_label or "",
                r.status,
                *[done.get(s, "") for s in STAGES],
                r.payment_mode or "",
                r.payment_bank or "",
                r.utr or "",
                r.payment_date.strftime("%d-%m-%Y") if r.payment_date else "",
                float(r.paid_amount) if r.paid_amount is not None else "",
                r.rejection_reason or "",
            ]
        )
    for idx, _ in enumerate(headers, start=1):
        ws.column_dimensions[ws.cell(row=1, column=idx).column_letter].width = 18
    ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    name = f"RupeeDial-Invoices-{datetime.now(IST).strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


class FinanceIn(BaseModel):
    finance_level: str | None = None
    rm1_user_id: UUID | None = None
    rm2_user_id: UUID | None = None


@router.get("/setup")
def setup(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    users = db.query(User).filter(User.is_active.is_(True)).order_by(User.full_name.asc()).limit(1000).all()
    return {
        "users": [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "finance_level": u.finance_level,
                "rm1_user_id": str(u.rm1_user_id) if u.rm1_user_id else None,
                "rm2_user_id": str(u.rm2_user_id) if u.rm2_user_id else None,
            }
            for u in users
        ]
    }


@router.put("/setup/{user_id}")
def save_setup(
    user_id: UUID,
    body: FinanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    data = body.model_dump(exclude_unset=True)
    if "finance_level" in data:
        level = (data["finance_level"] or "").strip() or None
        if level and level not in {"rm", "manager", "business_head", "accounts"}:
            raise HTTPException(status_code=400, detail="Finance level must be rm, manager, business_head or accounts")
        if level and target.role in {"dsa", "affiliate", "customer"}:
            raise HTTPException(status_code=400, detail="Partners and customers cannot be approvers")
        target.finance_level = level
    for key in ("rm1_user_id", "rm2_user_id"):
        if key in data:
            rm_id = data[key]
            if rm_id:
                rm = db.query(User).filter(User.id == rm_id, User.is_active.is_(True)).first()
                if not rm or rm.finance_level != "rm":
                    raise HTTPException(status_code=400, detail="Pick a user whose finance level is RM")
                if rm.id == target.id:
                    raise HTTPException(status_code=400, detail="A partner cannot be their own RM")
            setattr(target, key, rm_id)
    if target.rm1_user_id and target.rm1_user_id == target.rm2_user_id:
        raise HTTPException(status_code=400, detail="RM 1 and RM 2 must be different people")
    write_audit(
        db,
        action="finance_setup",
        actor_user_id=user.id,
        entity_type="user",
        entity_id=str(target.id),
        detail={k: (str(v) if v else None) for k, v in data.items()},
    )
    db.commit()
    return {"success": True}
