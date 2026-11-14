from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import DEFAULT_PIPELINE_STAGES, CustomerProfile, Lead, LeadPurchase, ProfileVisit, User
from app.schemas import LeadOut
from app.services.audit import write_audit
from app.services.leads import mask_phone, normalize_phone
from app.services.loan_cases import sync_case_for_purchase
from app.services.name_sync import sync_customer_name

router = APIRouter(prefix="/api", tags=["purchases"])


class PurchaseOut(BaseModel):
    id: UUID
    lead_id: UUID
    buyer_user_id: UUID
    price_paid: float
    pipeline_stage: str
    notes: list = Field(default_factory=list)
    next_followup_at: datetime | None = None
    converted: bool
    deal_value: float | None = None
    created_at: datetime
    updated_at: datetime
    assigned_caller_id: UUID | None = None
    caller_required: bool = False
    partner_name: str = ""
    lead: LeadOut | None = None

    model_config = {"from_attributes": True}


class PurchaseListOut(BaseModel):
    items: list[PurchaseOut]
    total: int
    stages: list[str]


class LeadUpdateIn(BaseModel):
    applicant_name: str | None = None
    full_phone: str | None = None
    email: str | None = None
    city: str | None = None
    state: str | None = None
    company_name: str | None = None
    employment_type: str | None = None
    loan_amount: float | None = None
    monthly_income: float | None = None
    product_subtype: str | None = None
    loan_type: str | None = None
    score: str | None = None
    product_details: dict[str, Any] | None = None


class PurchasePatch(BaseModel):
    pipeline_stage: str | None = None
    notes_text: str | None = None
    disposition: str | None = None
    next_followup_at: datetime | None = None
    clear_followup: bool | None = None
    converted: bool | None = None
    deal_value: float | None = None
    lead: LeadUpdateIn | None = None


# Call outcome → optional pipeline move. None keeps the current stage.
DISPOSITIONS: dict[str, tuple[str, str | None]] = {
    "connected": ("Connected", "contacted"),
    "not_reachable": ("Not reachable", None),
    "interested": ("Interested", "contacted"),
    "not_interested": ("Not interested", "rejected"),
    "callback": ("Callback scheduled", None),
    "wrong_number": ("Wrong number", "rejected"),
    "eligible": ("Eligible", None),
    "converted": ("Converted to case", "docs_collected"),
}

_STAGE_RANK = {
    "new": 0,
    "contacted": 1,
    "docs_collected": 2,
    "bank_submitted": 3,
    "sanctioned": 4,
    "disbursed": 5,
}


def _can_advance(current: str, target: str) -> bool:
    if target == "rejected":
        return current != "disbursed"
    if current not in _STAGE_RANK or target not in _STAGE_RANK:
        return False
    return _STAGE_RANK[target] > _STAGE_RANK[current]


class BuyOut(BaseModel):
    success: bool = True
    purchase_id: UUID
    full_phone: str
    pipeline_stage: str
    message: str = "Lead purchased"


PARTNER_ROLES = {"dsa", "affiliate"}
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


def partner_caller_owner(db: Session, user: User) -> User | None:
    """A caller seated under a partner works only that partner's leads."""
    if user.role != "caller" or not user.seat_owner_id:
        return None
    owner = db.query(User).filter(User.id == user.seat_owner_id, User.role.in_(PARTNER_ROLES)).first()
    return owner


def buyers_with_callers(db: Session, buyer_ids: set[UUID]) -> set[UUID]:
    if not buyer_ids:
        return set()
    rows = (
        db.query(User.seat_owner_id)
        .filter(User.role == "caller", User.is_active.is_(True), User.seat_owner_id.in_(buyer_ids))
        .all()
    )
    return {row[0] for row in rows if row[0]}


def caller_required(db: Session, purchase: LeadPurchase, covered: set[UUID] | None = None) -> bool:
    if purchase.assigned_caller_id:
        return True
    if covered is not None:
        return purchase.buyer_user_id in covered
    return (
        db.query(User.id)
        .filter(User.role == "caller", User.is_active.is_(True), User.seat_owner_id == purchase.buyer_user_id)
        .first()
        is not None
    )


