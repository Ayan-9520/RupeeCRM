"""Customer workspace load and save. Ownership comes from the purchase, never the client."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.services.name_sync import sync_customer_name
from app.models import (
    CustomerBankAccount,
    CustomerCoApplicant,
    CustomerLoanRequirement,
    CustomerObligation,
    CustomerProfile,
    Lead,
    LeadPurchase,
    User,
)

router = APIRouter(prefix="/api", tags=["customer-workspace"])

STAFF_ROLES = {"admin", "ceo", "super_admin"}
ROW_LIMIT = 40
PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GST_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")

PROFILE_TEXT = {
    "full_name": 200,
    "gender": 40,
    "marital_status": 40,
    "father_name": 200,
    "mother_name": 200,
    "education": 80,
    "residence_type": 80,
    "current_address": 1000,
    "permanent_address": 1000,
    "city": 120,
    "state": 120,
    "employment_type": 80,
    "company_name": 200,
    "business_name": 200,
    "designation": 120,
    "industry_type": 120,
    "work_experience": 80,
    "business_vintage": 80,
    "salary_mode": 40,
    "itr_filed": 20,
    "office_address": 1000,
    "workspace_id": 80,
    "dob": 20,
}
PROFILE_MONEY = ("monthly_income", "net_salary", "annual_turnover")
LOCKED = {"id", "lead_purchase_id", "lead_id", "dsa_id", "created_at", "updated_at"}


class ProfileIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    workspace_id: str | None = None
    full_name: str | None = None
    mobile: str | None = None
    alternate_mobile: str | None = None
    email: str | None = None
    dob: str | None = None
    gender: str | None = None
    marital_status: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    pan: str | None = None
    aadhaar: str | None = None
    education: str | None = None
    residence_type: str | None = None
    current_address: str | None = None
    permanent_address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    family_members: int | None = None
    employment_type: str | None = None
    company_name: str | None = None
    business_name: str | None = None
    designation: str | None = None
    industry_type: str | None = None
    monthly_income: float | None = None
    net_salary: float | None = None
    annual_turnover: float | None = None
    work_experience: str | None = None
    business_vintage: str | None = None
    salary_mode: str | None = None
    gst_number: str | None = None
    itr_filed: str | None = None
    office_address: str | None = None
    profile_completion: int | None = None


class BankIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_purchase_id: UUID | None = None
    bank_name: str | None = None
    account_type: str | None = None
    account_vintage: str | None = None
    average_balance: float | None = None
    is_salary_account: bool | None = None
    emi_bounce_history: str | None = None
    statement_available: bool | None = None
    is_primary: bool | None = None
    sort_order: int | None = None


class ObligationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_purchase_id: UUID | None = None
    loan_type: str | None = None
    bank_name: str | None = None
    emi: float | None = None
    outstanding_amount: float | None = None
    sanction_amount: float | None = None
    remaining_tenure: int | None = None
    start_date: str | None = None
    overdue_status: str | None = None
    sort_order: int | None = None


class CoApplicantIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_purchase_id: UUID | None = None
    relation: str | None = None
    full_name: str | None = None
    mobile: str | None = None
    pan: str | None = None
    aadhaar: str | None = None
    employment_type: str | None = None
    income: float | None = None
    obligations_summary: str | None = None
    cibil_score: int | None = None
    sort_order: int | None = None


class LoanIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    lead_purchase_id: UUID | None = None
    product_type: str | None = None
    loan_amount: float | None = None
    tenure_months: int | None = None
    purpose: str | None = None
    property_value: float | None = None
    has_existing_loan: bool | None = None
    balance_transfer: bool | None = None
    top_up_required: bool | None = None
    insurance_type: str | None = None
    roi_percent: float | None = None
    extra_fields: dict[str, Any] | None = None
    sort_order: int | None = None


def _blank(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if len(text) > limit:
        raise HTTPException(status_code=400, detail=f"Value is longer than {limit} characters")
    return text


def _digits(value: str | None, length: int, label: str) -> str | None:
    text = _blank(value, 32)
    if text is None:
        return None
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) != length:
        raise HTTPException(status_code=400, detail=f"{label} must be {length} digits")
    return digits


def _money(value: float | None) -> float | None:
    if value is None:
        return None
    amount = float(value)
    if amount < 0 or amount > 1_000_000_000_000:
        raise HTTPException(status_code=400, detail="Amount is out of range")
    return amount


def _span(value: int | None, low: int, high: int, label: str) -> int | None:
    if value is None:
        return None
    number = int(value)
    if number < low or number > high:
        raise HTTPException(status_code=400, detail=f"{label} is out of range")
    return number


def _pan(value: str | None) -> str | None:
    text = _blank(value, 10)
    if text is None:
        return None
    pan = text.upper()
    if not PAN_RE.match(pan):
        raise HTTPException(status_code=400, detail="PAN format is ABCDE1234F")
    return pan


def _email(value: str | None) -> str | None:
    text = _blank(value, 255)
    if text is None:
        return None
    if "@" not in text or text.startswith("@") or text.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    return text.lower()


def _gst(value: str | None) -> str | None:
    text = _blank(value, 20)
    if text is None:
        return None
    gst = text.upper()
    if not GST_RE.match(gst):
        raise HTTPException(status_code=400, detail="GSTIN format is invalid")
    return gst


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _require_purchase(db: Session, user: User, purchase_id: UUID) -> LeadPurchase:
    purchase = db.query(LeadPurchase).filter(LeadPurchase.id == purchase_id).first()
    if not purchase or (user.role not in STAFF_ROLES and purchase.buyer_user_id != user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found or access denied")
    return purchase


def _profile_for(db: Session, purchase: LeadPurchase) -> CustomerProfile:
    return (
        db.query(CustomerProfile).filter(CustomerProfile.lead_purchase_id == purchase.id).first()
    )


def _require_profile(db: Session, user: User, profile_id: UUID) -> tuple[LeadPurchase, CustomerProfile]:
    profile = db.query(CustomerProfile).filter(CustomerProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    purchase = _require_purchase(db, user, profile.lead_purchase_id)
    return purchase, profile


def _require_row(db: Session, user: User, model: type, row_id: UUID):
    row = db.query(model).filter(model.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")
    _require_purchase(db, user, row.lead_purchase_id)
    return row


def _dump(row: Any, fields: list[str]) -> dict:
    out = {"id": str(row.id)}
    for name in fields:
        value = getattr(row, name)
        if isinstance(value, UUID):
            value = str(value)
        out[name] = value
    return out


PROFILE_FIELDS = [
    "lead_purchase_id",
    "lead_id",
    "dsa_id",
    "workspace_id",
    "full_name",
    "mobile",
    "alternate_mobile",
    "email",
    "dob",
    "gender",
    "marital_status",
    "father_name",
    "mother_name",
    "pan",
    "aadhaar",
    "education",
    "residence_type",
    "current_address",
    "permanent_address",
    "city",
    "state",
    "pincode",
    "family_members",
    "employment_type",
    "company_name",
    "business_name",
    "designation",
    "industry_type",
    "monthly_income",
    "net_salary",
    "annual_turnover",
    "work_experience",
    "business_vintage",
    "salary_mode",
    "gst_number",
    "itr_filed",
    "office_address",
    "profile_completion",
]


def _profile_out(row: CustomerProfile) -> dict:
    data = _dump(row, PROFILE_FIELDS)
    data["created_at"] = _iso(row.created_at)
    data["updated_at"] = _iso(row.updated_at)
    return data


def _lead_out(lead: Lead | None) -> dict | None:
    if lead is None:
        return None
    details = lead.product_details if isinstance(lead.product_details, dict) else {}
    cibil = details.get("cibil_score", details.get("cibil"))
    age = details.get("age")
    return {
        "id": str(lead.id),
        "applicant_name": lead.applicant_name,
        "full_phone": lead.full_phone,
        "alternate_phone": details.get("alternate_phone"),
        "email": lead.email,
        "city": lead.city,
        "state": lead.state,
        "loan_amount": float(lead.loan_amount or 0),
        "monthly_income": lead.monthly_income,
        "employment_type": lead.employment_type,
        "company_name": lead.company_name,
        "cibil_score": int(cibil) if isinstance(cibil, (int, float)) else None,
        "age": int(age) if isinstance(age, (int, float)) else None,
        "gender": details.get("gender") if isinstance(details.get("gender"), str) else None,
        "product_category": lead.product_category,
        "product_subtype": lead.product_subtype,
        "product_details": details,
    }


def _product_label(category: str, subtype: str | None) -> str:
    if subtype:
        return subtype.replace("_", " ")
    return {"loan": "Personal Loan", "insurance": "Insurance", "credit_card": "Credit Card", "investment": "Investment"}.get(
        category, "Personal Loan"
    )


def _ensure_profile(db: Session, purchase: LeadPurchase, lead: Lead | None) -> CustomerProfile:
    profile = _profile_for(db, purchase)
    if profile:
        return profile
    details = lead.product_details if lead and isinstance(lead.product_details, dict) else {}
    phone = "".join(ch for ch in (lead.full_phone if lead else "") if ch.isdigit())[-10:] or None
    pan = details.get("pan")
    profile = CustomerProfile(
        lead_purchase_id=purchase.id,
        lead_id=purchase.lead_id,
        dsa_id=purchase.buyer_user_id,
        full_name=lead.applicant_name if lead else None,
        mobile=phone,
        email=lead.email if lead else None,
        city=lead.city if lead else None,
        state=lead.state if lead else None,
        gender=details.get("gender") if isinstance(details.get("gender"), str) else None,
        employment_type=lead.employment_type if lead else None,
        company_name=lead.company_name if lead else None,
        monthly_income=lead.monthly_income if lead else None,
        pan=pan.upper() if isinstance(pan, str) and PAN_RE.match(pan.upper()) else None,
        family_members=int(details["family_members"]) if isinstance(details.get("family_members"), (int, float)) else None,
    )
    db.add(profile)
    db.flush()
    if lead and float(lead.loan_amount or 0) > 0:
        db.add(
            CustomerLoanRequirement(
                customer_profile_id=profile.id,
                lead_purchase_id=purchase.id,
                dsa_id=purchase.buyer_user_id,
                product_type=_product_label(lead.product_category, lead.product_subtype),
                loan_amount=float(lead.loan_amount),
                sort_order=0,
            )
        )
        db.flush()
    return profile


def _workspace(db: Session, purchase: LeadPurchase) -> dict:
    lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
    profile = _ensure_profile(db, purchase, lead)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        profile = _profile_for(db, purchase)
        if profile is None:
            raise HTTPException(status_code=409, detail="Workspace is already being created")
    db.refresh(profile)
    banks = (
        db.query(CustomerBankAccount)
        .filter(CustomerBankAccount.lead_purchase_id == purchase.id)
        .order_by(CustomerBankAccount.sort_order)
        .all()
    )
    obligations = (
        db.query(CustomerObligation)
        .filter(CustomerObligation.lead_purchase_id == purchase.id)
        .order_by(CustomerObligation.sort_order)
        .all()
    )
    co_apps = (
        db.query(CustomerCoApplicant)
        .filter(CustomerCoApplicant.lead_purchase_id == purchase.id)
        .order_by(CustomerCoApplicant.sort_order)
        .all()
    )
    loans = (
        db.query(CustomerLoanRequirement)
        .filter(CustomerLoanRequirement.lead_purchase_id == purchase.id)
        .order_by(CustomerLoanRequirement.sort_order)
        .all()
    )
    return {
        "purchase": {
            "id": str(purchase.id),
            "lead_id": str(purchase.lead_id),
            "pipeline_stage": purchase.pipeline_stage,
            "price_paid": float(purchase.price_paid or 0),
            "converted": bool(purchase.converted),
            "deal_value": float(purchase.deal_value) if purchase.deal_value is not None else None,
            "next_followup_at": _iso(purchase.next_followup_at),
            "lead": _lead_out(lead),
        },
        "profile": _profile_out(profile),
        "bankAccounts": [
            _dump(
                row,
                [
                    "customer_profile_id",
                    "lead_purchase_id",
                    "dsa_id",
                    "bank_name",
                    "account_type",
                    "account_vintage",
                    "average_balance",
                    "is_salary_account",
                    "emi_bounce_history",
                    "statement_available",
                    "is_primary",
                    "sort_order",
                ],
            )
            for row in banks
        ],
        "obligations": [
            _dump(
                row,
                [
                    "customer_profile_id",
                    "lead_purchase_id",
                    "dsa_id",
                    "loan_type",
                    "bank_name",
                    "emi",
                    "outstanding_amount",
                    "sanction_amount",
                    "remaining_tenure",
                    "start_date",
                    "overdue_status",
                    "sort_order",
                ],
            )
            for row in obligations
        ],
        "coApplicants": [
            _dump(
                row,
                [
                    "customer_profile_id",
                    "lead_purchase_id",
                    "dsa_id",
                    "relation",
                    "full_name",
                    "mobile",
                    "pan",
                    "aadhaar",
                    "employment_type",
                    "income",
                    "obligations_summary",
                    "cibil_score",
                    "sort_order",
                ],
            )
            for row in co_apps
        ],
        "loanRequirements": [
            _dump(
                row,
                [
                    "customer_profile_id",
                    "lead_purchase_id",
                    "dsa_id",
                    "product_type",
                    "loan_amount",
                    "tenure_months",
                    "purpose",
                    "property_value",
                    "has_existing_loan",
                    "balance_transfer",
                    "top_up_required",
                    "insurance_type",
                    "roi_percent",
                    "extra_fields",
                    "sort_order",
                ],
            )
            for row in loans
        ],
    }


def _apply(row: Any, values: dict[str, Any]) -> None:
    for key, value in values.items():
        if key in LOCKED or key == "lead_purchase_id":
            continue
        setattr(row, key, value)


def _clean_profile(body: ProfileIn, present: set[str]) -> dict[str, Any]:
    raw = body.model_dump(exclude_unset=True)
    out: dict[str, Any] = {}
    for key, limit in PROFILE_TEXT.items():
        if key in present:
            out[key] = _blank(raw.get(key), limit)
    if "mobile" in present:
        out["mobile"] = _digits(raw.get("mobile"), 10, "Mobile")
    if "alternate_mobile" in present:
        out["alternate_mobile"] = _digits(raw.get("alternate_mobile"), 10, "Alternate mobile")
    if "email" in present:
        out["email"] = _email(raw.get("email"))
    if "pan" in present:
        out["pan"] = _pan(raw.get("pan"))
    if "aadhaar" in present:
        out["aadhaar"] = _digits(raw.get("aadhaar"), 12, "Aadhaar")
    if "pincode" in present:
        out["pincode"] = _digits(raw.get("pincode"), 6, "Pincode")
    if "gst_number" in present:
        out["gst_number"] = _gst(raw.get("gst_number"))
    if "family_members" in present:
        out["family_members"] = _span(raw.get("family_members"), 0, 30, "Family members")
    if "profile_completion" in present:
        out["profile_completion"] = _span(raw.get("profile_completion"), 0, 100, "Completion") or 0
    for key in PROFILE_MONEY:
        if key in present:
            out[key] = _money(raw.get(key))
    return out


def _guard_count(db: Session, model: type, purchase_id: UUID) -> None:
    count = db.query(model).filter(model.lead_purchase_id == purchase_id).count()
    if count >= ROW_LIMIT:
        raise HTTPException(status_code=400, detail=f"Limit of {ROW_LIMIT} rows reached")


def _owned_profile(db: Session, user: User, purchase_id: UUID) -> tuple[LeadPurchase, CustomerProfile]:
    purchase = _require_purchase(db, user, purchase_id)
    profile = _profile_for(db, purchase)
    if not profile:
        raise HTTPException(status_code=404, detail="Open the workspace before adding rows")
    return purchase, profile


@router.get("/my-leads/{purchase_id}/workspace")
def read_workspace(
    purchase_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase = _require_purchase(db, user, purchase_id)
    return _workspace(db, purchase)


@router.patch("/customer-workspace/profiles/{profile_id}")
def save_profile(
    profile_id: UUID,
    body: ProfileIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    purchase, profile = _require_profile(db, user, profile_id)
    present = set(body.model_fields_set)
    old_name = profile.full_name
    _apply(profile, _clean_profile(body, present))
    if "full_name" in present and profile.full_name and profile.full_name != old_name:
        lead = db.query(Lead).filter(Lead.id == purchase.lead_id).first()
        sync_customer_name(db, purchase, profile.full_name, [old_name, lead.applicant_name if lead else None])
    db.commit()
    db.refresh(profile)
    return _profile_out(profile)


def _text_map(raw: dict, present: set[str], limits: dict[str, int]) -> dict[str, Any]:
    return {key: _blank(raw.get(key), limit) for key, limit in limits.items() if key in present}


@router.post("/customer-workspace/banks", status_code=201)
def add_bank(
    body: BankIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if body.lead_purchase_id is None:
        raise HTTPException(status_code=400, detail="Purchase is required")
    purchase, profile = _owned_profile(db, user, body.lead_purchase_id)
    _guard_count(db, CustomerBankAccount, purchase.id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    row = CustomerBankAccount(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        dsa_id=purchase.buyer_user_id,
        sort_order=_span(raw.get("sort_order"), 0, 100, "Sort") or 0,
    )
    _apply(
        row,
        {
            **_text_map(raw, present, {"bank_name": 200, "account_type": 80, "account_vintage": 80, "emi_bounce_history": 200}),
            **({"average_balance": _money(raw.get("average_balance"))} if "average_balance" in present else {}),
            **({key: bool(raw.get(key)) for key in ("is_salary_account", "statement_available", "is_primary") if key in present}),
        },
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "bank_name",
            "account_type",
            "account_vintage",
            "average_balance",
            "is_salary_account",
            "emi_bounce_history",
            "statement_available",
            "is_primary",
            "sort_order",
        ],
    )


@router.patch("/customer-workspace/banks/{row_id}")
def save_bank(
    row_id: UUID,
    body: BankIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerBankAccount, row_id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    values = _text_map(raw, present, {"bank_name": 200, "account_type": 80, "account_vintage": 80, "emi_bounce_history": 200})
    if "average_balance" in present:
        values["average_balance"] = _money(raw.get("average_balance"))
    for key in ("is_salary_account", "statement_available", "is_primary"):
        if key in present:
            values[key] = bool(raw.get(key))
    if "sort_order" in present:
        values["sort_order"] = _span(raw.get("sort_order"), 0, 100, "Sort") or 0
    _apply(row, values)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "bank_name",
            "account_type",
            "account_vintage",
            "average_balance",
            "is_salary_account",
            "emi_bounce_history",
            "statement_available",
            "is_primary",
            "sort_order",
        ],
    )


@router.delete("/customer-workspace/banks/{row_id}")
def remove_bank(
    row_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerBankAccount, row_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/customer-workspace/obligations", status_code=201)
def add_obligation(
    body: ObligationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if body.lead_purchase_id is None:
        raise HTTPException(status_code=400, detail="Purchase is required")
    purchase, profile = _owned_profile(db, user, body.lead_purchase_id)
    _guard_count(db, CustomerObligation, purchase.id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    row = CustomerObligation(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        dsa_id=purchase.buyer_user_id,
        sort_order=_span(raw.get("sort_order"), 0, 100, "Sort") or 0,
    )
    values = _text_map(raw, present, {"loan_type": 80, "bank_name": 200, "start_date": 20, "overdue_status": 80})
    for key in ("emi", "outstanding_amount", "sanction_amount"):
        if key in present:
            values[key] = _money(raw.get(key))
    if "remaining_tenure" in present:
        values["remaining_tenure"] = _span(raw.get("remaining_tenure"), 0, 600, "Tenure")
    _apply(row, values)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "loan_type",
            "bank_name",
            "emi",
            "outstanding_amount",
            "sanction_amount",
            "remaining_tenure",
            "start_date",
            "overdue_status",
            "sort_order",
        ],
    )


@router.patch("/customer-workspace/obligations/{row_id}")
def save_obligation(
    row_id: UUID,
    body: ObligationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerObligation, row_id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    values = _text_map(raw, present, {"loan_type": 80, "bank_name": 200, "start_date": 20, "overdue_status": 80})
    for key in ("emi", "outstanding_amount", "sanction_amount"):
        if key in present:
            values[key] = _money(raw.get(key))
    if "remaining_tenure" in present:
        values["remaining_tenure"] = _span(raw.get("remaining_tenure"), 0, 600, "Tenure")
    if "sort_order" in present:
        values["sort_order"] = _span(raw.get("sort_order"), 0, 100, "Sort") or 0
    _apply(row, values)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "loan_type",
            "bank_name",
            "emi",
            "outstanding_amount",
            "sanction_amount",
            "remaining_tenure",
            "start_date",
            "overdue_status",
            "sort_order",
        ],
    )


@router.delete("/customer-workspace/obligations/{row_id}")
def remove_obligation(
    row_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerObligation, row_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/customer-workspace/co-applicants", status_code=201)
def add_co_applicant(
    body: CoApplicantIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if body.lead_purchase_id is None:
        raise HTTPException(status_code=400, detail="Purchase is required")
    purchase, profile = _owned_profile(db, user, body.lead_purchase_id)
    _guard_count(db, CustomerCoApplicant, purchase.id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    row = CustomerCoApplicant(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        dsa_id=purchase.buyer_user_id,
        sort_order=_span(raw.get("sort_order"), 0, 100, "Sort") or 0,
    )
    values = _text_map(
        raw,
        present,
        {"relation": 80, "full_name": 200, "employment_type": 80, "obligations_summary": 400},
    )
    if "mobile" in present:
        values["mobile"] = _digits(raw.get("mobile"), 10, "Mobile")
    if "pan" in present:
        values["pan"] = _pan(raw.get("pan"))
    if "aadhaar" in present:
        values["aadhaar"] = _digits(raw.get("aadhaar"), 12, "Aadhaar")
    if "income" in present:
        values["income"] = _money(raw.get("income"))
    if "cibil_score" in present:
        values["cibil_score"] = _span(raw.get("cibil_score"), 300, 900, "CIBIL")
    _apply(row, values)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "relation",
            "full_name",
            "mobile",
            "pan",
            "aadhaar",
            "employment_type",
            "income",
            "obligations_summary",
            "cibil_score",
            "sort_order",
        ],
    )


@router.patch("/customer-workspace/co-applicants/{row_id}")
def save_co_applicant(
    row_id: UUID,
    body: CoApplicantIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerCoApplicant, row_id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    values = _text_map(
        raw,
        present,
        {"relation": 80, "full_name": 200, "employment_type": 80, "obligations_summary": 400},
    )
    if "mobile" in present:
        values["mobile"] = _digits(raw.get("mobile"), 10, "Mobile")
    if "pan" in present:
        values["pan"] = _pan(raw.get("pan"))
    if "aadhaar" in present:
        values["aadhaar"] = _digits(raw.get("aadhaar"), 12, "Aadhaar")
    if "income" in present:
        values["income"] = _money(raw.get("income"))
    if "cibil_score" in present:
        values["cibil_score"] = _span(raw.get("cibil_score"), 300, 900, "CIBIL")
    if "sort_order" in present:
        values["sort_order"] = _span(raw.get("sort_order"), 0, 100, "Sort") or 0
    _apply(row, values)
    db.commit()
    db.refresh(row)
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "relation",
            "full_name",
            "mobile",
            "pan",
            "aadhaar",
            "employment_type",
            "income",
            "obligations_summary",
            "cibil_score",
            "sort_order",
        ],
    )


@router.delete("/customer-workspace/co-applicants/{row_id}")
def remove_co_applicant(
    row_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerCoApplicant, row_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/customer-workspace/loan-requirements", status_code=201)
def add_loan(
    body: LoanIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if body.lead_purchase_id is None:
        raise HTTPException(status_code=400, detail="Purchase is required")
    purchase, profile = _owned_profile(db, user, body.lead_purchase_id)
    _guard_count(db, CustomerLoanRequirement, purchase.id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    row = CustomerLoanRequirement(
        customer_profile_id=profile.id,
        lead_purchase_id=purchase.id,
        dsa_id=purchase.buyer_user_id,
        sort_order=_span(raw.get("sort_order"), 0, 100, "Sort") or 0,
    )
    _apply(row, _loan_values(raw, present))
    db.add(row)
    db.commit()
    db.refresh(row)
    return _loan_out(row)


@router.patch("/customer-workspace/loan-requirements/{row_id}")
def save_loan(
    row_id: UUID,
    body: LoanIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerLoanRequirement, row_id)
    present = set(body.model_fields_set)
    raw = body.model_dump(exclude_unset=True)
    values = _loan_values(raw, present)
    if "sort_order" in present:
        values["sort_order"] = _span(raw.get("sort_order"), 0, 100, "Sort") or 0
    _apply(row, values)
    db.commit()
    db.refresh(row)
    return _loan_out(row)


@router.delete("/customer-workspace/loan-requirements/{row_id}")
def remove_loan(
    row_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _require_row(db, user, CustomerLoanRequirement, row_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


def _loan_values(raw: dict, present: set[str]) -> dict[str, Any]:
    values = _text_map(raw, present, {"product_type": 80, "purpose": 200, "insurance_type": 80})
    for key in ("loan_amount", "property_value"):
        if key in present:
            values[key] = _money(raw.get(key))
    if "tenure_months" in present:
        values["tenure_months"] = _span(raw.get("tenure_months"), 0, 600, "Tenure")
    if "roi_percent" in present:
        roi = raw.get("roi_percent")
        if roi is not None and (float(roi) < 0 or float(roi) > 100):
            raise HTTPException(status_code=400, detail="ROI is out of range")
        values["roi_percent"] = None if roi is None else float(roi)
    for key in ("has_existing_loan", "balance_transfer", "top_up_required"):
        if key in present:
            values[key] = bool(raw.get(key))
    if "extra_fields" in present:
        extra = raw.get("extra_fields") or {}
        if not isinstance(extra, dict) or len(extra) > 40:
            raise HTTPException(status_code=400, detail="Extra fields are invalid")
        values["extra_fields"] = extra
    return values


def _loan_out(row: CustomerLoanRequirement) -> dict:
    return _dump(
        row,
        [
            "customer_profile_id",
            "lead_purchase_id",
            "dsa_id",
            "product_type",
            "loan_amount",
            "tenure_months",
            "purpose",
            "property_value",
            "has_existing_loan",
            "balance_transfer",
            "top_up_required",
            "insurance_type",
            "roi_percent",
            "extra_fields",
            "sort_order",
        ],
    )
