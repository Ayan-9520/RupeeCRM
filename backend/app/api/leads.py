from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Lead, User
from app.schemas import LeadCreate, LeadListOut, LeadOut
from app.plans import default_lead_price
from app.services.lead_upload import upload_csv
from app.services.leads import mask_phone, normalize_phone

ADMIN_ROLES = {"ceo", "super_admin", "admin"}

router = APIRouter(prefix="/api/leads", tags=["leads"])


@router.get("", response_model=LeadListOut)
def list_leads(
    q: str | None = Query(default=None),
    source: str | None = Query(default=None),
    product_category: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> LeadListOut:
    query = db.query(Lead)
    if source:
        query = query.filter(Lead.source == source)
    if product_category:
        query = query.filter(Lead.product_category == product_category)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Lead.applicant_name.ilike(like),
                Lead.full_phone.ilike(like),
                Lead.city.ilike(like),
                Lead.email.ilike(like),
            )
        )
    total = query.with_entities(func.count(Lead.id)).scalar() or 0
    items = query.order_by(Lead.created_at.desc()).offset(offset).limit(limit).all()
    return LeadListOut(items=items, total=total)


@router.post("/upload")
async def upload_leads(
    file: UploadFile = File(...),
    campaign: str = Form(default=""),
    publish: str = Form(default="false"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    raw = await file.read()
    if len(raw) > 1_000_000:
        raise HTTPException(status_code=400, detail="The file is larger than 1 MB.")
    try:
        return upload_csv(db, user, raw, campaign, publish.strip().lower() in {"1", "true", "yes", "on"})
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Lead:
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(
    body: LeadCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Lead:
    if body.is_marketplace and user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only an admin can add a lead to the leadboard")
    phone = normalize_phone(body.full_phone)
    price = float(body.price or 0) or default_lead_price(body.product_category)
    lead = Lead(
        applicant_name=body.applicant_name.strip() or "Unknown",
        full_phone=phone,
        masked_phone=mask_phone(phone),
        email=body.email,
        city=body.city or "",
        loan_amount=float(body.loan_amount or 0),
        monthly_income=body.monthly_income,
        employment_type=body.employment_type,
        company_name=body.company_name,
        product_category=body.product_category or "loan",
        product_subtype=body.product_subtype,
        loan_type=body.loan_type or "personal",
        source=body.source or "manual",
        score=body.score or "cold",
        price=price,
        is_marketplace=body.is_marketplace,
        sale_available=body.sale_available,
        product_details=body.product_details or {},
        status="available",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead
