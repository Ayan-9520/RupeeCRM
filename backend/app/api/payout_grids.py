from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.commission import require_admin
from app.db.session import get_db
from app.models import User
from app.services import payout_grids as service

router = APIRouter(prefix="/api/admin/payout-grids", tags=["payout-grids"])


class GridIn(BaseModel):
    channel_name: str = Field(min_length=2, max_length=160)
    product: str = Field(min_length=2, max_length=80)
    effective_from: date
    receivable_percent: float = Field(ge=0, le=100)
    payable_percent: float = Field(ge=0, le=100)
    note: str = Field(default="", max_length=500)


class QuoteIn(BaseModel):
    amount: float = Field(ge=0, le=500000000)
    receivable_percent: float = Field(ge=0, le=100)
    payable_percent: float = Field(ge=0, le=100)
    subvention_points: float = Field(default=0, ge=0, le=100)
    other_points: float = Field(default=0, ge=0, le=100)


class AdjustmentIn(BaseModel):
    deal_no: str = Field(min_length=1, max_length=40)
    kind: str = "subvention"
    subvention_points: float = Field(default=0, ge=0, le=100)
    other_points: float = Field(default=0, ge=0, le=100)
    payable_percent: float | None = Field(default=None, ge=0, le=100)
    reason: str = Field(min_length=4, max_length=500)


class DecideIn(BaseModel):
    approve: bool


@router.get("")
def list_grids(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return {"items": service.list_grids(db)}


@router.post("")
def create_grid(body: GridIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> dict:
    return service.create_grid(db, admin, body.model_dump())


@router.get("/lookup")
def lookup(channel: str, product: str, on: date, db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    row = service.rate_for(db, channel, product, on)
    if not row:
        raise HTTPException(status_code=404, detail="No approved rate for that lender, product and date")
    return row


@router.post("/quote")
def quote(body: QuoteIn, _: User = Depends(require_admin)) -> dict:
    return service.quote(
        body.amount,
        body.receivable_percent,
        body.payable_percent,
        body.subvention_points,
        body.other_points,
    )


@router.get("/adjustments")
def list_adjustments(db: Session = Depends(get_db), _: User = Depends(require_admin)) -> dict:
    return {"items": service.list_adjustments(db)}


@router.post("/adjustments")
def create_adjustment(body: AdjustmentIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> dict:
    return service.create_adjustment(db, admin, body.model_dump())


@router.post("/adjustments/{adjustment_id}/decide")
def decide_adjustment(
    adjustment_id: UUID,
    body: DecideIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> dict:
    return service.decide_adjustment(db, admin, adjustment_id, body.approve)


@router.post("/{grid_id}/decide")
def decide_grid(grid_id: UUID, body: DecideIn, db: Session = Depends(get_db), admin: User = Depends(require_admin)) -> dict:
    return service.decide_grid(db, admin, grid_id, body.approve)
