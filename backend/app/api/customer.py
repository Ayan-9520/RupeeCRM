from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_public_api_key
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.models import User
from app.services.customers import applications_for, save_eligibility_application
from app.services.pipeline import intake_product_form

router = APIRouter(tags=["customer"])


class EligibilityIn(BaseModel):
    full_name: str = Field(min_length=2)
    mobile: str
    email: str
    city: str = ""
    product: str
    employment: str = ""
    monthly_income: float = 0
    existing_emi: float = 0
    requested_amount: float = 0
    cibil: float = 0
    selected_bank: str = ""
    eligible_amount: float = 0
    interest_rate: float | None = None
    emi: float | None = None
    documents: list[str] = Field(default_factory=list)
    website_lead_id: str | None = None


@router.post("/api/public/eligibility", dependencies=[Depends(require_public_api_key)])
def public_eligibility(
    body: EligibilityIn,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    check_rate_limit(request, limit=20, window_sec=60)
    if not body.email.strip() or "@" not in body.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")
    lead, password = save_eligibility_application(db, body.model_dump())
    return {
        "success": True,
        "lead_id": lead.website_lead_id or str(lead.id),
        "email": body.email.strip().lower(),
        "temporary_password": password,
    }


class ProductLoanIn(BaseModel):
    full_name: str = Field(min_length=2)
    mobile: str
    city: str = ""
    product: str = "Loan"
    loan_amount: float = 0
    email: str = ""
    monthly_income: float = 0
    employment: str = ""
    bank_preference: str = ""


@router.post("/api/public/product-loan", dependencies=[Depends(require_public_api_key)])
def public_product_loan(body: ProductLoanIn, request: Request, db: Session = Depends(get_db)) -> dict:
    check_rate_limit(request, limit=20, window_sec=60)
    try:
        return intake_product_form(
            db,
            body.full_name,
            body.mobile,
            body.city,
            body.product,
            body.loan_amount,
            body.email,
            body.monthly_income,
            body.employment,
            body.bank_preference,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/api/customer/home")
def customer_home(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    if user.role not in {"customer", "admin", "ceo", "super_admin"}:
        raise HTTPException(status_code=403, detail="Customer login required")
    rows = applications_for(db, user)
    return {"applications": rows, "advisor": "RupeeDial expert", "support_path": "/expert"}