def caller_may_see(db: Session, user: User, purchase: LeadPurchase) -> bool:
    owner = partner_caller_owner(db, user)
    if owner:
        return purchase.buyer_user_id == owner.id
    return purchase.assigned_caller_id == user.id


def _buyer_names(db: Session, rows: list[LeadPurchase]) -> dict[UUID, str]:
    ids = {row.buyer_user_id for row in rows if row.buyer_user_id}
    if not ids:
        return {}
    found = db.query(User).filter(User.id.in_(ids)).all()
    return {user.id: (user.full_name or user.email or "").strip() for user in found}


def _purchase_out(
    db: Session,
    p: LeadPurchase,
    covered: set[UUID] | None = None,
    names: dict[UUID, str] | None = None,
) -> PurchaseOut:
    lead = db.query(Lead).filter(Lead.id == p.lead_id).first()
    if names is None:
        names = _buyer_names(db, [p])
    return PurchaseOut(
        id=p.id,
        lead_id=p.lead_id,
        buyer_user_id=p.buyer_user_id,
        price_paid=p.price_paid,
        pipeline_stage=p.pipeline_stage,
        notes=p.notes or [],
        next_followup_at=p.next_followup_at,
        converted=p.converted,
        deal_value=p.deal_value,
        created_at=p.created_at,
        updated_at=p.updated_at,
        assigned_caller_id=p.assigned_caller_id,
        caller_required=caller_required(db, p, covered),
        partner_name=names.get(p.buyer_user_id, ""),
        lead=LeadOut.model_validate(lead) if lead else None,
    )


def _apply_lead_updates(lead: Lead, body: LeadUpdateIn) -> None:
    data = body.model_dump(exclude_unset=True)
    details_patch = data.pop("product_details", None)
    if "full_phone" in data and data["full_phone"]:
        phone = normalize_phone(str(data["full_phone"]))
        lead.full_phone = phone
        lead.masked_phone = mask_phone(phone)
        data.pop("full_phone", None)
    for key, value in data.items():
        if hasattr(lead, key):
            setattr(lead, key, value)
    if details_patch is not None:
        merged = dict(lead.product_details or {})
        merged.update(details_patch)
        lead.product_details = merged


@router.post("/leads/{lead_id}/purchase", response_model=BuyOut)
def purchase_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BuyOut:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    existing = (
        db.query(LeadPurchase)
        .filter(LeadPurchase.lead_id == lead_id, LeadPurchase.buyer_user_id == user.id)
        .first()
    )
    if existing:
        return BuyOut(
            purchase_id=existing.id,
            full_phone=lead.full_phone,
            pipeline_stage=existing.pipeline_stage,
            message="Already purchased",
        )

    reserved = str((lead.product_details or {}).get("reserved_for_user_id") or "")
    owner_ids = {str(user.id)}
    if user.seat_owner_id:
        owner_ids.add(str(user.seat_owner_id))
    if reserved and reserved not in owner_ids and user.role not in {"admin", "ceo", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This lead is reserved for another partner")

    if lead.status == "sold" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lead no longer available")

    price = float(lead.price or 0)
    # Debit account owner's wallet (seat members share the pool)
    owner = user
    if user.seat_owner_id and user.seat_owner_id != user.id:
        owner = db.query(User).filter(User.id == user.seat_owner_id).first() or user
    if user.role != "admin":
        bal = float(owner.wallet_balance or 0)
        if bal < price:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient wallet balance (₹{bal:.0f}). Activate/recharge a plan.",
            )
        owner.wallet_balance = bal - price

    purchase = LeadPurchase(
        lead_id=lead.id,
        buyer_user_id=user.id,
        price_paid=price,
        pipeline_stage="new",
        notes=[
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Lead purchased · ₹{price:.0f} from wallet",
                "by": user.email,
                "kind": "system",
            }
        ],
    )
    lead.status = "sold"
    lead.sale_available = False
    db.add(purchase)
    write_audit(
        db,
        action="lead_purchase",
        actor_user_id=user.id,
        entity_type="lead",
        entity_id=str(lead.id),
        detail={"price": price, "purchase_id": str(purchase.id), "buyer": user.email},
    )
    db.commit()
    db.refresh(purchase)
    return BuyOut(
        purchase_id=purchase.id,
        full_phone=lead.full_phone,
        pipeline_stage=purchase.pipeline_stage,
    )


