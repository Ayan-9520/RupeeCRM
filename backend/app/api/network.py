from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services.network import create_invite, get_settings, network_view, save_levels

router = APIRouter(prefix="/api/network", tags=["network"])
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class InviteIn(BaseModel):
    full_name: str = Field(min_length=2)
    phone: str = ""
    email: str = ""


class LevelIn(BaseModel):
    label: str
    share_percent: float


class LevelsIn(BaseModel):
    levels: list[LevelIn]


def _require_admin(user: User) -> None:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin only")


@router.get("/me")
def my_network(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    return network_view(db, user)


@router.post("/invites")
def invite_partner(
    body: InviteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = create_invite(db, user, body.full_name, body.phone, body.email)
    return {
        "id": str(row.id),
        "code": row.invite_code,
        "name": row.invite_name,
        "status": row.status,
    }


@router.get("/settings")
def read_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    _require_admin(user)
    row = get_settings(db)
    return {"levels": row.levels or []}


@router.put("/settings")
def write_settings(
    body: LevelsIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    try:
        row = save_levels(db, [item.model_dump() for item in body.levels])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"levels": row.levels or []}
