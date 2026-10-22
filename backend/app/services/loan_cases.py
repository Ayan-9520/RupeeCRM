"""Closure-file math.

Receivable is what the lender pays RupeeDial.
Payable is the connector's share of that receivable, not of the loan.
Net is what remains after the connector share and any customer credit.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Lead, LeadPurchase, LoanCase, User

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


def _round(value: float) -> float:
    return round(float(value or 0), 2)


def figures(row: LoanCase) -> dict:
    """Lender pays receivable. Connector gets payable % of that.

    What is left is split in half: agent share and company net.
    20,50,000 at 1.4% is 28,700. Connector 90% is 25,830.
    Left 2,870 becomes agent 1,435 and net 1,435.
    """
    base = float(row.sanctioned_amount or 0) or float(row.loan_amount or 0)
    receivable = _round(base * float(row.receivable_percent or 0) / 100)
    payable = _round(receivable * float(row.payable_percent or 0) / 100)
    loyalty = _round(row.loyalty_amount or 0)
    margin = _round(receivable - payable - loyalty)
    agent = _round(margin / 2)
    net = _round(margin - agent)
    invoice = _round(row.invoice_amount or 0)
    collected = _round(row.collected_amount or 0)
    invoice_pct = _round(invoice / receivable * 100) if receivable else 0
    collection_pct = _round(collected / invoice * 100) if invoice else 0
    return {
        "base_amount": base,
        "receivable_amount": receivable,
        "payable_amount": payable,
        "loyalty_amount": loyalty,
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


def _deal_no() -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"RD-MCF-{day}-{uuid4().hex[:4].upper()}"


def serialize(row: LoanCase) -> dict:
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
        "bank_rm": row.bank_rm,
        "bank_rm_phone": row.bank_rm_phone,
        "submitted_by": row.submitted_by,
        "pod_pending": bool(row.pod_pending),
        "pod_remarks": row.pod_remarks,
        "counted": bool(row.counted),
        "invoice_amount": _round(row.invoice_amount),
        "collected_amount": _round(row.collected_amount),
        "payout_status": row.payout_status,
        "payout_note": note,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "submitted_on": _on_day(row),
        **money,
    }


def _visible(db: Session, user: User):
    query = db.query(LoanCase)
    if user.role not in {"admin", "ceo", "super_admin", "lender", "coordinator"}:
        query = query.filter(LoanCase.partner_user_id == user.id)
    return query.order_by(LoanCase.created_at.desc())


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
        "items": [serialize(row) for row in rows],
    }


def create_case(db: Session, user: User, payload: dict) -> dict:
    row = LoanCase(
        id=uuid4(),
        deal_no=_deal_no(),
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
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize(row)


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
        "bank_name",
        "bank_rm",
        "bank_rm_phone",
        "pod_remarks",
        "payout_note",
    )
    for key in text_fields:
        if key in payload and payload[key] is not None:
            setattr(row, key, str(payload[key]).strip())
    for key in ("loan_amount", "sanctioned_amount", "receivable_percent", "payable_percent", "loyalty_amount", "invoice_amount", "collected_amount"):
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


def update_case(db: Session, user: User, case_id: UUID, payload: dict) -> dict:
    row = db.query(LoanCase).filter(LoanCase.id == case_id).first()
    if not row:
        raise LookupError("Case not found")
    if user.role not in {"admin", "ceo", "super_admin"}:
        raise PermissionError("Only admin can edit a case file")
    _apply(row, payload)
    db.commit()
    db.refresh(row)
    return serialize(row)


def lead_deal_no(purchase_id: UUID) -> str:
    return f"RD-LP-{purchase_id.hex}"


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
        deal_no=lead_deal_no(purchase.id),
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
    row = db.query(LoanCase).filter(LoanCase.deal_no == lead_deal_no(purchase.id)).first()
    changed = False
    if purchase.pipeline_stage == "rejected":
        if row is not None and row.flag != "cancelled":
            row.flag = "cancelled"
            changed = True
    elif is_disbursed(purchase):
        if row is None:
            db.add(_case_from_purchase(db, purchase, actor))
            changed = True
        elif reopened and row.flag == "cancelled":
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
    rejected = {lead_deal_no(row.id) for row in everything if row.pipeline_stage == "rejected"}
    taken = {
        deal_no
        for (deal_no,) in db.query(LoanCase.deal_no).filter(LoanCase.deal_no.like("RD-LP-%")).all()
    }
    created: list[LoanCase] = []
    for purchase in purchases:
        if lead_deal_no(purchase.id) in taken:
            continue
        row = _case_from_purchase(db, purchase, user)
        db.add(row)
        created.append(row)
        taken.add(row.deal_no)
    cancelled = 0
    if rejected:
        for row in db.query(LoanCase).filter(LoanCase.deal_no.in_(rejected), LoanCase.flag != "cancelled").all():
            row.flag = "cancelled"
            cancelled += 1
    lenders = {lead_deal_no(row.id): lender_from_notes(row) for row in everything}
    lenders = {deal: name for deal, name in lenders.items() if name}
    filled = 0
    if lenders:
        for row in db.query(LoanCase).filter(LoanCase.deal_no.in_(list(lenders)), LoanCase.bank_name == "").all():
            row.bank_name = lenders[row.deal_no]
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


def sample_file(db: Session, user: User) -> dict:
    """One local file with the same sums as a 1.4% / 90% closure. Not a live customer."""
    existing = db.query(LoanCase).filter(LoanCase.deal_no == "RD-MCF-SAMPLE-0844").first()
    if existing:
        return serialize(existing)
    row = LoanCase(
        id=uuid4(),
        deal_no="RD-MCF-SAMPLE-0844",
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
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize(row)
