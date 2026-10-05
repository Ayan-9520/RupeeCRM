from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.commission import get_percent, save_percent

router = APIRouter(prefix="/api/admin/commission", tags=["commission"])
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class CommissionIn(BaseModel):
    rate_percent: float


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.get("")
def read_commission(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return {"rate_percent": get_percent(db)}


@router.put("")
def write_commission(body: CommissionIn, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    try:
        saved = save_percent(db, body.rate_percent)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"rate_percent": saved}
