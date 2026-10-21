"""Case disbursals, case payout ledger, finance summary, and purchase audit reads."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.api.customer_activity import _day, _money, _roi, _tenure, _text
from app.api.customer_workspace import _require_purchase
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    AuditEvent,
    CustomerBankLogin,
    CustomerCasePayout,
    CustomerDisbursal,
    CustomerDocument,
    CustomerFollowup,
    CustomerLenderCase,
    CustomerLosPipeline,
    CustomerProfile,
    LeadPurchase,
    User,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/api", tags=["customer-finance"])

ROW_LIMIT = 40
DISBURSAL_STATUSES = {
    "pending",
    "approved",
    "sanctioned",
    "partially_disbursed",
    "fully_disbursed",
    "cancelled",
    "rejected",
}
PAYOUT_STATUSES = {"expected", "in_process", "received", "hold", "rejected"}
PAYOUT_TYPES = {"commission", "incentive", "trail", "referral", "other"}
IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACCOUNT_RE = re.compile(r"^\d{6,18}$")
SECTIONS = {
    "los_pipeline": "Pipeline",
    "lender_case": "Lender",
    "sanction": "Disbursal",
    "disbursal": "Disbursal",
    "payout": "Payout",
    "document": "Documents",
    "followup": "Follow-up",
}


class DisbursalIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lender_case_id: str | None = None
    disbursal_status: str | None = None
    sanctioned_amount: float | None = None
    disbursed_amount: float | None = None
    roi: float | None = None
    tenure: float | None = None
    emi: float | None = None
    processing_fee: float | None = None
    insurance_amount: float | None = None
    deductions: float | None = None
    payout_expected: float | None = None
    payout_received: float | None = None
    payout_status: str | None = None
    disbursal_date: str | None = None
    utr_number: str | None = None
    credited_bank_name: str | None = None
    credited_account_number: str | None = None
    credited_ifsc: str | None = None
    first_emi_date: str | None = None
    disbursal_notes: str | None = None


class PayoutIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lender_case_id: str | None = None
    payout_amount: float | None = None
    payout_type: str | None = None
    payout_status: str | None = None
    expected_date: str | None = None
    received_date: str | None = None
    payout_reference: str | None = None
    payout_notes: str | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _profile(db: Session, purchase: LeadPurchase) -> CustomerProfile:
    profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Open the customer workspace before saving finance records")
    return profile


def _lender(db: Session, purchase_id: UUID, value: str | None) -> UUID | None:
    if value is None or not str(value).strip():
        return None
    try:
        lender_id = UUID(str(value))
    except ValueError:
        raise HTTPException(status_code=400, detail="Lender case is invalid")
    row = (
        db.query(CustomerLenderCase)
        .filter(CustomerLenderCase.id == lender_id, CustomerLenderCase.lead_purchase_id == purchase_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=400, detail="Lender case is invalid")
    return row.id


def _ifsc(value: str | None) -> str | None:
    text = _text(value, 11)
    if text is None:
        return None
    code = text.upper()
    if not IFSC_RE.match(code):
        raise HTTPException(status_code=400, detail="Enter a valid IFSC")
    return code


def _account(value: str | None) -> str | None:
    text = _text(value, 22)
    if text is None:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if not ACCOUNT_RE.match(digits):
        raise HTTPException(status_code=400, detail="Account number must be 6 to 18 digits")
    return digits


def _choice(value: str | None, allowed: set[str], label: str, default: str | None = None) -> str | None:
    text = _text(value, 40)
    if text is None:
        return default
    if text not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}")
    return text


def _recompute(row: CustomerDisbursal) -> None:
    sanctioned = row.sanctioned_amount or 0
    row.net_disbursal = max(0, sanctioned - (row.processing_fee or 0) - (row.insurance_amount or 0) - (row.deductions or 0))
    row.payout_pending = max(0, (row.payout_expected or 0) - (row.payout_received or 0))
    tenure = row.tenure or 0
    if sanctioned > 0 and tenure > 0:
        rate = (row.roi or 0) / 100 / 12
        if rate == 0:
            row.emi = round(sanctioned / tenure)
        else:
            power = (1 + rate) ** tenure
            row.emi = round((sanctioned * rate * power) / (power - 1))


def _disbursal_out(row: CustomerDisbursal) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "lender_case_id": str(row.lender_case_id) if row.lender_case_id else None,
        "dsa_id": str(row.dsa_id),
        "disbursal_status": row.disbursal_status,
        "sanctioned_amount": row.sanctioned_amount,
        "disbursed_amount": row.disbursed_amount,
        "net_disbursal": row.net_disbursal,
        "roi": row.roi,
        "tenure": row.tenure,
        "emi": row.emi,
        "processing_fee": row.processing_fee,
        "insurance_amount": row.insurance_amount,
        "deductions": row.deductions,
        "payout_expected": row.payout_expected,
        "payout_received": row.payout_received,
        "payout_pending": row.payout_pending,
        "payout_status": row.payout_status,
        "disbursal_date": row.disbursal_date,
        "utr_number": row.utr_number,
        "credited_bank_name": row.credited_bank_name,
        "credited_account_number": row.credited_account_number,
        "credited_ifsc": row.credited_ifsc,
        "first_emi_date": row.first_emi_date,
        "disbursal_notes": row.disbursal_notes,
        "created_by": str(row.created_by) if row.created_by else None,
        "created_at": _iso(row.created_at),
    }


def _payout_out(row: CustomerCasePayout) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "lender_case_id": str(row.lender_case_id) if row.lender_case_id else None,
        "dsa_id": str(row.dsa_id),
        "payout_amount": row.payout_amount,
        "payout_type": row.payout_type,
        "payout_status": row.payout_status,
        "expected_date": row.expected_date,
        "received_date": row.received_date,
        "payout_reference": row.payout_reference,
        "payout_notes": row.payout_notes,
        "created_by": str(row.created_by) if row.created_by else None,
        "created_at": _iso(row.created_at),
    }


def _apply_disbursal(row: CustomerDisbursal, body: DisbursalIn, present: set[str], db: Session) -> None:
    if "lender_case_id" in present:
        row.lender_case_id = _lender(db, row.lead_purchase_id, body.lender_case_id)
    if "disbursal_status" in present:
        row.disbursal_status = _choice(body.disbursal_status, DISBURSAL_STATUSES, "disbursal status", "pending") or "pending"
    for name in ("sanctioned_amount", "disbursed_amount", "processing_fee", "insurance_amount", "deductions", "payout_expected", "payout_received"):
        if name in present:
            setattr(row, name, _money(getattr(body, name)))
    if "roi" in present:
        row.roi = _roi(body.roi)
    if "tenure" in present:
        row.tenure = _tenure(body.tenure)
    if "emi" in present and body.emi is not None:
        row.emi = _money(body.emi)
    if "payout_status" in present:
        row.payout_status = _choice(body.payout_status, PAYOUT_STATUSES, "payout status")
    if "disbursal_date" in present:
        row.disbursal_date = _day(body.disbursal_date)
    if "first_emi_date" in present:
        row.first_emi_date = _day(body.first_emi_date)
    if "utr_number" in present:
        row.utr_number = _text(body.utr_number, 80)
    if "credited_bank_name" in present:
        row.credited_bank_name = _text(body.credited_bank_name, 120)
    if "credited_account_number" in present:
        row.credited_account_number = _account(body.credited_account_number)
    if "credited_ifsc" in present:
        row.credited_ifsc = _ifsc(body.credited_ifsc)
    if "disbursal_notes" in present:
        row.disbursal_notes = _text(body.disbursal_notes, 2000)
    _recompute(row)


def _apply_payout(row: CustomerCasePayout, body: PayoutIn, present: set[str], db: Session) -> None:
    if "lender_case_id" in present:
        row.lender_case_id = _lender(db, row.lead_purchase_id, body.lender_case_id)
    if "payout_amount" in present:
        row.payout_amount = _money(body.payout_amount)
    if "payout_type" in present:
        row.payout_type = _choice(body.payout_type, PAYOUT_TYPES, "payout type", "commission") or "commission"
    if "payout_status" in present:
        row.payout_status = _choice(body.payout_status, PAYOUT_STATUSES, "payout status", "expected") or "expected"
    if "expected_date" in present:
        row.expected_date = _day(body.expected_date)
    if "received_date" in present:
        row.received_date = _day(body.received_date)
    if "payout_reference" in present:
        row.payout_reference = _text(body.payout_reference, 80)
    if "payout_notes" in present:
        row.payout_notes = _text(body.payout_notes, 2000)


@router.get("/my-leads/{purchase_id}/disbursals")
def list_disbursals(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerDisbursal)
        .filter(CustomerDisbursal.lead_purchase_id == purchase.id)
        .order_by(CustomerDisbursal.created_at.desc())
        .all()
    )
    return {"rows": [_disbursal_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/disbursals")
def create_disbursal(
    purchase_id: UUID,
    body: DisbursalIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerDisbursal).filter(CustomerDisbursal.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Disbursal limit reached")
    row = CustomerDisbursal(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        disbursal_status="pending",
        payout_status="expected",
        created_by=user.id,
    )
    _apply_disbursal(row, body, set(body.model_fields_set), db)
    db.add(row)
    write_audit(
        db,
        action="disbursal_saved",
        actor_user_id=user.id,
        entity_type="disbursal",
        entity_id=str(purchase.id),
        detail={"status": row.disbursal_status},
    )
    db.commit()
    db.refresh(row)
    return _disbursal_out(row)


def _owned_disbursal(db: Session, user: User, row_id: UUID) -> CustomerDisbursal:
    row = db.query(CustomerDisbursal).filter(CustomerDisbursal.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Disbursal not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


@router.patch("/customer-disbursals/{disbursal_id}")
def update_disbursal(
    disbursal_id: UUID,
    body: DisbursalIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_disbursal(db, user, disbursal_id)
    previous = row.disbursal_status
    _apply_disbursal(row, body, set(body.model_fields_set), db)
    if row.disbursal_status != previous:
        write_audit(
            db,
            action="disbursal_status",
            actor_user_id=user.id,
            entity_type="disbursal",
            entity_id=str(row.lead_purchase_id),
            detail={"from": previous, "to": row.disbursal_status},
        )
    db.commit()
    db.refresh(row)
    return _disbursal_out(row)


@router.delete("/customer-disbursals/{disbursal_id}")
def delete_disbursal(disbursal_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_disbursal(db, user, disbursal_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/my-leads/{purchase_id}/case-payouts")
def list_payouts(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerCasePayout)
        .filter(CustomerCasePayout.lead_purchase_id == purchase.id)
        .order_by(CustomerCasePayout.created_at.desc())
        .all()
    )
    return {"rows": [_payout_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/case-payouts")
def create_payout(
    purchase_id: UUID,
    body: PayoutIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerCasePayout).filter(CustomerCasePayout.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Payout limit reached")
    row = CustomerCasePayout(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        payout_type="commission",
        payout_status="expected",
        created_by=user.id,
    )
    _apply_payout(row, body, set(body.model_fields_set), db)
    db.add(row)
    write_audit(
        db,
        action="payout_saved",
        actor_user_id=user.id,
        entity_type="payout",
        entity_id=str(purchase.id),
        detail={"status": row.payout_status, "type": row.payout_type},
    )
    db.commit()
    db.refresh(row)
    return _payout_out(row)


def _owned_payout(db: Session, user: User, row_id: UUID) -> CustomerCasePayout:
    row = db.query(CustomerCasePayout).filter(CustomerCasePayout.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Payout not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


@router.patch("/customer-case-payouts/{payout_id}")
def update_payout(
    payout_id: UUID,
    body: PayoutIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_payout(db, user, payout_id)
    previous = row.payout_status
    _apply_payout(row, body, set(body.model_fields_set), db)
    if row.payout_status != previous:
        write_audit(
            db,
            action="payout_status",
            actor_user_id=user.id,
            entity_type="payout",
            entity_id=str(row.lead_purchase_id),
            detail={"from": previous, "to": row.payout_status},
        )
    db.commit()
    db.refresh(row)
    return _payout_out(row)


@router.delete("/customer-case-payouts/{payout_id}")
def delete_payout(payout_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_payout(db, user, payout_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/my-leads/{purchase_id}/audit")
def list_audit(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(AuditEvent)
        .filter(AuditEvent.entity_id == str(purchase.id))
        .order_by(AuditEvent.created_at.desc())
        .limit(200)
        .all()
    )
    out = []
    for row in rows:
        detail = row.detail if isinstance(row.detail, dict) else {}
        safe = {key: detail.get(key) for key in ("from", "to", "status", "type", "created") if key in detail}
        out.append(
            {
                "id": str(row.id),
                "action_type": row.action,
                "section_name": SECTIONS.get(row.entity_type or "", row.entity_type),
                "field_name": "status" if "from" in safe or "to" in safe or "status" in safe else None,
                "old_value": None if safe.get("from") is None else str(safe.get("from")),
                "new_value": None if safe.get("to", safe.get("status")) is None else str(safe.get("to", safe.get("status"))),
                "action_by": str(row.actor_user_id) if row.actor_user_id else None,
                "created_at": _iso(row.created_at),
            }
        )
    return {"rows": out}


@router.get("/los/finance-report")
def finance_report(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase_ids = [row.id for row in db.query(LeadPurchase.id).filter(LeadPurchase.buyer_user_id == user.id).all()]
    today = datetime.now(timezone.utc).date().isoformat()
    if not purchase_ids:
        return _empty_report()
    lenders = db.query(CustomerLenderCase).filter(CustomerLenderCase.lead_purchase_id.in_(purchase_ids)).all()
    banks = db.query(CustomerBankLogin).filter(CustomerBankLogin.lead_purchase_id.in_(purchase_ids)).all()
    disbursals = db.query(CustomerDisbursal).filter(CustomerDisbursal.lead_purchase_id.in_(purchase_ids)).all()
    payouts = db.query(CustomerCasePayout).filter(CustomerCasePayout.lead_purchase_id.in_(purchase_ids)).all()
    pipelines = db.query(CustomerLosPipeline).filter(CustomerLosPipeline.lead_purchase_id.in_(purchase_ids)).all()
    names = {row.id: (row.lender_name or "Lender") for row in lenders}
    by_lender: dict[str, dict[str, float]] = defaultdict(lambda: {"sanction": 0, "disbursed": 0})
    for row in lenders:
        by_lender[row.lender_name or "Unknown"]["sanction"] += row.sanctioned_amount or 0
    for row in disbursals:
        name = names.get(row.lender_case_id) if row.lender_case_id else "Case"
        by_lender[name or "Case"]["disbursed"] += row.disbursed_amount or 0
    months: dict[str, float] = defaultdict(float)
    for row in disbursals:
        if row.disbursal_date:
            months[row.disbursal_date[:7]] += row.disbursed_amount or 0
    stages: dict[str, int] = defaultdict(int)
    for row in pipelines:
        stages[row.current_stage] += 1
    logins = len(lenders)
    rois = [row.roi for row in disbursals if row.roi and row.roi > 0]
    return {
        "totalLoginAmount": sum(row.login_amount or 0 for row in banks),
        "totalSanction": sum(row.sanctioned_amount or 0 for row in disbursals),
        "totalDisbursal": sum(row.disbursed_amount or 0 for row in disbursals),
        "totalPayoutReceived": sum(row.payout_amount or 0 for row in payouts if row.payout_status == "received"),
        "conversionRatio": round((sum(1 for row in lenders if (row.sanctioned_amount or 0) > 0) / logins) * 100) if logins else 0,
        "averageRoi": (sum(rois) / len(rois)) if rois else 0,
        "rejectionRatio": round((sum(1 for row in lenders if row.login_status == "rejected") / logins) * 100) if logins else 0,
        "pendingDocs": db.query(CustomerDocument)
        .filter(CustomerDocument.lead_purchase_id.in_(purchase_ids), CustomerDocument.status.in_(["pending", "requested"]))
        .count(),
        "followupsDue": db.query(CustomerFollowup)
        .filter(
            CustomerFollowup.lead_purchase_id.in_(purchase_ids),
            CustomerFollowup.completed.is_(False),
            CustomerFollowup.followup_date.isnot(None),
            CustomerFollowup.followup_date <= today,
        )
        .count(),
        "activePipelines": sum(1 for row in pipelines if row.current_stage not in {"closed", "rejected", "disbursed"}),
        "byLender": [{"name": name, **values} for name, values in by_lender.items()],
        "monthlyDisbursal": [{"month": month, "amount": amount} for month, amount in sorted(months.items())],
        "stageFunnel": [{"stage": stage, "count": count} for stage, count in stages.items()],
    }


def _empty_report() -> dict:
    return {
        "totalLoginAmount": 0,
        "totalSanction": 0,
        "totalDisbursal": 0,
        "totalPayoutReceived": 0,
        "conversionRatio": 0,
        "averageRoi": 0,
        "rejectionRatio": 0,
        "pendingDocs": 0,
        "followupsDue": 0,
        "activePipelines": 0,
        "byLender": [],
        "monthlyDisbursal": [],
        "stageFunnel": [],
    }