class ReservedLeadOut(BaseModel):
    id: UUID
    applicant_name: str
    masked_phone: str
    city: str
    product_category: str
    price: float
    created_at: datetime


class ReservedListOut(BaseModel):
    items: list[ReservedLeadOut]
    total: int
    profile_visits: int


@router.get("/reserved-leads", response_model=ReservedListOut)
def reserved_leads(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ReservedListOut:
    """Profile leads waiting for this partner to pay. Phone stays masked until purchase."""
    owner_ids = {str(user.id)}
    if user.seat_owner_id:
        owner_ids.add(str(user.seat_owner_id))
    rows = (
        db.query(Lead)
        .filter(Lead.source == "expert_profile", Lead.status == "reserved")
        .order_by(Lead.created_at.desc())
        .limit(200)
        .all()
    )
    mine = [row for row in rows if str((row.product_details or {}).get("reserved_for_user_id") or "") in owner_ids]
    visit_ids = {user.id}
    if user.seat_owner_id:
        visit_ids.add(user.seat_owner_id)
    visits = (
        db.query(ProfileVisit).filter(ProfileVisit.partner_user_id.in_(visit_ids)).count()
    )
    return ReservedListOut(
        items=[
            ReservedLeadOut(
                id=row.id,
                applicant_name=row.applicant_name,
                masked_phone=row.masked_phone or mask_phone(row.full_phone),
                city=row.city,
                product_category=row.product_category,
                price=float(row.price or 0),
                created_at=row.created_at,
            )
            for row in mine[:100]
        ],
        total=len(mine),
        profile_visits=visits,
    )


BANK_STAGES = ("bank_submitted", "sanctioned", "disbursed", "rejected")
BANK_RESULTS = {"sanctioned", "disbursed", "rejected"}


def _bank_desk(user: User) -> bool:
    if user.role in {"admin", "ceo", "super_admin"}:
        return True
    return user.role == "coordinator" and (user.department or "") == "OPS" and not user.finance_level


@router.get("/bank-submissions", response_model=PurchaseListOut)
def bank_submissions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseListOut:
    query = db.query(LeadPurchase).filter(LeadPurchase.pipeline_stage.in_(BANK_STAGES))
    if _bank_desk(user):
        pass
    elif user.role == "coordinator":
        query = query.filter(LeadPurchase.buyer_user_id == user.id)
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bank desk only")
    rows = query.order_by(LeadPurchase.updated_at.desc()).limit(300).all()
    covered = buyers_with_callers(db, {row.buyer_user_id for row in rows})
    names = _buyer_names(db, rows)
    return PurchaseListOut(items=[_purchase_out(db, row, covered, names) for row in rows], total=len(rows), stages=list(BANK_STAGES))


@router.get("/my-leads", response_model=PurchaseListOut)
def my_leads(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseListOut:
    if user.role == "caller":
        owner = partner_caller_owner(db, user)
        q = db.query(LeadPurchase).filter(LeadPurchase.pipeline_stage.in_(("new", "contacted")))
        if owner:
            q = q.filter(LeadPurchase.buyer_user_id == owner.id)
        else:
            q = q.filter(LeadPurchase.assigned_caller_id == user.id)
    else:
        q = db.query(LeadPurchase).filter(LeadPurchase.buyer_user_id == user.id)
    rows = q.order_by(LeadPurchase.created_at.desc()).limit(300).all()
    covered = buyers_with_callers(db, {row.buyer_user_id for row in rows})
    names = _buyer_names(db, rows)
    items = [_purchase_out(db, p, covered, names) for p in rows]
    return PurchaseListOut(items=items, total=len(items), stages=DEFAULT_PIPELINE_STAGES)


@router.patch("/my-leads/{purchase_id}", response_model=PurchaseOut)
def patch_my_lead(
    purchase_id: UUID,
    body: PurchasePatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PurchaseOut:
    p = db.query(LeadPurchase).filter(LeadPurchase.id == purchase_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase not found")
    owner = p.buyer_user_id == user.id
    caller = user.role == "caller" and not owner and caller_may_see(db, user, p)
    if user.role == "caller" and not owner and not caller:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This lead is not on your call list")
    if caller and p.pipeline_stage not in {"new", "contacted"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This file has left the call desk")
    if caller and (body.lead is not None or body.deal_value is not None or body.converted is not None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Telecaller records the call only")
    if caller and body.pipeline_stage and body.pipeline_stage != "contacted":
        raise HTTPException(status_code=400, detail="Telecaller records the first call only")
    if caller and body.disposition:
        spec = DISPOSITIONS.get(body.disposition.strip().lower())
        if spec and spec[1] not in {None, "contacted", "rejected"}:
            raise HTTPException(status_code=400, detail="The partner collects the documents")
    if not owner and not _bank_desk(user) and not caller:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lead")
    if not owner and not caller and (body.disposition or body.lead is not None or body.deal_value is not None or body.converted is not None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bank desk can update the stage only")
    waits = owner and user.role in PARTNER_ROLES and caller_required(db, p)
    if waits and body.pipeline_stage == "contacted":
        raise HTTPException(status_code=400, detail="Your telecaller records the first call")
    if waits and body.pipeline_stage == "rejected" and p.pipeline_stage in {"new", "contacted"}:
        raise HTTPException(status_code=400, detail="Your telecaller records this call result")
    if waits and body.disposition:
        spec = DISPOSITIONS.get((body.disposition or "").strip().lower())
        if spec and spec[1] in {None, "contacted", "rejected"}:
            raise HTTPException(status_code=400, detail="Your telecaller records this call result")
    if owner and user.role in {"dsa", "affiliate"} and body.pipeline_stage == "docs_collected" and p.pipeline_stage != "contacted":
        raise HTTPException(status_code=400, detail="The telecaller marks the call before documents")
    if owner and user.role in {"dsa", "affiliate"} and body.pipeline_stage == "bank_submitted" and p.pipeline_stage != "docs_collected":
        raise HTTPException(status_code=400, detail="Collect the documents before the bank submission")
    if owner and user.role in {"dsa", "affiliate"} and body.pipeline_stage in {"sanctioned", "disbursed"}:
        raise HTTPException(status_code=400, detail="The bank desk records sanction and disbursement")
    if owner and user.role in {"dsa", "affiliate"} and body.pipeline_stage == "rejected" and p.pipeline_stage in {"bank_submitted", "sanctioned", "disbursed"}:
        raise HTTPException(status_code=400, detail="After the file reaches the bank, the bank desk records the rejection")
    if not owner and not caller and body.pipeline_stage and body.pipeline_stage not in BANK_RESULTS:
        raise HTTPException(status_code=400, detail="Bank desk records sanction, disbursement, or rejection")

    notes = list(p.notes or [])
    lead = db.query(Lead).filter(Lead.id == p.lead_id).first()
    stage_before = p.pipeline_stage

    if body.disposition:
        code = body.disposition.strip().lower()
        spec = DISPOSITIONS.get(code)
        if spec is None:
            raise HTTPException(status_code=400, detail="Invalid disposition")
        label, target = spec
        if code == "callback" and body.next_followup_at is None:
            raise HTTPException(status_code=400, detail="Callback needs a follow-up time")
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Disposition: {label}",
                "by": user.email,
                "kind": "disposition",
                "code": code,
            }
        )
        if target and _can_advance(p.pipeline_stage, target):
            old = p.pipeline_stage
            p.pipeline_stage = target
            notes.append(
                {
                    "at": datetime.now(timezone.utc).isoformat(),
                    "text": f"Stage: {old} → {target}",
                    "by": user.email,
                    "kind": "stage",
                }
            )
            if target == "rejected":
                p.converted = False

    if body.pipeline_stage is not None:
        if body.pipeline_stage not in DEFAULT_PIPELINE_STAGES:
            raise HTTPException(status_code=400, detail="Invalid pipeline stage")
        old = p.pipeline_stage
        p.pipeline_stage = body.pipeline_stage
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": f"Stage: {old} → {body.pipeline_stage}",
                "by": user.email,
                "kind": "stage",
            }
        )
        if body.pipeline_stage == "disbursed":
            p.converted = True
            p.next_followup_at = None
            if p.deal_value is None and lead is not None:
                p.deal_value = float(lead.loan_amount or 0)
        if body.pipeline_stage == "rejected":
            p.converted = False
            p.next_followup_at = None

    if body.converted is not None:
        p.converted = body.converted
    if body.deal_value is not None:
        p.deal_value = body.deal_value
    if body.clear_followup:
        p.next_followup_at = None
    elif body.next_followup_at is not None:
        p.next_followup_at = body.next_followup_at
    if body.notes_text:
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": body.notes_text,
                "by": user.email,
                "kind": "note",
            }
        )

    if body.lead is not None and lead is not None:
        old_name = lead.applicant_name
        _apply_lead_updates(lead, body.lead)
        if lead.applicant_name and lead.applicant_name != old_name:
            profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == p.id).first()
            sync_customer_name(db, p, lead.applicant_name, [old_name, profile.full_name if profile else None])
        notes.append(
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "text": "Lead details updated",
                "by": user.email,
                "kind": "edit",
            }
        )

    p.notes = notes
    db.commit()
    db.refresh(p)
    try:
        sync_case_for_purchase(db, p, None, reopened=stage_before == "rejected" and p.pipeline_stage != "rejected")
    except Exception:
        db.rollback()
    return _purchase_out(db, p)


