from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import require_public_api_key
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.schemas import PublicPartnerIn, PublicPartnerOut
from app.services.partners import upsert_partner_from_website

router = APIRouter(prefix="/api/public", tags=["public-partners"])


@router.post("/partners", response_model=PublicPartnerOut, dependencies=[Depends(require_public_api_key)])
def ingest_public_partner(
    body: PublicPartnerIn,
    request: Request,
    db: Session = Depends(get_db),
) -> PublicPartnerOut:
    check_rate_limit(request, limit=20, window_sec=60, scope="partner_apply")
    try:
        row = upsert_partner_from_website(db, body.model_dump(exclude_none=False))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return PublicPartnerOut(id=row.id, website_lead_id=row.website_lead_id)
