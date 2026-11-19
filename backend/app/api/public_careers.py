from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_public_api_key
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.models import CareerApplication
from app.schemas import PublicCareerIn, PublicCareerOut

router = APIRouter(prefix="/api/public", tags=["public-careers"])


def _text(data: dict, *keys: str, limit: int = 200) -> str:
    for key in keys:
        value = data.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text[:limit]
    return ""


@router.post("/careers", response_model=PublicCareerOut, dependencies=[Depends(require_public_api_key)])
def ingest_public_career(body: PublicCareerIn, request: Request, db: Session = Depends(get_db)) -> PublicCareerOut:
    check_rate_limit(request, limit=20, window_sec=60, scope="career_apply")
    data = body.model_dump()
    website_id = _text(data, "website_lead_id", "lead_id", limit=80)
    name = _text(data, "full_name", "name")
    if not website_id or not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name and application id are required")

    row = db.query(CareerApplication).filter(CareerApplication.website_lead_id == website_id).first()
    fields = {
        "full_name": name,
        "phone": _text(data, "phone", "mobile", limit=30),
        "email": _text(data, "email", limit=255),
        "position": _text(data, "position", limit=160),
        "experience": _text(data, "experience", limit=80),
        "city": _text(data, "city", limit=120),
        "message": _text(data, "message", limit=4000),
        "current_role": _text(data, "current_role", "currentRole", limit=160),
        "notice_period": _text(data, "notice_period", "noticePeriod", limit=40),
        "expected_salary": _text(data, "expected_salary", "expectedSalary", limit=80),
        "source": _text(data, "source", limit=80),
        "resume_url": _text(data, "resume_url", "resumeUrl", limit=2000),
    }
    if row is None:
        row = CareerApplication(website_lead_id=website_id, status="new", **fields)
        db.add(row)
    else:
        for key, value in fields.items():
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return PublicCareerOut(id=row.id, website_lead_id=row.website_lead_id)