class AssignCallerIn(BaseModel):
    caller_user_id: UUID | None = None


def _team_leader(user: User) -> bool:
    return user.role == "coordinator" and user.department == "SALES" and user.sales_grade == "T7" and not user.finance_level


def _company_callers(db: Session, leader_id: UUID | None = None) -> list[User]:
    callers = db.query(User).filter(User.role == "caller", User.is_active.is_(True)).order_by(User.full_name.asc()).all()
    rows = [row for row in callers if partner_caller_owner(db, row) is None]
    if leader_id is not None:
        rows = [row for row in rows if row.reports_to_user_id == leader_id]
    return rows


def _queue_actor(user: User) -> None:
    if user.role not in ADMIN_ROLES and not _team_leader(user):
        raise HTTPException(status_code=403, detail="The team leader gives these leads")


@router.get("/call-queue")
def call_queue(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    _queue_actor(user)
    leader_id = user.id if _team_leader(user) else None
    rows = (
        db.query(LeadPurchase)
        .filter(LeadPurchase.pipeline_stage.in_(("new", "contacted")))
        .order_by(LeadPurchase.created_at.desc())
        .limit(300)
        .all()
    )
    buyers = {row.id: row for row in db.query(User).filter(User.id.in_({item.buyer_user_id for item in rows})).all()} if rows else {}
    leads = {row.id: row for row in db.query(Lead).filter(Lead.id.in_({item.lead_id for item in rows})).all()} if rows else {}
    callers = _company_callers(db, leader_id)
    names = {row.id: row.full_name for row in callers}
    missing = {row.assigned_caller_id for row in rows if row.assigned_caller_id and row.assigned_caller_id not in names}
    if missing:
        for person in db.query(User).filter(User.id.in_(missing)).all():
            names[person.id] = person.full_name
    covered = buyers_with_callers(db, {item.buyer_user_id for item in rows})
    items = []
    for row in rows:
        buyer = buyers.get(row.buyer_user_id)
        lead = leads.get(row.lead_id)
        items.append(
            {
                "id": str(row.id),
                "partner": buyer.full_name if buyer else "—",
                "applicant": lead.applicant_name if lead else "—",
                "city": lead.city if lead else "",
                "product": lead.loan_type if lead else "",
                "stage": row.pipeline_stage,
                "partner_has_caller": row.buyer_user_id in covered,
                "assigned_caller_id": str(row.assigned_caller_id) if row.assigned_caller_id else "",
                "assigned_caller": names.get(row.assigned_caller_id, "") if row.assigned_caller_id else "",
            }
        )
    return {"items": items, "callers": [{"id": str(row.id), "name": row.full_name} for row in callers]}


@router.post("/call-queue/{purchase_id}")
def assign_caller(
    purchase_id: UUID,
    body: AssignCallerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _queue_actor(user)
    purchase = db.query(LeadPurchase).filter(LeadPurchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Lead not found")
    if body.caller_user_id is None:
        if _team_leader(user) and purchase.assigned_caller_id:
            current = db.query(User).filter(User.id == purchase.assigned_caller_id).first()
            if current and current.reports_to_user_id != user.id:
                raise HTTPException(status_code=400, detail="This lead is on another team")
        purchase.assigned_caller_id = None
        db.commit()
        return {"ok": True, "assigned_caller_id": ""}
    caller = db.query(User).filter(User.id == body.caller_user_id, User.role == "caller", User.is_active.is_(True)).first()
    if not caller or partner_caller_owner(db, caller):
        raise HTTPException(status_code=400, detail="Choose a company telecaller")
    if _team_leader(user) and caller.reports_to_user_id != user.id:
        raise HTTPException(status_code=400, detail="This telecaller is not on your team")
    if purchase.buyer_user_id in buyers_with_callers(db, {purchase.buyer_user_id}):
        raise HTTPException(status_code=400, detail="This partner's own telecaller handles their leads")
    purchase.assigned_caller_id = caller.id
    db.commit()
    return {"ok": True, "assigned_caller_id": str(caller.id)}


def _last_disposition(notes: list) -> dict:
    for note in reversed(notes or []):
        if note.get("kind") == "disposition":
            return note
    return {}


@router.get("/call-floor")
def call_floor(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """What each company telecaller was given, and the result they saved on each number."""
    _queue_actor(user)
    leader_id = user.id if _team_leader(user) else None
    callers = _company_callers(db, leader_id)
    ids = [row.id for row in callers]
    purchases = (
        db.query(LeadPurchase).filter(LeadPurchase.assigned_caller_id.in_(ids)).order_by(LeadPurchase.updated_at.desc()).all()
        if ids
        else []
    )
    buyers = {row.id: row.full_name for row in db.query(User).filter(User.id.in_({item.buyer_user_id for item in purchases})).all()} if purchases else {}
    leads = {row.id: row for row in db.query(Lead).filter(Lead.id.in_({item.lead_id for item in purchases})).all()} if purchases else {}
    buckets = ("connected", "interested", "callback", "not_reachable", "not_interested", "wrong_number")
    grouped: dict = {row.id: [] for row in callers}
    for purchase in purchases:
        grouped.setdefault(purchase.assigned_caller_id, []).append(purchase)
    items = []
    for caller in callers:
        rows = grouped.get(caller.id, [])
        counts = {code: 0 for code in buckets}
        not_called = 0
        lead_rows = []
        for purchase in rows:
            note = _last_disposition(purchase.notes or [])
            code = str(note.get("code") or "")
            if code in counts:
                counts[code] += 1
            elif code in {"eligible"}:
                counts["connected"] += 1
            else:
                not_called += 1
            lead = leads.get(purchase.lead_id)
            lead_rows.append(
                {
                    "id": str(purchase.id),
                    "applicant": lead.applicant_name if lead else "—",
                    "city": lead.city if lead else "",
                    "phone": lead.full_phone if lead else "",
                    "partner": buyers.get(purchase.buyer_user_id, "—"),
                    "result": str(note.get("text") or "Not called"),
                    "at": str(note.get("at") or ""),
                }
            )
        items.append(
            {
                "id": str(caller.id),
                "name": caller.full_name,
                "email": caller.email,
                "given": len(rows),
                "not_called": not_called,
                **counts,
                "leads": lead_rows[:100],
            }
        )
    return {"items": items}
