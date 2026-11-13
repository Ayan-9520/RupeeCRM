"""Month, quarter, and year numbers for one seat.

A unit head sees the partners mapped to the coordinators who report to them.
A coordinator sees only those partners. A caller sees calls. The backend seat
sees bank files. A partner sees their own share, never the company leftover.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import BillingPayment, Lead, LeadPurchase, LoanCase, PayoutRequest, User
from app.plans import PLANS, cycle_price
from app.services.loan_cases import figures

router = APIRouter(prefix="/api/performance", tags=["performance"])

IST = timezone(timedelta(hours=5, minutes=30))
ADMIN = {"ceo", "super_admin", "admin"}
PARTNERS = {"dsa", "affiliate"}
PERIODS = {"month", "quarter", "year"}
INTERESTED = {"interested", "connected"}
NOT_INTERESTED = {"not_interested", "wrong_number"}
HANDED = {"interested", "connected"}


def _window(period: str, now: datetime) -> tuple[datetime, datetime, str]:
    local = now.astimezone(IST)
    if period == "year":
        start = datetime(local.year, 1, 1, tzinfo=IST)
        label = str(local.year)
    elif period == "quarter":
        quarter = (local.month - 1) // 3
        start = datetime(local.year, quarter * 3 + 1, 1, tzinfo=IST)
        label = f"Q{quarter + 1} {local.year}"
    else:
        start = datetime(local.year, local.month, 1, tzinfo=IST)
        label = start.strftime("%b %Y")
    return start, local, label


def _when(value) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=IST)
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _inside(value, start: datetime, end: datetime) -> bool:
    moment = _when(value)
    if moment is None:
        return False
    return start <= moment.astimezone(IST) <= end


def _notes(purchase: LeadPurchase) -> list[dict]:
    return [note for note in (purchase.notes or []) if isinstance(note, dict)]


def _stage_in_period(purchase: LeadPurchase, stage: str, start: datetime, end: datetime) -> bool:
    saw_stage_note = False
    for note in _notes(purchase):
        if note.get("kind") != "stage":
            continue
        saw_stage_note = True
        text = str(note.get("text") or "")
        if text.endswith(f"→ {stage}") and _inside(note.get("at"), start, end):
            return True
    if saw_stage_note:
        return False
    return purchase.pipeline_stage == stage and _inside(purchase.updated_at, start, end)


def _downline(rows: list[User], root: UUID) -> set[UUID]:
    children: dict[UUID, list[UUID]] = {}
    for row in rows:
        if row.reports_to_user_id:
            children.setdefault(row.reports_to_user_id, []).append(row.id)
    found: set[UUID] = set()
    stack = list(children.get(root, []))
    while stack:
        current = stack.pop()
        if current in found:
            continue
        found.add(current)
        stack.extend(children.get(current, []))
    return found


def _seat(user: User) -> str:
    if user.role == "caller":
        return "Telecaller"
    if user.role in PARTNERS:
        return "Partner"
    if user.department == "OPS" and not user.finance_level:
        return "Backend"
    if user.finance_level == "rm":
        return "DSA coordinator"
    if user.finance_level == "manager":
        return "Unit head"
    if user.finance_level == "business_head":
        return "Business head"
    if user.finance_level == "accounts":
        return "Accounts"
    if user.role in ADMIN:
        return "Company"
    return "Employee"


def _money(purchase: LeadPurchase, case: LoanCase | None, lead: Lead | None) -> tuple[float, float, float, float]:
    if case is not None:
        fig = figures(case)
        return fig["base_amount"], fig["receivable_amount"], fig["payable_amount"], fig["net_revenue"]
    base = float(purchase.deal_value or 0) or float(lead.loan_amount or 0 if lead else 0)
    return round(base, 2), 0.0, 0.0, 0.0


def _plan_sale(user: User, start: datetime, end: datetime) -> float:
    if user.plan_status != "active" or not _inside(user.plan_started_at, start, end):
        return 0.0
    plan = PLANS.get(user.plan_id or "")
    if not plan:
        return 0.0
    return float(cycle_price(int(plan["monthly"]), user.plan_cycle or "monthly"))


@router.get("")
def performance(
    period: str = Query(default="month"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if period not in PERIODS:
        raise HTTPException(status_code=400, detail="Period is month, quarter, or year")
    if user.role not in ADMIN | PARTNERS | {"caller", "coordinator"}:
        raise HTTPException(status_code=403, detail="Not allowed")

    start, end, label = _window(period, datetime.now(timezone.utc))
    people = db.query(User).filter(User.is_active.is_(True)).all()
    by_id = {row.id: row for row in people}
    names = {row.id: row.full_name for row in people}
    reports = [row for row in people if row.reports_to_user_id == user.id]
    team_ids = _downline(people, user.id)

    if user.role in PARTNERS:
        view = "partner"
        book = [user]
        staff: list[User] = []
    elif user.role == "caller":
        view = "caller"
        book = []
        staff = []
    elif user.role == "coordinator" and user.department == "OPS" and not user.finance_level:
        view = "backend"
        manager_id = user.reports_to_user_id
        scope = _downline(people, manager_id) | {manager_id} if manager_id else set()
        book = [row for row in people if row.role in PARTNERS and row.rm1_user_id in scope]
        staff = []
    elif user.role in ADMIN or user.finance_level == "accounts":
        view = "company"
        book = [row for row in people if row.role in PARTNERS]
        staff = []
    elif user.finance_level in {"manager", "business_head"} or (team_ids and user.finance_level != "rm"):
        view = "unit"
        scope = team_ids | {user.id}
        book = [row for row in people if row.role in PARTNERS and row.rm1_user_id in scope]
        staff = [by_id[item] for item in team_ids if item in by_id and by_id[item].role not in PARTNERS]
    else:
        view = "coordinator"
        book = [row for row in people if row.role in PARTNERS and row.rm1_user_id == user.id]
        staff = []

    book_ids = {row.id for row in book}
    purchases = (
        db.query(LeadPurchase).filter(LeadPurchase.buyer_user_id.in_(book_ids)).all() if book_ids else []
    )
    if view == "caller":
        purchases = db.query(LeadPurchase).all()
    lead_ids = {row.lead_id for row in purchases}
    purchase_ids = {row.id for row in purchases}
    leads = {row.id: row for row in db.query(Lead).filter(Lead.id.in_(lead_ids)).all()} if lead_ids else {}
    cases = (
        {row.lead_purchase_id: row for row in db.query(LoanCase).filter(LoanCase.lead_purchase_id.in_(purchase_ids)).all()}
        if purchase_ids
        else {}
    )

    show_money = view in {"company", "unit", "coordinator"}
    totals = {
        "disbursed_amount": 0.0,
        "lender_payout": 0.0,
        "partner_share": 0.0,
        "company_revenue": 0.0,
        "plan_sales": 0.0,
        "disbursed_files": 0,
        "submitted": 0,
        "sanctioned": 0,
        "rejected": 0,
        "calls": 0,
        "interested": 0,
        "not_interested": 0,
        "handed": 0,
        "paid": 0.0,
    }
    per_partner: dict[UUID, dict] = {
        row.id: {
            "disbursed_amount": 0.0,
            "lender_payout": 0.0,
            "partner_share": 0.0,
            "company_revenue": 0.0,
            "files": 0,
            "plan_sales": _plan_sale(row, start, end),
        }
        for row in book
    }
    for row in book:
        totals["plan_sales"] += per_partner[row.id]["plan_sales"]

    paid_rows = (
        db.query(PayoutRequest).filter(PayoutRequest.user_id.in_(book_ids), PayoutRequest.status == "paid").all()
        if book_ids
        else []
    )
    paid_by_partner: dict[UUID, float] = {}
    for payout in paid_rows:
        moment = payout.payment_date or payout.reviewed_at or payout.updated_at
        if not _inside(moment, start, end):
            continue
        amount = float(payout.paid_amount if payout.paid_amount is not None else payout.net_payable or 0)
        paid_by_partner[payout.user_id] = round(paid_by_partner.get(payout.user_id, 0) + amount, 2)
        totals["paid"] = round(totals["paid"] + amount, 2)

    payments = (
        db.query(BillingPayment)
        .filter(BillingPayment.user_id.in_(book_ids), BillingPayment.plan_id.isnot(None), BillingPayment.status == "paid")
        .all()
        if book_ids
        else []
    )
    paid_plan_users: set[UUID] = set()
    for payment in payments:
        if not _inside(payment.paid_at or payment.created_at, start, end):
            continue
        if payment.user_id in paid_plan_users:
            continue
        paid_plan_users.add(payment.user_id)
        already = per_partner.get(payment.user_id, {}).get("plan_sales", 0)
        if already:
            continue
        amount = float(payment.amount or 0)
        per_partner.setdefault(payment.user_id, {}).update({"plan_sales": amount})
        totals["plan_sales"] = round(totals["plan_sales"] + amount, 2)

    caller_email = (user.email or "").lower()
    handed_ids: set[UUID] = set()
    staff_stats: dict[UUID, dict] = {
        row.id: {"calls": 0, "interested": 0, "not_interested": 0, "handed": 0, "bank": 0}
        for row in staff
    }
    staff_email = {row.email.lower(): row.id for row in staff if row.email}
    staff_handed: dict[UUID, set[UUID]] = {row.id: set() for row in staff}

    for purchase in purchases:
        hit_disbursed = _stage_in_period(purchase, "disbursed", start, end)
        if view == "backend":
            if _stage_in_period(purchase, "bank_submitted", start, end):
                totals["submitted"] += 1
            if _stage_in_period(purchase, "sanctioned", start, end):
                totals["sanctioned"] += 1
            if hit_disbursed:
                totals["disbursed_files"] += 1
            if _stage_in_period(purchase, "rejected", start, end):
                totals["rejected"] += 1
        if hit_disbursed and purchase.buyer_user_id in per_partner:
            base, lender, share, company = _money(purchase, cases.get(purchase.id), leads.get(purchase.lead_id))
            bucket = per_partner[purchase.buyer_user_id]
            bucket["disbursed_amount"] = round(bucket["disbursed_amount"] + base, 2)
            bucket["lender_payout"] = round(bucket["lender_payout"] + lender, 2)
            bucket["partner_share"] = round(bucket["partner_share"] + share, 2)
            bucket["company_revenue"] = round(bucket["company_revenue"] + company, 2)
            bucket["files"] += 1
            totals["disbursed_amount"] = round(totals["disbursed_amount"] + base, 2)
            totals["lender_payout"] = round(totals["lender_payout"] + lender, 2)
            totals["partner_share"] = round(totals["partner_share"] + share, 2)
            totals["company_revenue"] = round(totals["company_revenue"] + company, 2)
            if view != "backend":
                totals["disbursed_files"] += 1
        for note in _notes(purchase):
            if note.get("kind") != "disposition" or not _inside(note.get("at"), start, end):
                if note.get("kind") == "stage" and _inside(note.get("at"), start, end):
                    author = str(note.get("by") or "").lower()
                    text = str(note.get("text") or "")
                    if author in staff_email and any(text.endswith(f"→ {stage}") for stage in ("sanctioned", "disbursed", "rejected")):
                        staff_stats[staff_email[author]]["bank"] += 1
                continue
            code = str(note.get("code") or "")
            author = str(note.get("by") or "").lower()
            if view == "caller" and author == caller_email:
                totals["calls"] += 1
                if code in INTERESTED:
                    totals["interested"] += 1
                if code in NOT_INTERESTED:
                    totals["not_interested"] += 1
                if code in HANDED and purchase.id not in handed_ids:
                    handed_ids.add(purchase.id)
                    totals["handed"] += 1
            if author in staff_email:
                stats = staff_stats[staff_email[author]]
                stats["calls"] += 1
                if code in INTERESTED:
                    stats["interested"] += 1
                if code in NOT_INTERESTED:
                    stats["not_interested"] += 1
                if code in HANDED:
                    staff_handed[staff_email[author]].add(purchase.id)

    def money_row(row: User) -> dict:
        bucket = per_partner.get(row.id, {})
        item = {
            "id": str(row.id),
            "name": row.full_name,
            "seat": _seat(row),
            "agreement_percent": row.agreement_percent,
            "disbursed_amount": bucket.get("disbursed_amount", 0),
            "lender_payout": bucket.get("lender_payout", 0),
            "partner_share": bucket.get("partner_share", 0),
            "files": bucket.get("files", 0),
            "plan_sales": bucket.get("plan_sales", 0),
            "paid": paid_by_partner.get(row.id, 0),
        }
        if show_money:
            item["company_revenue"] = bucket.get("company_revenue", 0)
        return item

    def staff_row(row: User) -> dict:
        stats = staff_stats.get(row.id, {})
        own = [partner for partner in book if partner.rm1_user_id == row.id]
        company = round(sum(per_partner.get(partner.id, {}).get("company_revenue", 0) for partner in own), 2)
        disbursed = round(sum(per_partner.get(partner.id, {}).get("disbursed_amount", 0) for partner in own), 2)
        return {
            "id": str(row.id),
            "name": row.full_name,
            "seat": _seat(row),
            "calls": stats.get("calls", 0),
            "interested": stats.get("interested", 0),
            "handed": len(staff_handed.get(row.id, ())),
            "bank": stats.get("bank", 0),
            "partners": len(own),
            "disbursed_amount": disbursed,
            "company_revenue": company,
        }

    cards = _cards(view, totals, len(book))
    intros = {
        "company": "Every partner. Loan revenue is the lender payout left after the partner agreement. Plan sales stay separate.",
        "unit": "Callers, the backend person, and the DSA coordinators report to you. Each partner is mapped to a coordinator. Company revenue on a file sits under that coordinator.",
        "coordinator": "Partners mapped to you. Company revenue on their disbursed files is under your name.",
        "caller": "Calls you marked in this period. Interested and connected files go to the partner for documents.",
        "backend": "Files in this unit that the bank desk moved in this period.",
        "partner": "Your disbursed files. Your share is your agreement percent of the lender payout, after any subvention.",
    }
    return {
        "period": period,
        "label": label,
        "view": view,
        "intro": intros[view],
        "reports_to": names.get(user.reports_to_user_id) if user.reports_to_user_id else "",
        "team_count": len(reports),
        "partner_count": len(book) if view != "partner" else 0,
        "cards": cards,
        "team": [staff_row(row) for row in sorted(staff, key=lambda item: item.full_name.lower())],
        "partners": [money_row(row) for row in sorted(book, key=lambda item: item.full_name.lower())]
        if view in {"company", "unit", "coordinator", "partner"}
        else [],
    }


def _cards(view: str, totals: dict, partners: int) -> list[dict]:
    if view == "caller":
        return [
            {"label": "Calls", "value": totals["calls"]},
            {"label": "Interested", "value": totals["interested"]},
            {"label": "Not interested", "value": totals["not_interested"]},
            {"label": "Handed to partner", "value": totals["handed"]},
        ]
    if view == "backend":
        return [
            {"label": "Submitted", "value": totals["submitted"]},
            {"label": "Sanctioned", "value": totals["sanctioned"]},
            {"label": "Disbursed", "value": totals["disbursed_files"]},
            {"label": "Rejected", "value": totals["rejected"]},
        ]
    if view == "partner":
        return [
            {"label": "Disbursed", "value": totals["disbursed_amount"], "money": True},
            {"label": "Lender payout", "value": totals["lender_payout"], "money": True},
            {"label": "Your share", "value": totals["partner_share"], "money": True},
            {"label": "Paid to you", "value": totals["paid"], "money": True},
        ]
    return [
        {"label": "Disbursed", "value": totals["disbursed_amount"], "money": True},
        {"label": "Lender payout", "value": totals["lender_payout"], "money": True},
        {"label": "Partner payout", "value": totals["partner_share"], "money": True},
        {"label": "Company revenue", "value": totals["company_revenue"], "money": True},
        {"label": "Plan sales", "value": totals["plan_sales"], "money": True},
        {"label": "Partners", "value": partners},
    ]
