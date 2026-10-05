from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import pipeline as pipeline_service

router = APIRouter(prefix="/api/admin/pipeline", tags=["pipeline"])
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class ImportRow(BaseModel):
    name: str = ""
    phone: str = ""
    city: str = ""
    product: str = "personal"


class ImportBody(BaseModel):
    source: str
    campaign: str = ""
    consent: bool = False
    rows: list[ImportRow] = Field(default_factory=list)


class StepBody(BaseModel):
    step: str
    campaign: str = ""
    assignee_email: str = ""
    note: str = ""


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


@router.get("")
def get_pipeline(
    source: str | None = Query(default=None),
    stage: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict:
    data = pipeline_service.summary(db)
    data["rows"] = pipeline_service.list_rows(db, source, stage)
    return data


@router.post("/import")
def import_pipeline(
    body: ImportBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    try:
        return pipeline_service.import_rows(
            db,
            admin,
            body.source,
            body.campaign,
            body.consent,
            [row.model_dump() for row in body.rows],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{lead_id}")
def advance_pipeline(
    lead_id: UUID,
    body: StepBody,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    try:
        return pipeline_service.advance(db, admin, lead_id, body.step, body.campaign, body.assignee_email, body.note)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
