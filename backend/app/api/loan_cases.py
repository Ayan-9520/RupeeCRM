from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import loan_cases as service

router = APIRouter(prefix="/api/cases", tags=["cases"])
READ_ROLES = {"admin", "ceo", "super_admin", "lender", "dsa", "coordinator"}
ADMIN_ROLES = {"admin", "ceo", "super_admin"}


def require_reader(user: User = Depends(get_current_user)) -> User:
    if user.role not in READ_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Case files are not on this login")
    return user


class CaseIn(BaseModel):
    loan_type: str = "LAP"
    lead_source: str | None = None
    partner_code: str | None = None
    partner_name: str | None = None
    client_name: str = ""
    client_phone: str | None = None
    project_name: str | None = None
    expected_sanction_on: str | None = None
    client_access: str | None = None
    loan_amount: float | None = None
    sanctioned_amount: float | None = None
    receivable_percent: float | None = None
    payable_percent: float | None = None
    loyalty_name: str | None = None
    loyalty_amount: float | None = None
    bank_name: str | None = None
    bank_rm: str | None = None
    bank_rm_phone: str | None = None
    pod_remarks: str | None = None
    stage: str | None = None
    flag: str | None = None
    pod_pending: bool | None = None
    counted: bool | None = None
    invoice_amount: float | None = None
    collected_amount: float | None = None
    payout_status: str | None = None
    payout_note: str | None = None


@router.get("")
def read_cases(
    chip: str = Query(default="all"),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> dict:
    return service.list_cases(db, user, chip, date_from, date_to)


@router.post("")
def open_case(body: CaseIn, db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can open a case file")
    return service.create_case(db, user, body.model_dump(exclude_none=True))


@router.post("/sample")
def open_sample(db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can open the sample file")
    return service.sample_file(db, user)


@router.put("/{case_id}")
def save_case(
    case_id: UUID,
    body: CaseIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> dict:
    try:
        return service.update_case(db, user, case_id, body.model_dump(exclude_unset=True))
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
