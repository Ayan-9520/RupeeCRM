"""LOS pipeline, lender cases, tasks, and explicit sanction records."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.customer_activity import _day, _mobile, _money, _roi, _tenure, _text
from app.api.customer_workspace import STAFF_ROLES, _require_purchase
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import (
    CustomerDocument,
    CustomerFollowup,
    CustomerLenderCase,
    CustomerLosPipeline,
    CustomerPipelineHistory,
    CustomerProfile,
    CustomerSanctionDisbursal,
    CustomerTask,
    LeadPurchase,
    User,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/api", tags=["customer-los"])

ROW_LIMIT = 40
STAGES = {
    "lead_purchased",
    "calling_started",
    "docs_pending",
    "docs_received",
    "eligibility_check",
    "bank_login",
    "underwriting",
    "approved",
    "sanctioned",
    "disbursed",
    "rejected",
    "hold",
    "closed",
}
LOGIN_STATUSES = {"draft", "logged_in", "under_review", "approved", "rejected", "sanctioned", "disbursed", "closed"}
PAYOUT_STATUSES = {"pending", "partial", "received"}
TASK_STATUSES = {"pending", "in_progress", "completed", "hold"}
TASK_TYPES = {
    "collect_docs",
    "call_customer",
    "bank_login",
    "eligibility_check",
    "verify_profile",
    "send_sanction",
    "disbursal_followup",
    "general",
    "automation",
    "disbursal",
    "payout",
    "followup",
}
PRIORITIES = {"low", "medium", "high", "urgent"}
CLOSED = {"closed", "rejected", "disbursed"}
APPROVED = {"approved", "sanctioned", "disbursed"}


class StageIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    to_stage: str


class PipelinePatch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_owner_id: str | None = None
    assigned_rm_id: str | None = None
    assigned_dsa_id: str | None = None
    banker_name: str | None = None
    banker_mobile: str | None = None
    banker_email: str | None = None
    priority: str | None = None
    sla_target_date: str | None = None
    reminder_at: str | None = None


class LenderIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lender_name: str | None = None
    branch: str | None = None
    banker_name: str | None = None
    banker_mobile: str | None = None
    banker_email: str | None = None
    login_date: str | None = None
    login_status: str | None = None
    sanctioned_amount: float | None = None
    roi: float | None = None
    tenure: float | None = None
    processing_fee: float | None = None
    insurance_amount: float | None = None
    disbursed_amount: float | None = None
    payout_expected: float | None = None
    payout_received: float | None = None
    payout_status: str | None = None
    rejection_reason: str | None = None
    remarks: str | None = None
    sort_order: int | None = None


class TaskIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str | None = None
    description: str | None = None
    task_type: str | None = None
    status: str | None = None
    due_at: str | None = None
    assigned_user_id: str | None = None
    comments: list | None = None


class SanctionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lender_case_id: str | None = None
    sanction_amount: float | None = None
    final_roi: float | None = None
    final_tenure: float | None = None
    emi: float | None = None
    processing_fee: float | None = None
    insurance_deduction: float | None = None
    net_disbursal: float | None = None
    disbursal_date: str | None = None
    utr_number: str | None = None
    bank_account_credited: str | None = None
    payout_expected: float | None = None
    payout_received: float | None = None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _email(value: str | None) -> str | None:
    text = _text(value, 255)
    if text is None:
        return None
    if "@" not in text or text.startswith("@") or text.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    return text.lower()


def _when(value: str | None) -> datetime | None:
    text = _text(value, 40)
    if text is None:
        return None
    if len(text) == 10:
        return datetime.fromisoformat(_day(text)).replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Enter a valid date")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _self(value: str | None, user: User) -> UUID | None:
    if value is None or not str(value).strip():
        return None
    if str(value) != str(user.id) and user.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="You can only assign this case to yourself")
    if str(value) != str(user.id):
        raise HTTPException(status_code=400, detail="You can only assign this case to yourself")
    return user.id


def _profile(db: Session, purchase: LeadPurchase) -> CustomerProfile:
    profile = db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Open the customer workspace before using the LOS pipeline")
    return profile


def _pipeline_out(row: CustomerLosPipeline) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "dsa_id": str(row.dsa_id),
        "current_stage": row.current_stage,
        "case_owner_id": str(row.case_owner_id) if row.case_owner_id else None,
        "assigned_rm_id": str(row.assigned_rm_id) if row.assigned_rm_id else None,
        "assigned_dsa_id": str(row.assigned_dsa_id) if row.assigned_dsa_id else None,
        "banker_name": row.banker_name,
        "banker_mobile": row.banker_mobile,
        "banker_email": row.banker_email,
        "priority": row.priority,
        "sla_target_date": row.sla_target_date,
        "reminder_at": _iso(row.reminder_at),
        "last_stage_changed_at": _iso(row.last_stage_changed_at),
        "last_stage_changed_by": str(row.last_stage_changed_by) if row.last_stage_changed_by else None,
    }


def _history_out(row: CustomerPipelineHistory) -> dict:
    return {
        "id": str(row.id),
        "from_stage": row.from_stage,
        "to_stage": row.to_stage,
        "changed_by": str(row.changed_by) if row.changed_by else None,
        "notes": row.notes,
        "created_at": _iso(row.created_at),
    }


def _lender_out(row: CustomerLenderCase) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "dsa_id": str(row.dsa_id),
        "lender_name": row.lender_name,
        "branch": row.branch,
        "banker_name": row.banker_name,
        "banker_mobile": row.banker_mobile,
        "banker_email": row.banker_email,
        "login_date": row.login_date,
        "login_status": row.login_status,
        "sanctioned_amount": row.sanctioned_amount,
        "roi": row.roi,
        "tenure": row.tenure,
        "processing_fee": row.processing_fee,
        "insurance_amount": row.insurance_amount,
        "disbursed_amount": row.disbursed_amount,
        "payout_expected": row.payout_expected,
        "payout_received": row.payout_received,
        "payout_status": row.payout_status,
        "rejection_reason": row.rejection_reason,
        "remarks": row.remarks,
        "is_best_offer": row.is_best_offer,
        "sort_order": row.sort_order,
        "created_by": str(row.created_by) if row.created_by else None,
    }


def _task_out(row: CustomerTask) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "dsa_id": str(row.dsa_id),
        "title": row.title,
        "description": row.description,
        "task_type": row.task_type,
        "status": row.status,
        "due_at": _iso(row.due_at),
        "assigned_user_id": str(row.assigned_user_id) if row.assigned_user_id else None,
        "comments": row.comments or [],
        "completed_at": _iso(row.completed_at),
    }


def _sanction_out(row: CustomerSanctionDisbursal) -> dict:
    return {
        "id": str(row.id),
        "customer_profile_id": str(row.customer_profile_id),
        "lead_purchase_id": str(row.lead_purchase_id),
        "lender_case_id": str(row.lender_case_id) if row.lender_case_id else None,
        "dsa_id": str(row.dsa_id),
        "sanction_amount": row.sanction_amount,
        "final_roi": row.final_roi,
        "final_tenure": row.final_tenure,
        "emi": row.emi,
        "processing_fee": row.processing_fee,
        "insurance_deduction": row.insurance_deduction,
        "net_disbursal": row.net_disbursal,
        "disbursal_date": row.disbursal_date,
        "utr_number": row.utr_number,
        "bank_account_credited": row.bank_account_credited,
        "payout_expected": row.payout_expected,
        "payout_received": row.payout_received,
    }


def _record_stage(db: Session, purchase: LeadPurchase, user: User, row: CustomerLosPipeline, to_stage: str, notes: str | None) -> None:
    previous = row.current_stage
    row.current_stage = to_stage
    row.last_stage_changed_at = datetime.now(timezone.utc)
    row.last_stage_changed_by = user.id
    db.add(
        CustomerPipelineHistory(
            lead_purchase_id=purchase.id,
            from_stage=previous if notes != "Pipeline initialized" else None,
            to_stage=to_stage,
            changed_by=user.id,
            notes=notes,
        )
    )
    write_audit(
        db,
        action="los_stage",
        actor_user_id=user.id,
        entity_type="los_pipeline",
        entity_id=str(purchase.id),
        detail={"from": None if notes == "Pipeline initialized" else previous, "to": to_stage},
    )


def _ensure(db: Session, purchase: LeadPurchase, user: User) -> CustomerLosPipeline:
    row = db.query(CustomerLosPipeline).filter(CustomerLosPipeline.lead_purchase_id == purchase.id).first()
    if row:
        return row
    profile = _profile(db, purchase)
    row = CustomerLosPipeline(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        current_stage="lead_purchased",
        priority="medium",
        last_stage_changed_by=user.id,
    )
    db.add(row)
    db.add(
        CustomerPipelineHistory(
            lead_purchase_id=purchase.id,
            from_stage=None,
            to_stage="lead_purchased",
            changed_by=user.id,
            notes="Pipeline initialized",
        )
    )
    write_audit(
        db,
        action="los_stage",
        actor_user_id=user.id,
        entity_type="los_pipeline",
        entity_id=str(purchase.id),
        detail={"from": None, "to": "lead_purchased"},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        row = db.query(CustomerLosPipeline).filter(CustomerLosPipeline.lead_purchase_id == purchase.id).first()
        if not row:
            raise
        return row
    db.refresh(row)
    return row


@router.get("/my-leads/{purchase_id}/los-pipeline")
def get_pipeline(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    return _pipeline_out(_ensure(db, purchase, user))


@router.get("/my-leads/{purchase_id}/pipeline-history")
def pipeline_history(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerPipelineHistory)
        .filter(CustomerPipelineHistory.lead_purchase_id == purchase.id)
        .order_by(CustomerPipelineHistory.created_at.desc())
        .all()
    )
    return {"rows": [_history_out(row) for row in rows]}


@router.post("/customer-los-pipelines/{pipeline_id}/stage")
def change_stage(
    pipeline_id: UUID,
    body: StageIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = db.query(CustomerLosPipeline).filter(CustomerLosPipeline.id == pipeline_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    purchase = _require_purchase(db, user, row.lead_purchase_id)
    stage = (body.to_stage or "").strip()
    if stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid pipeline stage")
    if stage == row.current_stage:
        return _pipeline_out(row)
    _record_stage(db, purchase, user, row, stage, None)
    db.commit()
    db.refresh(row)
    return _pipeline_out(row)


@router.patch("/customer-los-pipelines/{pipeline_id}")
def update_pipeline(
    pipeline_id: UUID,
    body: PipelinePatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = db.query(CustomerLosPipeline).filter(CustomerLosPipeline.id == pipeline_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    _require_purchase(db, user, row.lead_purchase_id)
    present = set(body.model_fields_set)
    if "case_owner_id" in present:
        row.case_owner_id = _self(body.case_owner_id, user)
    if "assigned_rm_id" in present:
        row.assigned_rm_id = _self(body.assigned_rm_id, user)
    if "assigned_dsa_id" in present:
        row.assigned_dsa_id = _self(body.assigned_dsa_id, user)
    if "banker_name" in present:
        row.banker_name = _text(body.banker_name, 120)
    if "banker_mobile" in present:
        row.banker_mobile = _mobile(body.banker_mobile)
    if "banker_email" in present:
        row.banker_email = _email(body.banker_email)
    if "priority" in present:
        priority = (body.priority or "medium").strip().lower()
        if priority not in PRIORITIES:
            raise HTTPException(status_code=400, detail="Invalid priority")
        row.priority = priority
    if "sla_target_date" in present:
        row.sla_target_date = _day(body.sla_target_date)
    if "reminder_at" in present:
        row.reminder_at = _when(body.reminder_at)
    db.commit()
    db.refresh(row)
    return _pipeline_out(row)


def _apply_lender(row: CustomerLenderCase, body: LenderIn, present: set[str]) -> None:
    if "lender_name" in present:
        row.lender_name = _text(body.lender_name, 120)
    if "branch" in present:
        row.branch = _text(body.branch, 120)
    if "banker_name" in present:
        row.banker_name = _text(body.banker_name, 120)
    if "banker_mobile" in present:
        row.banker_mobile = _mobile(body.banker_mobile)
    if "banker_email" in present:
        row.banker_email = _email(body.banker_email)
    if "login_date" in present:
        row.login_date = _day(body.login_date)
    if "login_status" in present:
        status_value = (body.login_status or "draft").strip().lower()
        if status_value not in LOGIN_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid login status")
        row.login_status = status_value
    for name in (
        "sanctioned_amount",
        "processing_fee",
        "insurance_amount",
        "disbursed_amount",
        "payout_expected",
        "payout_received",
    ):
        if name in present:
            setattr(row, name, _money(getattr(body, name)))
    if "roi" in present:
        row.roi = _roi(body.roi)
    if "tenure" in present:
        row.tenure = _tenure(body.tenure)
    if "payout_status" in present:
        payout = _text(body.payout_status, 20)
        if payout is not None and payout not in PAYOUT_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid payout status")
        row.payout_status = payout
    if "rejection_reason" in present:
        row.rejection_reason = _text(body.rejection_reason, 2000)
    if "remarks" in present:
        row.remarks = _text(body.remarks, 2000)
    if "sort_order" in present and body.sort_order is not None:
        order = int(body.sort_order)
        if order < 0 or order > 500:
            raise HTTPException(status_code=400, detail="Sort order is out of range")
        row.sort_order = order


@router.get("/my-leads/{purchase_id}/lender-cases")
def list_lenders(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerLenderCase)
        .filter(CustomerLenderCase.lead_purchase_id == purchase.id)
        .order_by(CustomerLenderCase.sort_order, CustomerLenderCase.created_at)
        .all()
    )
    return {"rows": [_lender_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/lender-cases")
def create_lender(
    purchase_id: UUID,
    body: LenderIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerLenderCase).filter(CustomerLenderCase.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Lender case limit reached")
    row = CustomerLenderCase(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        login_status="draft",
        payout_status="pending",
        sort_order=count,
        created_by=user.id,
    )
    _apply_lender(row, body, set(body.model_fields_set))
    db.add(row)
    write_audit(
        db,
        action="lender_case_created",
        actor_user_id=user.id,
        entity_type="lender_case",
        entity_id=str(purchase.id),
        detail={"status": row.login_status},
    )
    db.commit()
    db.refresh(row)
    return _lender_out(row)


def _owned_lender(db: Session, user: User, row_id: UUID) -> CustomerLenderCase:
    row = db.query(CustomerLenderCase).filter(CustomerLenderCase.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Lender case not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


@router.patch("/customer-lender-cases/{case_id}")
def update_lender(
    case_id: UUID,
    body: LenderIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_lender(db, user, case_id)
    previous = row.login_status
    _apply_lender(row, body, set(body.model_fields_set))
    if row.login_status != previous:
        write_audit(
            db,
            action="lender_status",
            actor_user_id=user.id,
            entity_type="lender_case",
            entity_id=str(row.lead_purchase_id),
            detail={"from": previous, "to": row.login_status},
        )
    db.commit()
    db.refresh(row)
    return _lender_out(row)


@router.post("/customer-lender-cases/{case_id}/best-offer")
def best_offer(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_lender(db, user, case_id)
    (
        db.query(CustomerLenderCase)
        .filter(CustomerLenderCase.lead_purchase_id == row.lead_purchase_id)
        .update({CustomerLenderCase.is_best_offer: False}, synchronize_session=False)
    )
    row.is_best_offer = True
    db.commit()
    db.refresh(row)
    return _lender_out(row)


@router.delete("/customer-lender-cases/{case_id}")
def delete_lender(case_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_lender(db, user, case_id)
    (
        db.query(CustomerSanctionDisbursal)
        .filter(CustomerSanctionDisbursal.lender_case_id == row.id)
        .update({CustomerSanctionDisbursal.lender_case_id: None}, synchronize_session=False)
    )
    db.delete(row)
    db.commit()
    return {"ok": True}


def _comments(value: list | None) -> list:
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > 20:
        raise HTTPException(status_code=400, detail="Comments are invalid")
    cleaned = []
    for item in value:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Comments are invalid")
        text = _text(str(item.get("text") or ""), 1000)
        if not text:
            continue
        cleaned.append({"at": datetime.now(timezone.utc).isoformat(), "text": text})
    return cleaned


@router.get("/my-leads/{purchase_id}/tasks")
def list_tasks(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    rows = (
        db.query(CustomerTask)
        .filter(CustomerTask.lead_purchase_id == purchase.id)
        .order_by(CustomerTask.created_at.desc())
        .all()
    )
    return {"rows": [_task_out(row) for row in rows]}


@router.post("/my-leads/{purchase_id}/tasks")
def create_task(
    purchase_id: UUID,
    body: TaskIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    count = db.query(CustomerTask).filter(CustomerTask.lead_purchase_id == purchase.id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail="Task limit reached")
    title = _text(body.title, 200)
    if not title:
        raise HTTPException(status_code=400, detail="Task title is required")
    task_type = (body.task_type or "general").strip().lower()
    if task_type not in TASK_TYPES:
        raise HTTPException(status_code=400, detail="Invalid task type")
    status_value = (body.status or "pending").strip().lower()
    if status_value not in TASK_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid task status")
    row = CustomerTask(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        lead_id=profile.lead_id,
        dsa_id=purchase.buyer_user_id,
        title=title,
        description=_text(body.description, 2000),
        task_type=task_type,
        status=status_value,
        due_at=_when(body.due_at),
        assigned_user_id=user.id if body.assigned_user_id else None,
        comments=_comments(body.comments),
        completed_at=datetime.now(timezone.utc) if status_value == "completed" else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _task_out(row)


def _owned_task(db: Session, user: User, row_id: UUID) -> CustomerTask:
    row = db.query(CustomerTask).filter(CustomerTask.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


@router.patch("/customer-tasks/{task_id}")
def update_task(
    task_id: UUID,
    body: TaskIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_task(db, user, task_id)
    present = set(body.model_fields_set)
    if "title" in present:
        title = _text(body.title, 200)
        if not title:
            raise HTTPException(status_code=400, detail="Task title is required")
        row.title = title
    if "description" in present:
        row.description = _text(body.description, 2000)
    if "task_type" in present:
        task_type = (body.task_type or "general").strip().lower()
        if task_type not in TASK_TYPES:
            raise HTTPException(status_code=400, detail="Invalid task type")
        row.task_type = task_type
    if "status" in present:
        status_value = (body.status or "").strip().lower()
        if status_value not in TASK_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid task status")
        row.status = status_value
        row.completed_at = datetime.now(timezone.utc) if status_value == "completed" else None
    if "due_at" in present:
        row.due_at = _when(body.due_at)
    if "assigned_user_id" in present:
        row.assigned_user_id = _self(body.assigned_user_id, user)
    if "comments" in present:
        row.comments = _comments(body.comments)
    db.commit()
    db.refresh(row)
    return _task_out(row)


@router.delete("/customer-tasks/{task_id}")
def delete_task(task_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    row = _owned_task(db, user, task_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


def _apply_sanction(row: CustomerSanctionDisbursal, body: SanctionIn, present: set[str], db: Session) -> None:
    if "lender_case_id" in present:
        if not body.lender_case_id:
            row.lender_case_id = None
        else:
            try:
                lender_id = UUID(str(body.lender_case_id))
            except ValueError:
                raise HTTPException(status_code=400, detail="Lender case is invalid")
            lender = (
                db.query(CustomerLenderCase)
                .filter(CustomerLenderCase.id == lender_id, CustomerLenderCase.lead_purchase_id == row.lead_purchase_id)
                .first()
            )
            if not lender:
                raise HTTPException(status_code=400, detail="Lender case is invalid")
            row.lender_case_id = lender.id
    for name in ("sanction_amount", "emi", "processing_fee", "insurance_deduction", "net_disbursal", "payout_expected", "payout_received"):
        if name in present:
            setattr(row, name, _money(getattr(body, name)))
    if "final_roi" in present:
        row.final_roi = _roi(body.final_roi)
    if "final_tenure" in present:
        row.final_tenure = _tenure(body.final_tenure)
    if "disbursal_date" in present:
        row.disbursal_date = _day(body.disbursal_date)
    if "utr_number" in present:
        row.utr_number = _text(body.utr_number, 80)
    if "bank_account_credited" in present:
        row.bank_account_credited = _text(body.bank_account_credited, 40)


@router.get("/my-leads/{purchase_id}/sanction")
def get_sanction(purchase_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    row = db.query(CustomerSanctionDisbursal).filter(CustomerSanctionDisbursal.lead_purchase_id == purchase.id).first()
    return {"rows": [_sanction_out(row)] if row else []}


@router.put("/my-leads/{purchase_id}/sanction")
def save_sanction(
    purchase_id: UUID,
    body: SanctionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile(db, purchase)
    row = db.query(CustomerSanctionDisbursal).filter(CustomerSanctionDisbursal.lead_purchase_id == purchase.id).first()
    created = row is None
    if row is None:
        row = CustomerSanctionDisbursal(
            customer_profile_id=profile.id,
            lead_purchase_id=purchase.id,
            lead_id=profile.lead_id,
            dsa_id=purchase.buyer_user_id,
        )
        db.add(row)
        db.flush()
    _apply_sanction(row, body, set(body.model_fields_set), db)
    write_audit(
        db,
        action="sanction_saved",
        actor_user_id=user.id,
        entity_type="sanction",
        entity_id=str(purchase.id),
        detail={"created": created},
    )
    db.commit()
    db.refresh(row)
    return _sanction_out(row)


@router.get("/los/summary")
def los_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    purchase_ids = [
        row.id for row in db.query(LeadPurchase.id).filter(LeadPurchase.buyer_user_id == user.id).all()
    ]
    today = datetime.now(timezone.utc).date().isoformat()
    stages = []
    if purchase_ids:
        stages = [
            row.current_stage
            for row in db.query(CustomerLosPipeline.current_stage).filter(CustomerLosPipeline.lead_purchase_id.in_(purchase_ids)).all()
        ]
    lenders = []
    if purchase_ids:
        lenders = db.query(CustomerLenderCase).filter(CustomerLenderCase.lead_purchase_id.in_(purchase_ids)).all()
    pending_docs = 0
    due_followups = 0
    if purchase_ids:
        pending_docs = (
            db.query(CustomerDocument)
            .filter(
                CustomerDocument.lead_purchase_id.in_(purchase_ids),
                CustomerDocument.status.in_(["pending", "requested"]),
            )
            .count()
        )
        due_followups = (
            db.query(CustomerFollowup)
            .filter(
                CustomerFollowup.lead_purchase_id.in_(purchase_ids),
                CustomerFollowup.completed.is_(False),
                CustomerFollowup.followup_date.isnot(None),
                CustomerFollowup.followup_date <= today,
            )
            .count()
        )
    return {
        "activeCases": sum(1 for stage in stages if stage not in CLOSED),
        "approvedCases": sum(1 for stage in stages if stage in APPROVED),
        "disbursedAmount": sum(row.disbursed_amount or 0 for row in lenders),
        "pendingDocs": pending_docs,
        "followupsDueToday": due_followups,
        "payoutPending": sum(1 for row in lenders if row.payout_status == "pending" and (row.payout_expected or 0) > 0),
        "rejectionCount": sum(1 for stage in stages if stage == "rejected"),
    }
