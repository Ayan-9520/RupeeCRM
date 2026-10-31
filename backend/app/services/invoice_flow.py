"""Partner invoice approval chain: RM1 -> RM2 -> Manager -> Business Head -> Accounts."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.models import CommissionSettings, InvoiceApproval, PayoutRequest, User, UserNotification

ADMIN_ROLES = {"admin", "ceo", "super_admin"}
STAGES = ["rm1", "rm2", "manager", "business_head", "accounts"]
STAGE_LABELS = {
    "rm1": "RM 1 check",
    "rm2": "RM 2 check",
    "manager": "Manager approval",
    "business_head": "Business Head approval",
    "accounts": "Accounts payment",
    "paid": "Paid",
    "query": "Query",
    "rejected": "Rejected",
}
FINANCE_LEVELS = {"rm", "manager", "business_head", "accounts"}
PAYMENT_MODES = {"NEFT", "RTGS", "IMPS", "UPI", "CHEQUE"}
NOTIFY_LINK_STAFF = "/dashboard/invoice-approvals"
NOTIFY_LINK_PARTNER = "/dashboard/earnings"


def status_for(stage: str) -> str:
    if stage in {"rm1", "rm2", "manager", "business_head"}:
        return "pending"
    if stage == "accounts":
        return "approved"
    return stage


def next_stage(stage: str) -> str:
    return STAGES[STAGES.index(stage) + 1]


def tax_settings(db: Session) -> tuple[float, float]:
    row = db.query(CommissionSettings).filter(CommissionSettings.id == 1).first()
    if not row:
        return 18.0, 2.0
    return float(row.gst_percent or 0), float(row.tds_percent or 0)


def tax_breakup(db: Session, amount: float, gstin: str | None) -> tuple[float, float, float]:
    gst_pct, tds_pct = tax_settings(db)
    gst = round(amount * gst_pct / 100, 2) if (gstin or "").strip() else 0.0
    tds = round(amount * tds_pct / 100, 2)
    return gst, tds, round(amount + gst - tds, 2)


def is_staff(user: User) -> bool:
    return user.role in ADMIN_ROLES or (user.finance_level or "") in FINANCE_LEVELS


def can_act(user: User, row: PayoutRequest, partner: User | None) -> bool:
    stage = row.stage or ""
    if stage not in STAGES or row.user_id == user.id:
        return False
    if user.role in ADMIN_ROLES:
        return True
    if partner and stage == "rm1":
        return partner.rm1_user_id == user.id
    if partner and stage == "rm2":
        return partner.rm2_user_id == user.id
    return (user.finance_level or "") == stage


def approvers_for(db: Session, stage: str, partner: User | None) -> list[User]:
    ids: list[UUID] = []
    if stage == "rm1" and partner and partner.rm1_user_id:
        ids = [partner.rm1_user_id]
    elif stage == "rm2" and partner and partner.rm2_user_id:
        ids = [partner.rm2_user_id]
    if ids:
        users = db.query(User).filter(User.id.in_(ids), User.is_active.is_(True)).all()
    elif stage in {"manager", "business_head", "accounts"}:
        users = db.query(User).filter(User.finance_level == stage, User.is_active.is_(True)).all()
    else:
        users = []
    if not users:
        users = db.query(User).filter(User.role.in_(ADMIN_ROLES), User.is_active.is_(True)).all()
    return users


def log_step(db: Session, row: PayoutRequest, stage: str, action: str, actor: User | None, comment: str | None = None) -> None:
    db.add(
        InvoiceApproval(
            request_id=row.id,
            stage=stage,
            action=action,
            comment=(comment or "").strip()[:2000] or None,
            actor_user_id=actor.id if actor else None,
            actor_name=(actor.full_name if actor else None),
        )
    )


def notify(db: Session, users: list[User], title: str, body: str, link: str) -> None:
    seen: set[UUID] = set()
    for user in users:
        if user.id in seen:
            continue
        seen.add(user.id)
        db.add(UserNotification(user_id=user.id, type="invoice", title=title[:200], body=body[:500], link=link))


def invoice_number(row: PayoutRequest) -> str:
    return str((row.bank_snapshot or {}).get("invoice_number") or row.note or "Invoice")


def notify_stage(db: Session, row: PayoutRequest, partner: User | None) -> None:
    stage = row.stage or ""
    if stage not in STAGES:
        return
    who = partner.full_name if partner else "Partner"
    notify(
        db,
        approvers_for(db, stage, partner),
        f"Invoice {invoice_number(row)} needs {STAGE_LABELS[stage]}",
        f"{who} · Rs {float(row.net_payable or row.amount or 0):,.0f}",
        NOTIFY_LINK_STAFF,
    )
