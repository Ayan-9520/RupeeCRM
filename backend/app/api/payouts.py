"""Phase 6: partner payout requests (manual bank settle)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.entitlements import has_module
from app.models import Lead, LeadPurchase, PayoutRequest, User
from app.plans import PAYOUT_MIN
from app.services.audit import write_audit
from app.services.commission import get_percent, rate_fraction

router = APIRouter(prefix="/api/payouts", tags=["payouts"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}
HELD_STATUSES = ("pending", "approved", "processing", "query", "paid")


def _bank_complete(bank: dict | None) -> bool:
    b = bank or {}
    return bool(
        (b.get("account_holder") or "").strip()
        and (b.get("account_number") or "").strip()
        and (b.get("ifsc") or "").strip()
        and (b.get("bank_name") or "").strip()
    )


def _disbursed_purchases(db: Session, user_id: UUID) -> list[LeadPurchase]:
    rows = (
        db.query(LeadPurchase)
        .filter(LeadPurchase.buyer_user_id == user_id)
        .all()
    )
    return [row for row in rows if row.converted or row.pipeline_stage == "disbursed"]


def _case_base(db: Session, purchase: LeadPurchase) -> float:
    if purchase.deal_value:
        return float(purchase.deal_value)
    lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
    return float(lead.loan_amount or 0) if lead else 0.0


def _earned(db: Session, user_id: UUID) -> float:
    """Eligible commission on disbursed cases, not the loan amount."""
    total = sum(_case_base(db, row) * rate_fraction(db) for row in _disbursed_purchases(db, user_id))
    return round(float(total), 2)


def _locked(db: Session, user_id: UUID) -> float:
    rows = (
        db.query(PayoutRequest)
        .filter(
            PayoutRequest.user_id == user_id,
            PayoutRequest.status.in_(HELD_STATUSES),
        )
        .all()
    )
    return float(sum(float(r.amount or 0) for r in rows))


def _taken_case_ids(db: Session, user_id: UUID) -> set[str]:
    rows = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user_id, PayoutRequest.status.in_(HELD_STATUSES))
        .all()
    )
    taken: set[str] = set()
    for row in rows:
        for case_id in (row.bank_snapshot or {}).get("case_ids") or []:
            taken.add(str(case_id))
    return taken


def _paid(db: Session, user_id: UUID) -> float:
    rows = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user_id, PayoutRequest.status.in_(("approved", "paid")))
        .all()
    )
    return float(sum(float(r.amount or 0) for r in rows))


class BankIn(BaseModel):
    account_holder: str = ""
    account_number: str = ""
    ifsc: str = ""
    bank_name: str = ""
    pan: str = ""


class BankOut(BaseModel):
    account_holder: str = ""
    account_number: str = ""
    ifsc: str = ""
    bank_name: str = ""
    pan: str = ""
    complete: bool = False


class SummaryOut(BaseModel):
    earned: float
    paid_out: float
    pending: float
    available: float
    payout_min: int
    bank: BankOut
    can_request: bool
    kyc_verified: bool = False
    policy: str = "Invoices use 1% of the disbursed case value. Lead wallet credits are not paid out."


class RequestIn(BaseModel):
    amount: float = Field(gt=0)
    note: str | None = None


class RequestOut(BaseModel):
    id: UUID
    user_id: UUID
    amount: float
    status: str
    bank_snapshot: dict
    note: str | None = None
    rejection_reason: str | None = None
    utr: str | None = None
    created_at: datetime | None = None
    reviewed_at: datetime | None = None
    user_email: str | None = None
    user_name: str | None = None

    model_config = {"from_attributes": True}


class AdminActionIn(BaseModel):
    action: str = Field(pattern="^(approve|reject|paid|processing|query)$")
    utr: str | None = None
    rejection_reason: str | None = None


class InvoiceCaseOut(BaseModel):
    purchase_id: UUID
    applicant_name: str
    product: str
    city: str
    disbursed: float
    commission: float
    invoiced: bool


class InvoiceCentreOut(BaseModel):
    rate: float
    expected: float
    pending: float
    invoice_raised: float
    approved: float
    processing: float
    paid: float
    rejected: float
    cases: list[InvoiceCaseOut]
    requests: list[RequestOut]


def _to_out(r: PayoutRequest, user: User | None = None) -> RequestOut:
    return RequestOut(
        id=r.id,
        user_id=r.user_id,
        amount=float(r.amount),
        status=r.status,
        bank_snapshot=r.bank_snapshot or {},
        note=r.note,
        rejection_reason=r.rejection_reason,
        utr=r.utr,
        created_at=r.created_at,
        reviewed_at=r.reviewed_at,
        user_email=user.email if user else None,
        user_name=user.full_name if user else None,
    )


@router.get("/summary", response_model=SummaryOut)
def payout_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SummaryOut:
    bank = dict(user.payout_bank or {})
    earned = _earned(db, user.id)
    paid = _paid(db, user.id)
    pending_rows = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user.id, PayoutRequest.status == "pending")
        .all()
    )
    pending = float(sum(float(r.amount or 0) for r in pending_rows))
    available = max(0.0, round(earned - _locked(db, user.id), 2))
    complete = _bank_complete(bank)
    can = (
        (has_module(user, "payouts") or user.role in ADMIN_ROLES)
        and complete
        and available >= PAYOUT_MIN
        and pending == 0
        and (user.kyc_verified or user.role in ADMIN_ROLES)
    )
    # Mask account number in response except last 4
    acct = bank.get("account_number") or ""
    masked = (("*" * max(0, len(acct) - 4)) + acct[-4:]) if acct else ""
    return SummaryOut(
        earned=earned,
        paid_out=paid,
        pending=pending,
        available=available,
        payout_min=PAYOUT_MIN,
        bank=BankOut(
            account_holder=bank.get("account_holder") or "",
            account_number=masked,
            ifsc=bank.get("ifsc") or "",
            bank_name=bank.get("bank_name") or "",
            pan=bank.get("pan") or "",
            complete=complete,
        ),
        can_request=can,
        kyc_verified=bool(user.kyc_verified),
        policy=f"Invoices use {get_percent(db):g}% of the disbursed case value. Lead wallet credits are not paid out.",
    )


@router.get("/bank", response_model=BankOut)
def get_bank(user: User = Depends(get_current_user)) -> BankOut:
    bank = dict(user.payout_bank or {})
    return BankOut(
        account_holder=bank.get("account_holder") or "",
        account_number=bank.get("account_number") or "",
        ifsc=bank.get("ifsc") or "",
        bank_name=bank.get("bank_name") or "",
        pan=bank.get("pan") or "",
        complete=_bank_complete(bank),
    )


@router.put("/bank", response_model=BankOut)
def put_bank(
    body: BankIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BankOut:
    ifsc = (body.ifsc or "").strip().upper()
    data = {
        "account_holder": (body.account_holder or "").strip(),
        "account_number": (body.account_number or "").strip().replace(" ", ""),
        "ifsc": ifsc,
        "bank_name": (body.bank_name or "").strip(),
        "pan": (body.pan or "").strip().upper(),
    }
    user.payout_bank = data
    db.commit()
    db.refresh(user)
    return BankOut(**data, complete=_bank_complete(data))


@router.get("/requests", response_model=list[RequestOut])
def list_my_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[RequestOut]:
    rows = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user.id)
        .order_by(PayoutRequest.created_at.desc())
        .limit(50)
        .all()
    )
    return [_to_out(r, user) for r in rows]


@router.post("/requests", response_model=RequestOut)
def create_request(
    body: RequestIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RequestOut:
    if not (has_module(user, "payouts") or user.role in ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Payouts not enabled on your plan")
    if not user.kyc_verified and user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="KYC verification required before first payout")
    bank = dict(user.payout_bank or {})
    if not _bank_complete(bank):
        raise HTTPException(status_code=400, detail="Complete bank details in Settings first")
    amount = float(body.amount)
    if amount < PAYOUT_MIN:
        raise HTTPException(status_code=400, detail=f"Minimum payout is ₹{PAYOUT_MIN}")
    earned = _earned(db, user.id)
    pending_rows = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user.id, PayoutRequest.status == "pending")
        .all()
    )
    if pending_rows:
        raise HTTPException(status_code=400, detail="You already have a pending payout request")
    pending = float(sum(float(r.amount or 0) for r in pending_rows))
    available = max(0.0, round(earned - _locked(db, user.id), 2))
    if amount > available + 0.01:
        raise HTTPException(status_code=400, detail=f"Available balance is ₹{available:.0f}")

    row = PayoutRequest(
        id=uuid4(),
        user_id=user.id,
        amount=amount,
        status="pending",
        bank_snapshot=bank,
        note=(body.note or "").strip() or None,
    )
    db.add(row)
    write_audit(
        db,
        action="payout_request",
        actor_user_id=user.id,
        entity_type="payout_request",
        entity_id=str(row.id),
        detail={"amount": amount},
    )
    db.commit()
    db.refresh(row)
    return _to_out(row, user)


def _sum_status(rows: list[PayoutRequest], *statuses: str) -> float:
    return round(sum(float(row.amount or 0) for row in rows if row.status in statuses), 2)


@router.get("/centre", response_model=InvoiceCentreOut)
def invoice_centre(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> InvoiceCentreOut:
    purchases = _disbursed_purchases(db, user.id)
    taken = _taken_case_ids(db, user.id)
    cases: list[InvoiceCaseOut] = []
    for purchase in purchases:
        lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
        disbursed = _case_base(db, purchase)
        cases.append(
            InvoiceCaseOut(
                purchase_id=purchase.id,
                applicant_name=lead.applicant_name if lead else "Case",
                product=(lead.product_subtype if lead and lead.product_subtype else "Loan"),
                city=lead.city if lead else "",
                disbursed=disbursed,
                commission=round(disbursed * rate_fraction(db), 2),
                invoiced=str(purchase.id) in taken,
            )
        )
    requests = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user.id)
        .order_by(PayoutRequest.created_at.desc())
        .limit(50)
        .all()
    )
    expected = round(sum(item.commission for item in cases), 2)
    pending = round(sum(item.commission for item in cases if not item.invoiced), 2)
    return InvoiceCentreOut(
        rate=rate_fraction(db),
        expected=expected,
        pending=pending,
        invoice_raised=_sum_status(requests, "pending"),
        approved=_sum_status(requests, "approved"),
        processing=_sum_status(requests, "processing"),
        paid=_sum_status(requests, "paid"),
        rejected=_sum_status(requests, "rejected", "query"),
        cases=cases,
        requests=[_to_out(row, user) for row in requests],
    )


@router.post("/invoices", response_model=RequestOut)
def raise_invoice(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RequestOut:
    if not (has_module(user, "payouts") or user.role in ADMIN_ROLES):
        raise HTTPException(status_code=403, detail="Payouts not enabled on your plan")
    if not user.kyc_verified and user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="KYC verification required before the first invoice")
    bank = dict(user.payout_bank or {})
    if not _bank_complete(bank):
        raise HTTPException(status_code=400, detail="Add bank details before raising an invoice")
    pending = (
        db.query(PayoutRequest)
        .filter(PayoutRequest.user_id == user.id, PayoutRequest.status == "pending")
        .first()
    )
    if pending:
        raise HTTPException(status_code=400, detail="An invoice is already waiting for admin review")

    taken = _taken_case_ids(db, user.id)
    selected = [row for row in _disbursed_purchases(db, user.id) if str(row.id) not in taken]
    if not selected:
        raise HTTPException(status_code=400, detail="No disbursed cases are waiting for an invoice")
    disbursed_total = round(sum(_case_base(db, row) for row in selected), 2)
    rate = rate_fraction(db)
    amount = round(disbursed_total * rate, 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Eligible commission is zero")

    invoice_number = f"RD-INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    snapshot = dict(bank)
    snapshot["invoice_number"] = invoice_number
    snapshot["case_ids"] = [str(row.id) for row in selected]
    snapshot["disbursed_total"] = disbursed_total
    snapshot["commission_rate"] = rate
    row = PayoutRequest(
        id=uuid4(),
        user_id=user.id,
        amount=amount,
        status="pending",
        bank_snapshot=snapshot,
        note=f"Invoice {invoice_number}",
    )
    db.add(row)
    write_audit(
        db,
        action="invoice_raised",
        actor_user_id=user.id,
        entity_type="payout_request",
        entity_id=str(row.id),
        detail={"amount": amount, "invoice_number": invoice_number, "cases": len(selected)},
    )
    db.commit()
    db.refresh(row)
    return _to_out(row, user)


@router.get("/admin/requests", response_model=list[RequestOut])
def admin_list(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RequestOut]:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    q = db.query(PayoutRequest)
    if status_filter and status_filter != "all":
        q = q.filter(PayoutRequest.status == status_filter)
    rows = q.order_by(PayoutRequest.created_at.desc()).limit(100).all()
    out = []
    for r in rows:
        u = db.query(User).filter(User.id == r.user_id).first()
        out.append(_to_out(r, u))
    return out


@router.post("/admin/requests/{request_id}", response_model=RequestOut)
def admin_action(
    request_id: UUID,
    body: AdminActionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RequestOut:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")
    row = db.query(PayoutRequest).filter(PayoutRequest.id == request_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    if body.action == "approve":
        if row.status not in {"pending", "query"}:
            raise HTTPException(status_code=400, detail="Only a raised or queried invoice can be approved")
        row.status = "approved"
        row.utr = (body.utr or "").strip() or row.utr
    elif body.action == "processing":
        if row.status != "approved":
            raise HTTPException(status_code=400, detail="Approve the invoice before payment processing")
        row.status = "processing"
    elif body.action == "paid":
        if row.status not in {"pending", "approved", "processing"}:
            raise HTTPException(status_code=400, detail="Invalid status for paid")
        row.status = "paid"
        row.utr = (body.utr or row.utr or "").strip() or None
    elif body.action == "query":
        if row.status not in {"pending", "approved"}:
            raise HTTPException(status_code=400, detail="Query is only for a raised or approved invoice")
        row.status = "query"
        row.rejection_reason = (body.rejection_reason or "").strip() or "Query from admin"
    elif body.action == "reject":
        if row.status not in {"pending", "query"}:
            raise HTTPException(status_code=400, detail="Only a raised or queried invoice can be rejected")
        row.status = "rejected"
        row.rejection_reason = (body.rejection_reason or "").strip() or "Rejected"
    row.reviewed_by = user.id
    row.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    u = db.query(User).filter(User.id == row.user_id).first()
    return _to_out(row, u)
