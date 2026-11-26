"""Closure-file math.

Receivable is what the lender pays RupeeDial.
Payable is the connector's share of that receivable, not of the loan.
Net is what remains after the connector share and any customer credit.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, object_session

from app.models import Lead, LeadPurchase, LoanCase, PayoutRequest, User
from app.services.audit import write_audit
from app.services.invoice_flow import STAGE_LABELS

STAGES = (
    "draft",
    "submitted",
    "logged_in",
    "sanctioned",
    "disbursed",
    "disbursed_confirmed",
    "collected",
)
FLAGS = ("", "hold", "banker_pending", "movement", "cancelled")
PAYOUTS = ("none", "initiated", "paid", "rejected", "setoff")
STAGE_LABEL = {
    "draft": "Draft",
    "submitted": "Submitted",
    "logged_in": "Logged In",
    "sanctioned": "Sanctioned",
    "disbursed": "Disbursed",
    "disbursed_confirmed": "Disbursed Confirmed",
    "collected": "Collected",
}


def disbursed_base(row: LoanCase) -> float:
    """Released amount. Disbursement lines win. Otherwise sanctioned, then the logged loan."""
    total = _round(sum(float(line.get("amount") or 0) for line in _clean_disbursements(getattr(row, "disbursements", None))))
    if total > 0:
        return total
    return float(row.sanctioned_amount or 0) or float(row.loan_amount or 0)


def _clean_disbursements(value) -> list[dict]:
    rows = value if isinstance(value, list) else []
    clean = []
    for item in rows[:12]:
        if not isinstance(item, dict):
            continue
        amount = float(item.get("amount") or 0)
        if amount < 0:
            amount = 0
        date = str(item.get("date") or "")[:20]
        reference = str(item.get("reference") or "")[:80]
        if amount <= 0 and not date and not reference:
            continue
        clean.append({"date": date, "amount": _round(amount), "reference": reference})
    return clean


def _round(value: float) -> float:
    return round(float(value or 0), 2)


def figures(row: LoanCase) -> dict:
    """Lender pays receivable. Connector gets payable % of that.

    What is left after the partner agreement is company revenue.
    A ₹1,00,00,000 LAP at 1.5% is ₹1,50,000. An 85% agreement pays ₹1,27,500.
    The ₹22,500 stays with the company, under the employee mapped to that partner.
    """
    base = disbursed_base(row)
    receivable = _round(base * float(row.receivable_percent or 0) / 100)
    payable = _round(receivable * float(row.payable_percent or 0) / 100)
    loyalty = _round(row.loyalty_amount or 0)
    bonus = _round(getattr(row, "bonus_amount", 0) or 0)
    bonus_partner = _round(bonus * float(getattr(row, "bonus_partner_percent", 0) or 0) / 100)
    margin = _round(receivable - payable - loyalty)
    share_pct = sum(float(item.get("share_percent") or 0) for item in _clean_stakeholders(getattr(row, "stakeholders", None)))
    share_pct = min(share_pct, 100)
    agent = _round(margin * share_pct / 100) if margin > 0 else 0.0
    net = _round(margin - agent + bonus - bonus_partner)
    invoice = _round(row.invoice_amount or 0)
    collected = _round(row.collected_amount or 0)
    invoice_pct = _round(invoice / receivable * 100) if receivable else 0
    collection_pct = _round(collected / invoice * 100) if invoice else 0
    return {
        "base_amount": base,
        "receivable_amount": receivable,
        "payable_amount": payable,
        "loyalty_amount": loyalty,
        "bonus_amount": bonus,
        "bonus_partner_amount": bonus_partner,
        "agent_amount": agent,
        "net_revenue": net,
        "invoice_percent": invoice_pct,
        "collection_percent": collection_pct,
    }


def status_label(row: LoanCase) -> str:
    if row.flag == "cancelled":
        return "Cancelled"
    if row.flag == "movement":
        return "Movement"
    if row.flag == "banker_pending":
        return "Banker Pending"
    if row.stage == "disbursed" and row.flag == "hold":
        return "Disbursed Hold"
    money = figures(row)
    if row.stage in ("disbursed_confirmed", "collected") and money["invoice_percent"] >= 100 and 0 < money["collection_percent"] < 100:
        return "Partially Collected"
    if row.counted and row.pod_pending:
        return "Counted POD Pending"
    if row.stage in ("disbursed", "disbursed_confirmed", "collected") and not row.counted:
        return "Not Counted"
    return STAGE_LABEL.get(row.stage, row.stage)


def matches_filter(row: LoanCase, chip: str) -> bool:
    if not chip or chip == "all":
        return True
    label = status_label(row)
    wanted = {
        "draft": "Draft",
        "logged_in": "Logged In",
        "sanctioned": "Sanctioned",
        "disbursed": "Disbursed",
        "disbursed_hold": "Disbursed Hold",
        "disbursed_confirmed": "Disbursed Confirmed",
        "partially_collected": "Partially Collected",
        "banker_pending": "Banker Pending",
        "not_counted": "Not Counted",
        "counted": "Counted",
        "counted_pod_pending": "Counted POD Pending",
        "movement": "Movement",
        "cancelled": "Cancelled",
        "collected": "Collected",
        "submitted": "Submitted",
    }.get(chip, chip)
    if chip == "disbursed":
        return row.stage == "disbursed" and row.flag not in ("cancelled", "hold")
    if chip == "disbursed_confirmed":
        return row.stage == "disbursed_confirmed" and row.flag != "cancelled"
    if chip == "collected":
        return row.stage == "collected" and row.flag != "cancelled"
    if chip == "counted":
        return bool(row.counted) and not row.pod_pending and row.flag != "cancelled"
    if chip == "not_counted":
        return row.stage in ("disbursed", "disbursed_confirmed", "collected") and not row.counted and row.flag != "cancelled"
    if chip == "counted_pod_pending":
        return bool(row.counted) and bool(row.pod_pending) and row.flag != "cancelled"
    return label == wanted


CHIP_IDS = (
    "draft",
    "submitted",
    "logged_in",
    "sanctioned",
    "disbursed",
    "disbursed_hold",
    "disbursed_confirmed",
    "partially_collected",
    "banker_pending",
    "not_counted",
    "counted",
    "counted_pod_pending",
    "movement",
    "cancelled",
    "collected",
)


FIRST_CASE_NO = 1001
SAMPLE_DEAL = "RD-MCF-SAMPLE-0844"


def _next_case_no(db: Session) -> int:
    current = db.query(func.max(LoanCase.case_no)).scalar()
    return max(int(current or 0) + 1, FIRST_CASE_NO)


def _deal_no(case_no: int) -> str:
    """RD-MCF-<IST date of opening>-<running case number>, e.g. RD-MCF-20261022-1001."""
    return f"RD-MCF-{datetime.now(IST).strftime('%Y%m%d')}-{case_no}"


def _insert_numbered(db: Session, row: LoanCase) -> LoanCase | None:
    """Give a new file the next case number. Two files opened at once race on the unique number, so retry."""
    for _ in range(5):
        number = _next_case_no(db)
        row.case_no = number
        if row.deal_no != SAMPLE_DEAL:
            row.deal_no = _deal_no(number)
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if row.lead_purchase_id and db.query(LoanCase.id).filter(LoanCase.lead_purchase_id == row.lead_purchase_id).first():
                return None
            continue
        db.refresh(row)
        return row
    return None


def _invoice_index(db: Session) -> dict[str, dict]:
    found: dict[str, dict] = {}
    rows = db.query(PayoutRequest).order_by(PayoutRequest.created_at.desc()).all()
    for req in rows:
        snap = req.bank_snapshot or {}
        number = str(snap.get("invoice_number") or req.note or "")
        stage = req.stage or req.status or ""
        lines = {
            str(item.get("purchase_id")): item
            for item in (snap.get("lines") or [])
            if isinstance(item, dict)
        }
        for purchase_id in snap.get("case_ids") or []:
            pid = str(purchase_id)
            if pid in found:
                continue
            line = lines.get(pid) or {}
            found[pid] = {
                "number": number,
                "status": stage,
                "status_label": STAGE_LABELS.get(stage, stage or "Invoice"),
                "share": line.get("share"),
                "net_payable": req.net_payable,
                "utr": req.utr or "",
            }
    return found


def serialize(row: LoanCase, invoices: dict[str, dict] | None = None) -> dict:
    money = figures(row)
    paid = row.payout_status == "paid"
    complete = money["invoice_percent"] >= 100 and money["collection_percent"] >= 100 and paid
    note = ""
    if complete and row.partner_name:
        note = f"{row.partner_name} ({row.partner_code}) payout completed against {row.deal_no}"
    elif row.payout_status == "rejected":
        note = row.payout_note or "Connector invoice rejected"
    return {
        "id": str(row.id),
        "deal_no": row.deal_no,
        "case_no": row.case_no,
        "stage": row.stage,
        "stage_label": STAGE_LABEL.get(row.stage, row.stage),
        "status_label": status_label(row),
        "flag": row.flag or "",
        "loan_type": row.loan_type,
        "lead_source": row.lead_source,
        "partner_code": row.partner_code,
        "partner_name": row.partner_name,
        "client_name": row.client_name,
        "client_phone": row.client_phone,
        "project_name": row.project_name,
        "expected_sanction_on": row.expected_sanction_on,
        "client_access": row.client_access,
        "loan_amount": _round(row.loan_amount),
        "sanctioned_amount": _round(row.sanctioned_amount),
        "receivable_percent": float(row.receivable_percent or 0),
        "payable_percent": float(row.payable_percent or 0),
        "loyalty_name": row.loyalty_name,
        "bank_name": row.bank_name,
        "lender_id": str(row.lender_id) if row.lender_id else "",
        "product_id": str(row.product_id) if row.product_id else "",
        "branch_id": str(row.branch_id) if row.branch_id else "",
        "contact_id": str(row.contact_id) if row.contact_id else "",
        "scheme_id": str(row.scheme_id) if getattr(row, "scheme_id", None) else "",
        "application_no": row.application_no or "",
        "lender_status": row.lender_status or "",
        "missing_papers": [
            name for name, present, needed in (
                ("Sanction letter", bool(row.sanction_letter_name), row.stage in {"sanctioned", "disbursed", "disbursed_confirmed", "collected"}),
                ("Bank confirmation", bool(row.bank_confirmation_name), row.stage in {"disbursed", "disbursed_confirmed", "collected"}),
            ) if needed and not present
        ],
        "lan": row.lan or "",
        "roi": float(row.roi or 0),
        "tenure_months": int(row.tenure_months or 0),
        "disbursements": _clean_disbursements(row.disbursements),
        "bonus_name": row.bonus_name or "",
        "bonus_amount": _round(row.bonus_amount),
        "bonus_partner_percent": float(row.bonus_partner_percent or 0),
        "bank_rm": row.bank_rm,
        "bank_rm_phone": row.bank_rm_phone,
        "bankers": _bankers(row),
        "customer": _customer(row),
        "stakeholders": _stakeholders(row),
        "submitted_by": row.submitted_by,
        "pod_pending": bool(row.pod_pending),
        "pod_remarks": row.pod_remarks,
        "counted": bool(row.counted),
        "invoice_amount": _round(row.invoice_amount),
        "collected_amount": _round(row.collected_amount),
        "payout_status": row.payout_status,
        "payout_note": note,
        "sanction_letter_name": row.sanction_letter_name or "",
        "bank_confirmation_name": row.bank_confirmation_name or "",
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "submitted_on": _on_day(row),
        "partner_invoice": (invoices or {}).get(str(row.lead_purchase_id or "")) if row.lead_purchase_id else None,
        **money,
        **(_snapshot_status(object_session(row), row) if object_session(row) is not None else {
            "snapshot_status": "open", "snapshot_version": 0, "snapshot_at": "",
            "snapshot_base": 0, "snapshot_receivable": 0, "snapshot_payable": 0,
        }),
    }


def _visible(db: Session, user: User):
    query = db.query(LoanCase)
    if user.role in {"admin", "ceo", "super_admin"}:
        return query.order_by(LoanCase.created_at.desc())
    if user.role == "coordinator" and user.department == "OPS" and not user.finance_level:
        return query.order_by(LoanCase.created_at.desc())
    if user.role == "coordinator" and user.finance_level in {"manager", "business_head", "accounts"}:
        return query.order_by(LoanCase.created_at.desc())
    if user.role == "coordinator" and user.finance_level == "rm":
        partner_ids = db.query(User.id).filter(
            User.role.in_(("dsa", "affiliate")),
            (User.rm1_user_id == user.id) | (User.rm2_user_id == user.id),
        )
        return query.filter(LoanCase.partner_user_id.in_(partner_ids)).order_by(LoanCase.created_at.desc())
    if user.role in {"dsa", "affiliate"}:
        return query.filter(LoanCase.partner_user_id == user.id).order_by(LoanCase.created_at.desc())
    return query.filter(LoanCase.id.is_(None))


def _on_day(row: LoanCase) -> str:
    """Submitted date. The list date range uses this, not the sanction date."""
    created = row.created_at
    if not created:
        return ""
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created.astimezone(IST).date().isoformat()


def list_cases(db: Session, user: User, chip: str = "all", date_from: str = "", date_to: str = "") -> dict:
    import_disbursed(db, None)
    pool = list(_visible(db, user).all())
    if date_from:
        pool = [row for row in pool if _on_day(row) >= date_from]
    if date_to:
        pool = [row for row in pool if _on_day(row) <= date_to]
    confirmed = [
        row
        for row in pool
        if row.stage in ("disbursed_confirmed", "collected") and row.flag != "cancelled" and row.counted
    ]
    rows = [row for row in pool if matches_filter(row, chip)]
    revenue = _round(sum(figures(row)["net_revenue"] for row in confirmed))
    counts = {key: sum(1 for row in pool if matches_filter(row, key)) for key in CHIP_IDS}
    counts["all"] = len(pool)
    return {
        "revenue": revenue,
        "disbursed_revenue": revenue,
        "confirmed_count": len(confirmed),
        "counts": counts,
        "items": [serialize(row, _invoice_index(db)) for row in rows],
    }


def create_case(db: Session, user: User, payload: dict) -> dict:
    row = LoanCase(
        id=uuid4(),
        deal_no="",
        stage="draft",
        submitted_by=user.full_name or user.email,
        owner_user_id=user.id,
        loan_type=(payload.get("loan_type") or "LAP").strip() or "LAP",
        client_name=(payload.get("client_name") or "").strip(),
        loan_amount=float(payload.get("loan_amount") or 0),
        receivable_percent=float(payload.get("receivable_percent") or 1.4),
        payable_percent=float(payload.get("payable_percent") or 90),
        partner_name=(payload.get("partner_name") or "").strip(),
        partner_code=(payload.get("partner_code") or "").strip(),
        lead_source="Connector",
    )
    saved = _insert_numbered(db, row)
    if saved is None:
        raise RuntimeError("Could not assign a case number, try again")
    return serialize(saved)


CUSTOMER_KEYS = (
    "email", "company_name", "country", "state", "city", "address",
    "corr_country", "corr_state", "corr_city", "corr_address",
    "pan", "dob", "alternate_email", "alternate_mobile",
)


def _customer(row: LoanCase) -> dict:
    raw = row.customer if isinstance(row.customer, dict) else {}
    return {key: str(raw.get(key) or "")[:200] for key in CUSTOMER_KEYS}


def _clean_customer(value) -> dict:
    raw = value if isinstance(value, dict) else {}
    return {key: str(raw.get(key) or "").strip()[:200] for key in CUSTOMER_KEYS}


def _stake_for_save(value) -> list[dict]:
    """Reject a bad share list. Reading an old file still uses the softer cleaner."""
    if not isinstance(value, list):
        raise ValueError("Shares must be a list")
    if len(value) > 8:
        raise ValueError("A file can list at most 8 people")
    clean = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each share must be a person and a percent")
        name = str(item.get("name") or "").strip()[:120]
        try:
            share = round(float(item.get("share_percent") or 0), 2)
        except (TypeError, ValueError):
            raise ValueError("Share percent must be a number")
        if share < 0:
            raise ValueError("Share percent cannot be negative")
        if share > 100:
            raise ValueError("One person cannot take more than 100%")
        if not name and share == 0:
            continue
        if not name:
            raise ValueError("Each share needs a name")
        key = name.lower()
        if key in seen:
            raise ValueError("The same person is listed twice")
        seen.add(key)
        clean.append({"name": name, "share_percent": share})
    if round(sum(item["share_percent"] for item in clean), 2) > 100:
        raise ValueError("Employee shares cannot total more than 100% of the company margin")
    return clean


def _stakeholders(row: LoanCase) -> list[dict]:
    return _clean_stakeholders(row.stakeholders) or [{"name": "", "share_percent": 0}]


def _clean_stakeholders(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    clean = []
    for item in value[:8]:
        if not isinstance(item, dict):
            continue
        try:
            share = float(item.get("share_percent") or 0)
        except (TypeError, ValueError):
            share = 0
        share = min(max(share, 0), 100)
        name = str(item.get("name") or "").strip()[:120]
        if name or share:
            clean.append({"name": name, "share_percent": share})
    return clean


def _clean_bankers(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    clean = []
    for item in value[:8]:
        if not isinstance(item, dict):
            continue
        row = {
            "name": str(item.get("name") or "").strip()[:120],
            "email": str(item.get("email") or "").strip()[:255],
            "designation": str(item.get("designation") or "").strip()[:80],
            "phone": str(item.get("phone") or "").strip()[:30],
        }
        if any(row.values()):
            clean.append(row)
    return clean


def _bankers(row: LoanCase) -> list[dict]:
    stored = _clean_bankers(row.bankers)
    if stored:
        return stored
    if row.bank_rm or row.bank_rm_phone:
        return [{"name": row.bank_rm or "", "email": "", "designation": "Bank RM", "phone": row.bank_rm_phone or ""}]
    return [{"name": "", "email": "", "designation": "", "phone": ""}]


def _apply(row: LoanCase, payload: dict) -> None:
    text_fields = (
        "loan_type",
        "lead_source",
        "partner_code",
        "partner_name",
        "client_name",
        "client_phone",
        "project_name",
        "expected_sanction_on",
        "client_access",
        "loyalty_name",
        "bonus_name",
        "bank_name",
        "application_no",
        "lan",
        "lender_status",
        "bank_rm",
        "bank_rm_phone",
        "pod_remarks",
        "payout_note",
    )
    for key in text_fields:
        if key in payload and payload[key] is not None:
            setattr(row, key, str(payload[key]).strip())
    if "bankers" in payload and payload["bankers"] is not None:
        clean = _clean_bankers(payload["bankers"])
        row.bankers = clean
        first = clean[0] if clean else {}
        row.bank_rm = str(first.get("name") or "")
        row.bank_rm_phone = str(first.get("phone") or "")
    if "customer" in payload and payload["customer"] is not None:
        row.customer = _clean_customer(payload["customer"])
    if "stakeholders" in payload and payload["stakeholders"] is not None:
        row.stakeholders = _stake_for_save(payload["stakeholders"])
    if "disbursements" in payload and payload["disbursements"] is not None:
        row.disbursements = _clean_disbursements(payload["disbursements"])
    if "roi" in payload and payload["roi"] is not None:
        row.roi = float(payload["roi"])
    if "tenure_months" in payload and payload["tenure_months"] is not None:
        row.tenure_months = max(0, int(float(payload["tenure_months"])))
    for key in ("loan_amount", "sanctioned_amount", "receivable_percent", "payable_percent", "loyalty_amount", "invoice_amount", "collected_amount", "bonus_amount", "bonus_partner_percent"):
        if key in payload and payload[key] is not None:
            value = float(payload[key])
            if value < 0:
                raise ValueError(f"{key} cannot be negative")
            if key.endswith("percent") and value > 100:
                raise ValueError(f"{key} must be between 0 and 100")
            setattr(row, key, value)
    if "stage" in payload and payload["stage"]:
        stage = str(payload["stage"])
        if stage not in STAGES:
            raise ValueError("Unknown stage")
        row.stage = stage
        if stage in ("disbursed_confirmed", "collected"):
            row.counted = True
    if "flag" in payload and payload["flag"] is not None:
        flag = str(payload["flag"])
        if flag not in FLAGS:
            raise ValueError("Unknown flag")
        row.flag = flag
    if "pod_pending" in payload and payload["pod_pending"] is not None:
        row.pod_pending = bool(payload["pod_pending"])
    if "counted" in payload and payload["counted"] is not None:
        row.counted = bool(payload["counted"])
    if "payout_status" in payload and payload["payout_status"]:
        status = str(payload["payout_status"])
        if status not in PAYOUTS:
            raise ValueError("Unknown payout status")
        if status == "paid":
            money = figures(row)
            if money["invoice_percent"] < 99.5 or money["collection_percent"] < 99.5:
                raise ValueError("Invoice and collection must both be 100% before the connector is paid")
        row.payout_status = status


def _freeze_commission(db: Session, user: User, row: LoanCase) -> None:
    """Write version 1 once. A later save does not replace it and does not recalculate the case."""
    from app.models import CommissionSnapshot
    existing = db.query(CommissionSnapshot).filter(CommissionSnapshot.loan_case_id == row.id).first()
    if existing is not None:
        return
    money = figures(row)
    db.add(CommissionSnapshot(
        id=uuid4(),
        loan_case_id=row.id,
        version=1,
        lender_id=row.lender_id,
        product_id=row.product_id,
        method="percent_of_disbursed_base",
        base_amount=money["base_amount"],
        receivable_percent=float(row.receivable_percent or 0),
        payable_percent=float(row.payable_percent or 0),
        receivable_amount=money["receivable_amount"],
        payable_amount=money["payable_amount"],
        bonus_name=row.bonus_name or "",
        bonus_amount=money["bonus_amount"],
        bonus_partner_percent=float(row.bonus_partner_percent or 0),
        loyalty_amount=money["loyalty_amount"],
        inputs={
            "disbursements": _clean_disbursements(row.disbursements),
            "stakeholders": _clean_stakeholders(row.stakeholders),
            "loan_amount": _round(row.loan_amount),
            "sanctioned_amount": _round(row.sanctioned_amount),
            "formula": "base x receivable percent; partner payable is that amount x payable percent",
        },
        created_by=user.id,
    ))
    write_audit(
        db,
        action="commission_snapshot",
        actor_user_id=user.id,
        entity_type="loan_case",
        entity_id=str(row.id),
        detail={"deal_no": row.deal_no, "version": 1, "receivable_amount": money["receivable_amount"]},
    )


def _snapshot_status(db: Session, row: LoanCase) -> dict:
    from app.models import CommissionSnapshot
    snap = (
        db.query(CommissionSnapshot)
        .filter(CommissionSnapshot.loan_case_id == row.id)
        .order_by(CommissionSnapshot.version.desc())
        .first()
    )
    if snap is not None:
        return {
            "snapshot_status": "frozen",
            "snapshot_version": snap.version,
            "snapshot_at": snap.created_at.isoformat() if snap.created_at else "",
            "snapshot_base": float(snap.base_amount or 0),
            "snapshot_receivable": float(snap.receivable_amount or 0),
            "snapshot_payable": float(snap.payable_amount or 0),
        }
    if row.counted:
        return {"snapshot_status": "legacy", "snapshot_version": 0, "snapshot_at": "", "snapshot_base": 0, "snapshot_receivable": 0, "snapshot_payable": 0}
    return {"snapshot_status": "open", "snapshot_version": 0, "snapshot_at": "", "snapshot_base": 0, "snapshot_receivable": 0, "snapshot_payable": 0}


def _as_uuid(value) -> UUID | None:
    if not value:
        return None
    return value if isinstance(value, UUID) else UUID(str(value))


def _link_case_master(db: Session, row: LoanCase, payload: dict) -> None:
    keys = {"lender_id", "product_id", "branch_id", "contact_id", "scheme_id"}
    if not keys.intersection(payload):
        return
    if set(payload).issubset({"scheme_id"}):
        from app.models import LenderScheme
        scheme_id = _as_uuid(payload.get("scheme_id"))
        scheme = db.query(LenderScheme).filter(LenderScheme.id == scheme_id).first() if scheme_id else None
        if scheme_id and scheme is None:
            raise ValueError("Scheme not found")
        if scheme and scheme.lender_id and row.lender_id and scheme.lender_id != row.lender_id:
            raise ValueError("That scheme is for a different lender")
        row.scheme_id = scheme_id
        return
    from app.models import Lender, LenderBranch, LenderContact, LenderProduct
    lender_id = _as_uuid(payload["lender_id"]) if "lender_id" in payload else row.lender_id
    product_id = _as_uuid(payload["product_id"]) if "product_id" in payload else row.product_id
    branch_id = _as_uuid(payload["branch_id"]) if "branch_id" in payload else row.branch_id
    contact_id = _as_uuid(payload["contact_id"]) if "contact_id" in payload else row.contact_id
    if "lender_id" in payload and lender_id != row.lender_id:
        if "product_id" not in payload:
            product_id = None
        if "branch_id" not in payload:
            branch_id = None
        if "contact_id" not in payload:
            contact_id = None
    lender = db.query(Lender).filter(Lender.id == lender_id).first() if lender_id else None
    if lender_id and (lender is None or not lender.active):
        raise ValueError("Choose an active lender")
    product = db.query(LenderProduct).filter(LenderProduct.id == product_id).first() if product_id else None
    if product_id and (product is None or product.lender_id != lender_id or not product.active):
        raise ValueError("That product is not on the selected lender")
    branch = db.query(LenderBranch).filter(LenderBranch.id == branch_id).first() if branch_id else None
    if branch_id and (branch is None or branch.lender_id != lender_id or not branch.active):
        raise ValueError("That branch is not on the selected lender")
    contact = db.query(LenderContact).filter(LenderContact.id == contact_id).first() if contact_id else None
    if contact_id and (contact is None or contact.lender_id != lender_id or not contact.active):
        raise ValueError("That banker is not on the selected lender")
    if contact and contact.branch_id and branch_id and contact.branch_id != branch_id:
        raise ValueError("That banker is on a different branch")
    row.lender_id = lender_id
    row.product_id = product_id
    row.branch_id = branch_id
    row.contact_id = contact_id
    if lender and not (row.bank_name or "").strip():
        row.bank_name = lender.name


def update_case(db: Session, user: User, case_id: UUID, payload: dict) -> dict:
    row = _visible(db, user).filter(LoanCase.id == case_id).first()
    if not row:
        raise LookupError("Case not found")
    if user.role not in {"admin", "ceo", "super_admin"}:
        if user.role not in {"dsa", "affiliate"}:
            raise PermissionError("Only admin can edit a case file")
        kept = (
            "bankers", "customer",
            "loan_type", "lead_source", "project_name", "expected_sanction_on",
            "client_name", "client_phone", "bank_name", "application_no", "lan",
        )
        payload = {key: payload.get(key) for key in kept if key in payload}
        if not payload:
            raise PermissionError("Only admin can edit a case file")
    _link_case_master(db, row, payload)
    locked = {
        "loan_amount", "sanctioned_amount", "receivable_percent", "payable_percent",
        "disbursements", "bonus_amount", "bonus_partner_percent", "bonus_name",
        "loyalty_amount", "invoice_amount", "collected_amount", "counted",
        "stakeholders", "payout_status",
    }
    if row.counted and any(key in payload for key in locked):
        raise ValueError("A counted case keeps its commission, disbursement, and share figures")
    watched = (
        "loan_amount", "sanctioned_amount", "receivable_percent", "payable_percent", "bonus_amount", "bonus_partner_percent",
        "loyalty_amount", "invoice_amount", "collected_amount", "counted", "stage", "flag", "payout_status",
    )
    before_shares = _clean_stakeholders(row.stakeholders)
    before = {key: getattr(row, key) for key in watched}
    _apply(row, payload)
    changes = {}
    for key in watched:
        old = before[key]
        new = getattr(row, key)
        if old != new:
            changes[key] = {"old": old, "new": new}
    if changes:
        write_audit(
            db,
            action="case_money_update",
            actor_user_id=user.id,
            entity_type="loan_case",
            entity_id=str(row.id),
            detail={"deal_no": row.deal_no, "changes": changes},
        )
    after_shares = _clean_stakeholders(row.stakeholders)
    if after_shares != before_shares:
        write_audit(
            db,
            action="case_share_update",
            actor_user_id=user.id,
            entity_type="loan_case",
            entity_id=str(row.id),
            detail={"deal_no": row.deal_no, "old": before_shares, "new": after_shares},
        )
    if not before["counted"] and row.counted:
        _freeze_commission(db, user, row)
    db.commit()
    db.refresh(row)
    return serialize(row, _invoice_index(db))


def case_for_purchase(db: Session, purchase_id: UUID) -> LoanCase | None:
    return db.query(LoanCase).filter(LoanCase.lead_purchase_id == purchase_id).first()


def _loan_type(lead: Lead | None) -> str:
    raw = (lead.product_subtype or lead.loan_type or "") if lead else ""
    raw = raw.strip().lower()
    if raw.startswith("loan_"):
        raw = raw[5:]
    return (raw.replace("_", " ").upper() or "LOAN")[:40]


def is_disbursed(purchase: LeadPurchase) -> bool:
    """Invoice-centre rule, except a rejected lead is never treated as disbursed."""
    if purchase.pipeline_stage == "rejected":
        return False
    return bool(purchase.converted) or purchase.pipeline_stage == "disbursed"


def lender_from_notes(purchase: LeadPurchase) -> str:
    """Lender Submissions saves the chosen lender as an 'Assigned to <lender>' note."""
    for note in reversed(list(purchase.notes or [])):
        text = str((note or {}).get("text") or "") if isinstance(note, dict) else ""
        if text.startswith("Assigned to "):
            return text[len("Assigned to "):].strip()[:200]
    return ""


def _case_from_purchase(db: Session, purchase: LeadPurchase, actor: User | None) -> LoanCase:
    lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
    partner = db.query(User).filter(User.id == purchase.buyer_user_id).first()
    lead_amount = float(lead.loan_amount or 0) if lead else 0.0
    disbursed = float(purchase.deal_value or 0) or lead_amount
    return LoanCase(
        id=uuid4(),
        deal_no="",
        lead_purchase_id=purchase.id,
        stage="disbursed",
        loan_type=_loan_type(lead),
        lead_source="My Leads",
        partner_user_id=purchase.buyer_user_id,
        partner_name=((partner.full_name or partner.email) if partner else "")[:200],
        partner_code=((partner.dsa_id or "") if partner else "")[:40],
        client_name=((lead.applicant_name or "") if lead else "")[:200],
        client_phone=((lead.full_phone or "") if lead else "")[:30],
        loan_amount=lead_amount or disbursed,
        sanctioned_amount=disbursed,
        payable_percent=float(partner.agreement_percent) if partner and partner.agreement_percent else 90,
        bank_name=lender_from_notes(purchase),
        submitted_by=((actor.full_name or actor.email) if actor else "Auto · My Leads")[:120],
        owner_user_id=actor.id if actor else None,
    )


def sync_case_for_purchase(
    db: Session, purchase: LeadPurchase, actor: User | None = None, reopened: bool = False
) -> bool:
    """Keep a lead's case file in step with My Leads.

    Disbursed with no file: create it. Rejected: cancel the file. Rejected lead moved back to disbursed:
    lift the cancel. Every other field on an existing file belongs to the admin and is left alone.
    """
    row = case_for_purchase(db, purchase.id)
    changed = False
    if purchase.pipeline_stage == "rejected":
        if row is not None and row.flag != "cancelled":
            row.flag = "cancelled"
            changed = True
    elif is_disbursed(purchase):
        if row is None:
            return _insert_numbered(db, _case_from_purchase(db, purchase, actor)) is not None
        if reopened and row.flag == "cancelled":
            row.flag = ""
            changed = True
    if row is not None and not row.bank_name:
        lender = lender_from_notes(purchase)
        if lender:
            row.bank_name = lender
            changed = True
    if not changed:
        return False
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False
    return True


def import_disbursed(db: Session, user: User | None) -> dict:
    """Bring Case Files in line with My Leads: a file for every disbursed lead, cancelled for every rejected one."""
    everything = db.query(LeadPurchase).order_by(LeadPurchase.created_at.asc()).all()
    purchases = [row for row in everything if is_disbursed(row)]
    rejected = [row.id for row in everything if row.pipeline_stage == "rejected"]
    taken = {
        pid for (pid,) in db.query(LoanCase.lead_purchase_id).filter(LoanCase.lead_purchase_id.isnot(None)).all()
    }
    created: list[LoanCase] = []
    number = _next_case_no(db)
    for purchase in purchases:
        if purchase.id in taken:
            continue
        row = _case_from_purchase(db, purchase, user)
        row.case_no = number
        row.deal_no = _deal_no(number)
        number += 1
        db.add(row)
        created.append(row)
        taken.add(purchase.id)
    cancelled = 0
    if rejected:
        for row in db.query(LoanCase).filter(LoanCase.lead_purchase_id.in_(rejected), LoanCase.flag != "cancelled").all():
            row.flag = "cancelled"
            cancelled += 1
    lenders = {row.id: lender_from_notes(row) for row in everything}
    lenders = {pid: name for pid, name in lenders.items() if name}
    filled = 0
    if lenders:
        for row in db.query(LoanCase).filter(LoanCase.lead_purchase_id.in_(list(lenders)), LoanCase.bank_name == "").all():
            row.bank_name = lenders[row.lead_purchase_id]
            filled += 1
    if created or cancelled or filled:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            created, cancelled = [], 0
    return {
        "created": len(created),
        "cancelled": cancelled,
        "already_linked": len(purchases) - len(created),
        "disbursed_leads": len(purchases),
        "items": [serialize(row) for row in created],
    }


def _dump_value(row: dict, *names: str) -> str:
    folded = {str(key or "").strip().lower().replace(" ", "_"): value for key, value in row.items()}
    for name in names:
        value = folded.get(name)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _table_rows(raw: bytes) -> list[dict]:
    if raw[:2] == b"PK":
        from openpyxl import load_workbook
        sheet = load_workbook(io.BytesIO(raw), read_only=True, data_only=True).active
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(cell or "").strip() for cell in rows[0]]
        parsed = []
        for values in rows[1:]:
            parsed.append({headers[i]: "" if i >= len(values) or values[i] is None else str(values[i]) for i in range(len(headers))})
        return parsed
    text = raw.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def _mapped(row: dict, header: str) -> str:
    if not header:
        return ""
    value = row.get(header)
    if value is None:
        folded = {str(key or "").strip(): value for key, value in row.items()}
        value = folded.get(header.strip())
    return "" if value is None else str(value).strip()


def _dump_items(raw: bytes, mapping: dict | None = None) -> list[dict]:
    chosen = mapping or {}
    items = []
    for index, row in enumerate(_table_rows(raw), start=2):
        amount_text = _mapped(row, str(chosen.get("amount") or "")) or _dump_value(row, "amount", "disbursed", "disbursed_amount")
        invalid_amount = False
        try:
            amount = round(float(str(amount_text).replace(",", "") or 0), 2)
        except ValueError:
            amount = 0
            invalid_amount = bool(str(amount_text).strip())
        items.append({
            "invalid_amount": invalid_amount,
            "row": index,
            "application_no": (_mapped(row, str(chosen.get("application_no") or "")) or _dump_value(row, "application_no", "application", "app_no"))[:80],
            "lan": (_mapped(row, str(chosen.get("lan") or "")) or _dump_value(row, "lan", "loan_account", "loan_account_number"))[:80],
            "phone": "".join(ch for ch in (_mapped(row, str(chosen.get("phone") or "")) or _dump_value(row, "phone", "mobile")) if ch.isdigit())[-10:],
            "amount": amount,
            "date": (_mapped(row, str(chosen.get("date") or "")) or _dump_value(row, "date", "disbursement_date"))[:20],
            "reference": (_mapped(row, str(chosen.get("reference") or "")) or _dump_value(row, "reference", "utr", "txn"))[:80],
        })
    return items


def _one_match(rows: list, how: str) -> tuple[LoanCase | None, str]:
    if len(rows) > 1:
        return None, "ambiguous"
    if rows:
        return rows[0], how
    return None, ""


def _match_dump(db: Session, item: dict) -> tuple[LoanCase | None, str]:
    if item.get("deal_no"):
        found, how = _one_match(db.query(LoanCase).filter(LoanCase.deal_no == item["deal_no"]).limit(2).all(), "case number")
        if found or how == "ambiguous":
            return found, how
    if item.get("application_no"):
        found, how = _one_match(db.query(LoanCase).filter(func.lower(LoanCase.application_no) == item["application_no"].lower()).limit(2).all(), "application number")
        if found or how == "ambiguous":
            return found, how
    if item.get("lan"):
        found, how = _one_match(db.query(LoanCase).filter(func.lower(LoanCase.lan) == item["lan"].lower()).limit(2).all(), "LAN")
        if found or how == "ambiguous":
            return found, how
    if item.get("phone"):
        found, how = _one_match(db.query(LoanCase).filter(LoanCase.client_phone.like(f"%{item['phone']}")).limit(2).all(), "phone")
        if found or how == "ambiguous":
            return found, how
    return None, ""


def preview_lender_dump(db: Session, raw: bytes, mapping: dict | None = None) -> dict:
    preview = []
    headers = list(_table_rows(raw)[0].keys()) if _table_rows(raw) else []
    for item in _dump_items(raw, mapping):
        case, how = _match_dump(db, item)
        status = "unmatched"
        if item.get("invalid_amount"):
            status = "invalid"
        elif how == "ambiguous":
            status = "ambiguous"
        elif case is not None:
            lines = _clean_disbursements(case.disbursements)
            same = item["reference"] and any(line.get("reference") == item["reference"] for line in lines)
            if case.counted:
                status = "conflict"
            elif same:
                status = "duplicate"
            elif lines and abs(sum(float(line.get("amount") or 0) for line in lines) - item["amount"]) > 0.5:
                status = "conflict"
            else:
                status = "ready"
        preview.append({**item, "status": status, "matched_by": how, "deal_no": case.deal_no if case else ""})
    return {"rows": preview, "ready": sum(1 for row in preview if row["status"] == "ready"), "headers": [header for header in headers if header]}


def _public_dump_row(item: dict) -> dict:
    return {key: item.get(key) for key in ("row", "application_no", "lan", "amount", "date", "reference", "status", "matched_by", "deal_no")}


def apply_lender_dump(db: Session, user: User, raw: bytes, filename: str, mapping: dict | None = None, lender: str = "") -> dict:
    """Stage the file. Cases change only after a different admin approves and someone applies that batch."""
    from app.models import ImportBatch
    preview = preview_lender_dump(db, raw, mapping)
    ready_amount = round(sum(float(item.get("amount") or 0) for item in preview["rows"] if item["status"] == "ready"), 2)
    status = "pending_approval" if preview["rows"] else "validation_failed"
    batch = ImportBatch(
        id=uuid4(),
        filename=filename[:180],
        created_by=user.id,
        status=status,
        snapshot=[{"kind": "summary", "lender": lender.strip()[:160], "dump_amount": ready_amount, "rows": len(preview["rows"])}],
        preview=[_public_dump_row(item) for item in preview["rows"]],
        mapping=mapping or {},
    )
    db.add(batch)
    write_audit(db, action="lender_dump_staged", actor_user_id=user.id, entity_type="lender_dump", entity_id=str(batch.id), detail={"filename": filename[:180], "status": status, "ready": preview["ready"]})
    db.commit()
    return {"applied": 0, "skipped": len(preview["rows"]) - preview["ready"], "batch_id": str(batch.id), "status": status, "ready": preview["ready"], "rows": preview["rows"]}


def approve_lender_dump(db: Session, user: User, batch_id: UUID) -> dict:
    from app.models import ImportBatch
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise LookupError("Import batch not found")
    if batch.status != "pending_approval":
        raise ValueError("This import is not waiting for approval")
    if batch.created_by == user.id:
        raise PermissionError("Another admin must approve this import")
    batch.status = "approved"
    batch.approved_by = user.id
    batch.approved_at = datetime.now(timezone.utc)
    write_audit(db, action="lender_dump_approved", actor_user_id=user.id, entity_type="lender_dump", entity_id=str(batch.id), detail={"filename": batch.filename})
    db.commit()
    return {"id": str(batch.id), "status": batch.status}


def reject_lender_dump(db: Session, user: User, batch_id: UUID) -> dict:
    from app.models import ImportBatch
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise LookupError("Import batch not found")
    if batch.status != "pending_approval":
        raise ValueError("This import is not waiting for approval")
    batch.status = "rejected"
    write_audit(db, action="lender_dump_rejected", actor_user_id=user.id, entity_type="lender_dump", entity_id=str(batch.id), detail={"filename": batch.filename})
    db.commit()
    return {"id": str(batch.id), "status": batch.status}


def apply_approved_dump(db: Session, user: User, batch_id: UUID) -> dict:
    from app.models import ImportBatch
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise LookupError("Import batch not found")
    if batch.status != "approved":
        raise ValueError("Approve the import before it can be applied")
    applied = 0
    skipped = 0
    snapshot = [item for item in (batch.snapshot or []) if item.get("kind") == "summary"]
    for item in batch.preview or []:
        if item.get("status") != "ready":
            skipped += 1
            continue
        case, _how = _match_dump(db, item)
        if case is None or case.counted:
            skipped += 1
            continue
        snapshot.append({"id": str(case.id), "application_no": case.application_no, "lan": case.lan, "disbursements": list(case.disbursements or [])})
        if item.get("application_no") and not case.application_no:
            case.application_no = item["application_no"]
        if item.get("lan") and not case.lan:
            case.lan = item["lan"]
        lines = _clean_disbursements(case.disbursements)
        if float(item.get("amount") or 0) > 0 and not lines:
            case.disbursements = _clean_disbursements([{"date": item.get("date") or "", "amount": item.get("amount") or 0, "reference": item.get("reference") or ""}])
        applied += 1
    batch.snapshot = snapshot
    batch.status = "applied" if skipped == 0 else "partially_applied"
    write_audit(db, action="lender_dump_import", actor_user_id=user.id, entity_type="lender_dump", entity_id=str(batch.id), detail={"applied": applied, "skipped": skipped})
    db.commit()
    return {"applied": applied, "skipped": skipped, "batch_id": str(batch.id), "status": batch.status}


def rollback_lender_dump(db: Session, user: User, batch_id: UUID) -> dict:
    from app.models import ImportBatch
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise LookupError("Import batch not found")
    if batch.status not in {"applied", "partially_applied"}:
        raise ValueError("This import was already rolled back")
    restored = 0
    for item in batch.snapshot or []:
        if item.get("kind") == "summary" or not item.get("id"):
            continue
        case = db.query(LoanCase).filter(LoanCase.id == item.get("id")).first()
        if case is None or case.counted:
            continue
        case.application_no = item.get("application_no") or ""
        case.lan = item.get("lan") or ""
        case.disbursements = item.get("disbursements") or []
        restored += 1
    batch.status = "rolled_back"
    write_audit(db, action="lender_dump_rollback", actor_user_id=user.id, entity_type="import_batch", entity_id=str(batch.id), detail={"restored": restored})
    db.commit()
    return {"restored": restored}


def _books_window(date_from: str | None, date_to: str | None):
    start = (date_from or "")[:10]
    end = (date_to or "")[:10]
    if start and len(start) != 10:
        start = ""
    if end and len(end) != 10:
        end = ""
    return start, end


def _csv_cell(value) -> str:
    text = "" if value is None else str(value)
    if text[:1] in {"=", "+", "-", "@", "\t"}:
        text = "'" + text
    return text


def books_report(db: Session, user: User, date_from: str | None = None, date_to: str | None = None) -> dict:
    """Read-only totals. Does not write cases, invoices, snapshots, or payments."""
    from sqlalchemy.exc import ProgrammingError
    from app.models import CommissionSnapshot, Lender, PayoutRequest, SchemeTarget

    start, end = _books_window(date_from, date_to)
    query = _visible(db, user)
    rows = []
    for row in query.all():
        opened = (row.created_at.date().isoformat() if row.created_at else "")
        if start and opened and opened < start:
            continue
        if end and opened and opened > end:
            continue
        if (start or end) and not opened:
            continue
        rows.append(row)

    snaps: dict = {}
    try:
        ids = [row.id for row in rows]
        if ids:
            for snap in db.query(CommissionSnapshot).filter(CommissionSnapshot.loan_case_id.in_(ids)).all():
                current = snaps.get(snap.loan_case_id)
                if current is None or snap.version > current.version:
                    snaps[snap.loan_case_id] = snap
    except ProgrammingError:
        db.rollback()
        snaps = {}

    stages = {key: {"count": 0, "disbursement_base": 0.0} for key in (
        "draft", "submitted", "logged_in", "sanctioned", "disbursed", "disbursed_confirmed", "collected", "on_hold", "cancelled", "other",
    )}
    legacy = frozen = open_cases = 0
    disbursement = receivable_calc = payable_calc = 0.0
    frozen_receivable = frozen_payable = 0.0
    lenders: dict = {}
    unlinked = 0
    partners: dict = {}
    commission_rows = []
    seen = set()
    lender_names = {}
    try:
        for lender in db.query(Lender).all():
            lender_names[lender.id] = lender.name
    except ProgrammingError:
        db.rollback()

    for row in rows:
        if row.id in seen:
            continue
        seen.add(row.id)
        money = figures(row)
        if row.flag == "cancelled":
            bucket = "cancelled"
        elif row.flag == "hold":
            bucket = "on_hold"
        elif row.stage in stages:
            bucket = row.stage
        else:
            bucket = "other"
        stages[bucket]["count"] += 1
        stages[bucket]["disbursement_base"] = _round(stages[bucket]["disbursement_base"] + money["base_amount"])
        disbursement += money["base_amount"]
        snap = snaps.get(row.id)
        if snap is not None:
            frozen += 1
            show_receivable = float(snap.receivable_amount or 0)
            show_payable = float(snap.payable_amount or 0)
            show_base = float(snap.base_amount or 0)
            source = "snapshot"
            frozen_receivable += show_receivable
            frozen_payable += show_payable
        elif row.counted:
            legacy += 1
            show_receivable = money["receivable_amount"]
            show_payable = money["payable_amount"]
            show_base = money["base_amount"]
            source = "legacy"
            receivable_calc += show_receivable
            payable_calc += show_payable
        else:
            open_cases += 1
            show_receivable = money["receivable_amount"]
            show_payable = money["payable_amount"]
            show_base = money["base_amount"]
            source = "calculated"
            receivable_calc += show_receivable
            payable_calc += show_payable
        if row.lender_id:
            name = lender_names.get(row.lender_id) or (row.bank_name or "Linked lender")
            slot = lenders.setdefault(str(row.lender_id), {"lender": name, "cases": 0, "active": 0, "disbursed": 0, "disbursement": 0.0, "receivable": 0.0, "payable": 0.0, "schemes": 0})
            slot["cases"] += 1
            if row.flag not in {"cancelled", "hold"} and row.stage not in {"collected", "draft"}:
                slot["active"] += 1
            if row.stage in {"disbursed", "disbursed_confirmed", "collected"}:
                slot["disbursed"] += 1
            slot["disbursement"] = _round(slot["disbursement"] + show_base)
            slot["receivable"] = _round(slot["receivable"] + show_receivable)
            slot["payable"] = _round(slot["payable"] + show_payable)
            if row.scheme_id:
                slot["schemes"] += 1
        else:
            unlinked += 1
        partner = (row.partner_name or "Partner not set").strip()
        pslot = partners.setdefault(partner, {"partner": partner, "cases": 0, "disbursement": 0.0, "receivable": 0.0, "payable": 0.0})
        pslot["cases"] += 1
        pslot["disbursement"] = _round(pslot["disbursement"] + show_base)
        pslot["receivable"] = _round(pslot["receivable"] + show_receivable)
        pslot["payable"] = _round(pslot["payable"] + show_payable)
        if len(commission_rows) < 40:
            commission_rows.append({
                "deal_no": row.deal_no,
                "lender": lender_names.get(row.lender_id) or row.bank_name or "",
                "product": row.loan_type or "",
                "base": _round(show_base),
                "receivable": _round(show_receivable),
                "payable": _round(show_payable),
                "source": source,
                "counted": bool(row.counted),
            })

    invoices = []
    paid_total = 0.0
    paid_count = pending_count = approved_count = 0
    pending_net = 0.0
    try:
        for inv in db.query(PayoutRequest).order_by(PayoutRequest.created_at.desc()).limit(200).all():
            opened = inv.created_at.date().isoformat() if inv.created_at else ""
            if start and opened and opened < start:
                continue
            if end and opened and opened > end:
                continue
            snap = inv.bank_snapshot or {}
            lines = snap.get("gst_lines") if isinstance(snap.get("gst_lines"), dict) else None
            paid = inv.status == "paid"
            recorded = float(inv.paid_amount) if paid and inv.paid_amount is not None else None
            if paid:
                paid_count += 1
                if recorded is not None:
                    paid_total += recorded
            elif inv.status in {"pending", "query"}:
                pending_count += 1
                if inv.net_payable is not None:
                    pending_net += float(inv.net_payable)
            elif inv.status in {"approved", "processing"}:
                approved_count += 1
                if inv.net_payable is not None:
                    pending_net += float(inv.net_payable)
            if len(invoices) < 40:
                invoices.append({
                    "number": snap.get("invoice_number") or inv.note or "",
                    "status": inv.status,
                    "stage": inv.stage or "",
                    "opened": opened,
                    "taxable": (lines or {}).get("taxable_amount"),
                    "gst": float(inv.gst_amount) if inv.gst_amount is not None else None,
                    "cgst": (lines or {}).get("cgst"),
                    "sgst": (lines or {}).get("sgst"),
                    "igst": (lines or {}).get("igst"),
                    "gst_lines": "stored" if lines else "not stored",
                    "tds": float(inv.tds_amount) if inv.tds_amount is not None else None,
                    "net": float(inv.net_payable) if inv.net_payable is not None else None,
                    "paid_amount": recorded,
                    "payment_date": inv.payment_date.isoformat() if inv.payment_date else "",
                    "payment_mode": inv.payment_mode or "",
                    "utr": inv.utr or "",
                })
    except ProgrammingError:
        db.rollback()

    schemes = []
    try:
        from app.api.los_books import _achievement
        for target in db.query(SchemeTarget).order_by(SchemeTarget.start_on.desc()).limit(20).all():
            achieved = _achievement(db, target)
            schemes.append({
                "period": f"{target.start_on} to {target.end_on}",
                "metric": target.metric,
                "target": float(target.target_value or 0),
                "achieved": achieved["achieved"],
                "percent": achieved["percent"],
                "remaining": achieved["remaining"],
                "cases": achieved["cases"],
                "note": "No target" if float(target.target_value or 0) <= 0 else "",
            })
    except ProgrammingError:
        db.rollback()
    except Exception:
        db.rollback()

    return {
        "filtered_on": "case opened date",
        "from": start,
        "to": end,
        "generated_note": "Calculated and snapshot amounts are estimates or frozen books. Paid amounts are recorded settlements only.",
        "cases": len(seen),
        "counted": frozen + legacy,
        "frozen": frozen,
        "legacy": legacy,
        "open": open_cases,
        "disbursement_base": _round(disbursement),
        "snapshot_receivable": _round(frozen_receivable),
        "snapshot_payable": _round(frozen_payable),
        "calculated_receivable": _round(receivable_calc),
        "calculated_payable": _round(payable_calc),
        "stages": stages,
        "unlinked_lender_cases": unlinked,
        "lenders": sorted(lenders.values(), key=lambda item: item["receivable"], reverse=True)[:20],
        "partners": sorted(partners.values(), key=lambda item: item["payable"], reverse=True)[:20],
        "commission_rows": commission_rows,
        "invoices": invoices,
        "invoice_pending": pending_count,
        "invoice_approved": approved_count,
        "invoice_paid": paid_count,
        "recorded_paid": _round(paid_total),
        "open_invoice_net": _round(pending_net),
        "schemes": schemes,
    }


def books_csv(db: Session, user: User, date_from: str | None = None, date_to: str | None = None) -> str:
    import csv
    import io
    report = books_report(db, user, date_from, date_to)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["RupeeDial books", report["filtered_on"], report["from"], report["to"]])
    writer.writerow(["section", "name", "count", "amount", "source", "status"])
    for key, bucket in report["stages"].items():
        writer.writerow(["stage", _csv_cell(key), bucket["count"], bucket["disbursement_base"], "calculated disbursement base", ""])
    for row in report["lenders"]:
        writer.writerow(["lender", _csv_cell(row["lender"]), row["cases"], row["disbursement"], "linked lender only", ""])
    for row in report["invoices"]:
        writer.writerow(["invoice", _csv_cell(row["number"]), "", row["paid_amount"] if row["paid_amount"] is not None else "", row["gst_lines"], _csv_cell(row["status"])])
    return buffer.getvalue()


def finance_report(db: Session, user: User) -> dict:
    invoices = _invoice_index(db)
    rows = []
    receivable = collected = outstanding = bonus = 0.0
    for row in _visible(db, user).all():
        money = figures(row)
        got = _round(row.collected_amount)
        due = _round(max(0, money["receivable_amount"] + money["bonus_amount"] - got))
        invoice = invoices.get(str(row.lead_purchase_id or "")) if row.lead_purchase_id else None
        receivable += money["receivable_amount"]
        collected += got
        outstanding += due
        bonus += money["bonus_amount"]
        rows.append({
            "deal_no": row.deal_no,
            "partner_name": row.partner_name,
            "bank_name": row.bank_name,
            "loan_type": row.loan_type,
            "base_amount": money["base_amount"],
            "receivable_amount": money["receivable_amount"],
            "payable_amount": money["payable_amount"],
            "bonus_amount": money["bonus_amount"],
            "bonus_name": row.bonus_name or "",
            "collected_amount": got,
            "outstanding": due,
            "age_days": max(0, (datetime.now(timezone.utc) - (row.created_at or datetime.now(timezone.utc))).days) if due else 0,
            "lender_status": row.lender_status or "",
            "counted": bool(row.counted),
            "invoice_number": (invoice or {}).get("number") or "",
            "invoice_status": (invoice or {}).get("status_label") or "",
        })
    return {
        "receivable": _round(receivable),
        "collected": _round(collected),
        "outstanding": _round(outstanding),
        "bonus": _round(bonus),
        "rows": rows,
    }


def stage_counts(db: Session, user: User) -> dict:
    """One visible case sits in exactly one stage bucket. Money buckets are separate and are not added to the total."""
    rows = list(_visible(db, user).all())
    stages = {key: 0 for key in ("draft", "submitted", "logged_in", "sanctioned", "disbursed", "disbursed_confirmed", "collected", "on_hold", "cancelled", "other")}
    money = {"commission_pending": 0, "commission_received": 0, "partner_payout_pending": 0, "partner_payout_paid": 0}
    seen = set()
    for row in rows:
        if row.id in seen:
            continue
        seen.add(row.id)
        if row.flag == "cancelled":
            stages["cancelled"] += 1
        elif row.flag == "hold":
            stages["on_hold"] += 1
        elif row.stage in stages:
            stages[row.stage] += 1
        else:
            stages["other"] += 1
        if row.flag == "cancelled":
            continue
        figures_row = figures(row)
        receivable = figures_row["receivable_amount"]
        if receivable > 0 and figures_row["collection_percent"] >= 100:
            money["commission_received"] += 1
        elif receivable > 0 and row.stage in ("disbursed", "disbursed_confirmed", "collected"):
            money["commission_pending"] += 1
        if row.payout_status == "paid":
            money["partner_payout_paid"] += 1
        elif row.stage in ("disbursed", "disbursed_confirmed", "collected"):
            money["partner_payout_pending"] += 1
    return {"total": len(seen), "stages": stages, "money": money}


def case_timeline(db: Session, user: User, case_id: UUID) -> dict:
    from app.models import AuditEvent, InvoiceApproval
    row = _visible(db, user).filter(LoanCase.id == case_id).first()
    if row is None:
        raise LookupError("Case not found")
    events = []
    if row.created_at:
        events.append({
            "at": row.created_at.isoformat(),
            "action": "Case opened",
            "actor": row.submitted_by or "",
            "detail": row.deal_no,
            "ref": "",
        })
    if row.updated_at:
        events.append({
            "at": row.updated_at.isoformat(),
            "action": "Current stage",
            "actor": "",
            "detail": status_label(row) + (" · counted" if row.counted else ""),
            "ref": "",
        })
    for line in _clean_disbursements(row.disbursements):
        events.append({
            "at": f"{line['date']}T00:00:00+05:30" if line["date"] else "",
            "action": "Disbursement recorded",
            "actor": "",
            "detail": f"₹{line['amount']:,.2f}" + (f" · {line['reference']}" if line["reference"] else ""),
            "ref": line["reference"],
        })
    if row.sanction_letter_name:
        events.append({"at": "", "action": "Sanction letter on file", "actor": "", "detail": row.sanction_letter_name, "ref": "sanction_letter"})
    if row.bank_confirmation_name:
        events.append({"at": "", "action": "Bank confirmation on file", "actor": "", "detail": row.bank_confirmation_name, "ref": "bank_confirmation"})
    for old in row.paper_history or []:
        if isinstance(old, dict) and old.get("name"):
            events.append({"at": "", "action": "Earlier paper", "actor": "", "detail": str(old.get("name")), "ref": str(old.get("kind") or "")})
    if row.lead_purchase_id:
        for req in db.query(PayoutRequest).order_by(PayoutRequest.created_at.asc()).all():
            snap = req.bank_snapshot or {}
            ids = {str(item) for item in (snap.get("case_ids") or [])}
            if str(row.lead_purchase_id) not in ids:
                continue
            number = str(snap.get("invoice_number") or "")
            if req.created_at:
                events.append({"at": req.created_at.isoformat(), "action": "Invoice created", "actor": "", "detail": number or req.stage or "", "ref": number})
            for step in db.query(InvoiceApproval).filter(InvoiceApproval.request_id == req.id).order_by(InvoiceApproval.created_at.asc()).all():
                events.append({
                    "at": step.created_at.isoformat() if step.created_at else "",
                    "action": f"Invoice {step.action or step.stage or 'update'}",
                    "actor": step.actor_name or "",
                    "detail": step.comment or step.stage or "",
                    "ref": number,
                })
            if req.utr:
                events.append({
                    "at": req.reviewed_at.isoformat() if req.reviewed_at else "",
                    "action": "UTR recorded",
                    "actor": "",
                    "detail": req.utr,
                    "ref": number,
                })
    for audit in db.query(AuditEvent).filter(AuditEvent.entity_type == "loan_case", AuditEvent.entity_id == str(row.id)).order_by(AuditEvent.created_at.asc()).all():
        actor = ""
        if audit.actor_user_id:
            person = db.query(User).filter(User.id == audit.actor_user_id).first()
            actor = (person.full_name or person.email) if person else ""
        changes = (audit.detail or {}).get("changes") or {}
        detail = ", ".join(f"{key}: {item.get('old')} → {item.get('new')}" for key, item in changes.items() if isinstance(item, dict))
        events.append({
            "at": audit.created_at.isoformat() if audit.created_at else "",
            "action": audit.action,
            "actor": actor,
            "detail": detail or str((audit.detail or {}).get("deal_no") or ""),
            "ref": "",
        })
    events.sort(key=lambda item: (item["at"] == "", item["at"]))
    return {"items": events}


def sample_file(db: Session, user: User) -> dict:
    """One local file with the same sums as a 1.4% / 90% closure. Not a live customer."""
    existing = db.query(LoanCase).filter(LoanCase.deal_no == SAMPLE_DEAL).first()
    if existing:
        return serialize(existing)
    row = LoanCase(
        id=uuid4(),
        deal_no=SAMPLE_DEAL,
        stage="collected",
        loan_type="LAP",
        lead_source="Connector",
        partner_code="RD-CP-1001",
        partner_name="Local Connector",
        client_name="Sample Applicant",
        client_phone="9800000001",
        project_name="Sample Project",
        expected_sanction_on="2026-09-16",
        client_access="Priority",
        loan_amount=2050000,
        sanctioned_amount=2050000,
        receivable_percent=1.4,
        payable_percent=90,
        loyalty_amount=0,
        bank_name="Sample Housing Finance",
        bank_rm="Sample RM",
        submitted_by=user.full_name or "Admin",
        counted=True,
        pod_pending=False,
        invoice_amount=28700,
        collected_amount=28700,
        payout_status="paid",
        payout_note="Payout completed against the sample file",
        owner_user_id=user.id,
    )
    saved = _insert_numbered(db, row)
    if saved is None:
        raise RuntimeError("Could not assign a case number, try again")
    return serialize(saved)
