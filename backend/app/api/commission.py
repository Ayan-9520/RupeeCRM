from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CommissionSettings, User
from app.services.commission import get_percent, save_percent
from app.services.invoice_flow import tax_settings

router = APIRouter(prefix="/api/admin/commission", tags=["commission"])
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class CommissionIn(BaseModel):
    rate_percent: float
    gst_percent: float | None = None
    tds_percent: float | None = None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


def _out(db: Session) -> dict:
    gst, tds = tax_settings(db)
    return {"rate_percent": get_percent(db), "gst_percent": gst, "tds_percent": tds}


@router.get("")
def read_commission(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return _out(db)


@router.put("")
def write_commission(body: CommissionIn, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    try:
        save_percent(db, body.rate_percent)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if body.gst_percent is not None or body.tds_percent is not None:
        for value in (body.gst_percent, body.tds_percent):
            if value is not None and not 0 <= value <= 50:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GST and TDS percent must be between 0 and 50")
        row = db.query(CommissionSettings).filter(CommissionSettings.id == 1).first()
        if body.gst_percent is not None:
            row.gst_percent = body.gst_percent
        if body.tds_percent is not None:
            row.tds_percent = body.tds_percent
        db.commit()
    return _out(db)
