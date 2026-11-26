import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.services import loan_cases as service
from app.services.document_files import delete_key, read_bytes, safe_filename, save_bytes, sniff_mime

PAPERS = {
    "sanction_letter": ("sanction_letter_key", "sanction_letter_name"),
    "bank_confirmation": ("bank_confirmation_key", "bank_confirmation_name"),
}

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
    application_no: str | None = None
    lan: str | None = None
    roi: float | None = None
    tenure_months: int | None = None
    disbursements: list[dict] | None = None
    bonus_name: str | None = None
    bonus_amount: float | None = None
    bonus_partner_percent: float | None = None
    bank_rm: str | None = None
    bank_rm_phone: str | None = None
    bankers: list[dict] | None = None
    customer: dict | None = None
    stakeholders: list[dict] | None = None
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


@router.get("/finance-report")
def read_finance_report(db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can open the finance report")
    return service.finance_report(db, user)


def _dump_mapping(raw: str) -> dict:
    try:
        parsed = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    allowed = {"application_no", "lan", "phone", "amount", "date", "reference"}
    return {key: str(value) for key, value in parsed.items() if key in allowed and str(value).strip()}


@router.post("/lender-dump/preview")
async def preview_dump(
    file: UploadFile = File(...),
    mapping: str = Form("{}"),
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can import a lender dump")
    return service.preview_lender_dump(db, await file.read(), _dump_mapping(mapping))


@router.post("/lender-dump/apply")
async def apply_dump(
    file: UploadFile = File(...),
    mapping: str = Form("{}"),
    lender: str = Form(""),
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can import a lender dump")
    return service.apply_lender_dump(db, user, await file.read(), file.filename or "dump.csv", _dump_mapping(mapping), lender)


@router.get("/lender-dump/history")
def dump_history(db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    from app.models import ImportBatch
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can import a lender dump")
    items = []
    for batch in db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(40).all():
        summary = next((row for row in (batch.snapshot or []) if row.get("kind") == "summary"), None)
        if not summary:
            continue
        items.append({
            "id": str(batch.id),
            "filename": batch.filename,
            "lender": summary.get("lender") or "",
            "dump_amount": float(summary.get("dump_amount") or 0),
            "rows": int(summary.get("rows") or 0),
            "status": batch.status,
            "created_at": batch.created_at.isoformat() if batch.created_at else "",
        })
    return {"items": items}


@router.post("/lender-dump/{batch_id}/rollback")
def rollback_dump(batch_id: UUID, db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can roll back a dump")
    try:
        return service.rollback_lender_dump(db, user, batch_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/import-disbursed")
def import_disbursed_leads(db: Session = Depends(get_db), user: User = Depends(require_reader)) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin can import disbursed leads")
    return service.import_disbursed(db, user)


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


def _paper_case(db: Session, user: User, case_id: UUID):
    row = service._visible(db, user).filter_by(id=case_id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case file not found")
    return row


@router.post("/{case_id}/papers/{kind}")
async def upload_paper(
    case_id: UUID,
    kind: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> dict:
    fields = PAPERS.get(kind)
    if fields is None:
        raise HTTPException(status_code=400, detail="Unknown paper")
    row = _paper_case(db, user, case_id)
    payload = await file.read()
    mime = sniff_mime(payload, file.content_type or "")
    key_field, name_field = fields
    previous = getattr(row, key_field)
    previous_name = getattr(row, name_field)
    key = save_bytes(str(row.id), kind, payload, mime)
    setattr(row, key_field, key)
    setattr(row, name_field, safe_filename(file.filename or kind))
    if previous and previous != key:
        history = list(row.paper_history or [])
        history.append({"kind": kind, "key": previous, "name": previous_name})
        row.paper_history = history[-12:]
    db.commit()
    db.refresh(row)
    return service.serialize(row)


@router.get("/{case_id}/papers/{kind}")
def download_paper(
    case_id: UUID,
    kind: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_reader),
) -> Response:
    fields = PAPERS.get(kind)
    if fields is None:
        raise HTTPException(status_code=400, detail="Unknown paper")
    row = _paper_case(db, user, case_id)
    key = getattr(row, fields[0])
    if not key:
        raise HTTPException(status_code=404, detail="File not found")
    name = safe_filename(getattr(row, fields[1]) or kind)
    return Response(
        content=read_bytes(key),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )
