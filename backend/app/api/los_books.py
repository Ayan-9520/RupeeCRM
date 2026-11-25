"""Lender master, a second bank on a case, schemes, and credit or debit notes."""

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CaseApplication, Lender, LenderBranch, LenderScheme, LedgerNote, LoanCase, User

router = APIRouter(prefix="/api/los", tags=["los"])
ADMIN = {"admin", "ceo", "super_admin"}
LENDER_STATUSES = {"", "received", "under_process", "documents_pending", "sanctioned", "disbursed", "rejected", "cancelled"}


def _admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can change the lender book")
    return user


class LenderIn(BaseModel):
    name: str
    code: str
    lender_type: str = "bank"
    gst_treatment: str = "exclusive"


class BranchIn(BaseModel):
    name: str
    city: str = ""


class ApplicationIn(BaseModel):
    lender_id: UUID | None = None
    branch_name: str = ""
    application_no: str = ""
    lan: str = ""
    lender_status: str = ""
    amount: float = 0


class SchemeIn(BaseModel):
    lender_id: UUID | None = None
    name: str
    bonus_amount: float = 0
    partner_percent: float = 0


class NoteIn(BaseModel):
    loan_case_id: UUID
    kind: str
    amount: float
    note: str = ""


@router.get("/lenders")
def list_lenders(db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    lenders = db.query(Lender).order_by(Lender.name).all()
    branches = db.query(LenderBranch).all()
    return {
        "lenders": [
            {
                "id": str(row.id),
                "name": row.name,
                "code": row.code,
                "lender_type": row.lender_type,
                "active": row.active,
                "gst_treatment": row.gst_treatment,
                "branches": [{"id": str(b.id), "name": b.name, "city": b.city} for b in branches if b.lender_id == row.id],
            }
            for row in lenders
        ]
    }


@router.post("/lenders")
def add_lender(body: LenderIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    code = body.code.strip().upper()
    if db.query(Lender).filter(Lender.code == code).first():
        raise HTTPException(status_code=400, detail="That lender code already exists")
    row = Lender(id=uuid4(), name=body.name.strip()[:160], code=code[:40], lender_type=body.lender_type if body.lender_type in {"bank", "nbfc"} else "bank", gst_treatment=body.gst_treatment if body.gst_treatment in {"exclusive", "inclusive", "none"} else "exclusive")
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.post("/lenders/{lender_id}/branches")
def add_branch(lender_id: UUID, body: BranchIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    if db.query(Lender).filter(Lender.id == lender_id).first() is None:
        raise HTTPException(status_code=404, detail="Lender not found")
    row = LenderBranch(id=uuid4(), lender_id=lender_id, name=body.name.strip()[:160], city=body.city.strip()[:80])
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.post("/cases/{case_id}/applications")
def add_application(case_id: UUID, body: ApplicationIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    case = db.query(LoanCase).filter(LoanCase.id == case_id).first()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if db.query(CaseApplication).filter(CaseApplication.loan_case_id == case_id).count() >= 1:
        raise HTTPException(status_code=400, detail="This case already has a second bank")
    if body.lender_status not in LENDER_STATUSES:
        raise HTTPException(status_code=400, detail="Unknown lender status")
    row = CaseApplication(
        id=uuid4(),
        loan_case_id=case_id,
        lender_id=body.lender_id,
        branch_name=body.branch_name.strip()[:160],
        application_no=body.application_no.strip()[:80],
        lan=body.lan.strip()[:80],
        lender_status=body.lender_status,
        amount=round(body.amount, 2),
    )
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.get("/schemes")
def list_schemes(db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    rows = db.query(LenderScheme).all()
    return {"schemes": [{"id": str(row.id), "name": row.name, "bonus_amount": float(row.bonus_amount or 0), "partner_percent": float(row.partner_percent or 0), "active": row.active} for row in rows]}


@router.post("/schemes")
def add_scheme(body: SchemeIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    row = LenderScheme(id=uuid4(), lender_id=body.lender_id, name=body.name.strip()[:160], bonus_amount=round(body.bonus_amount, 2), partner_percent=round(body.partner_percent, 2), active=True)
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.post("/notes")
def add_note(body: NoteIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    if body.kind not in {"credit", "debit"}:
        raise HTTPException(status_code=400, detail="Kind must be credit or debit")
    if db.query(LoanCase).filter(LoanCase.id == body.loan_case_id).first() is None:
        raise HTTPException(status_code=404, detail="Case not found")
    row = LedgerNote(id=uuid4(), loan_case_id=body.loan_case_id, kind=body.kind, amount=round(body.amount, 2), note=body.note.strip()[:500])
    db.add(row)
    db.commit()
    return {"id": str(row.id)}
