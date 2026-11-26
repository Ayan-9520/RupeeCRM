"""Lender master, a second bank on a case, schemes, and credit or debit notes."""

from datetime import date
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import CaseApplication, Lender, LenderBranch, LenderContact, LenderProduct, LenderScheme, LedgerNote, LoanCase, SchemeTarget, User
from app.services.audit import write_audit
from app.services.loan_cases import _clean_disbursements

router = APIRouter(prefix="/api/los", tags=["los"])
ADMIN = {"admin", "ceo", "super_admin"}
LENDER_STATUSES = {"", "received", "under_process", "documents_pending", "sanctioned", "disbursed", "rejected", "cancelled"}


def _admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can change the lender book")
    return user


TYPES = {"bank", "nbfc", "other"}


class LenderIn(BaseModel):
    name: str
    code: str
    lender_type: str = "bank"
    gst_treatment: str = "exclusive"
    website: str = ""
    phone: str = ""
    notes: str = ""
    active: bool = True


class BranchIn(BaseModel):
    name: str
    city: str = ""
    code: str = ""
    address: str = ""
    state: str = ""
    pincode: str = ""
    phone: str = ""
    active: bool = True


class ProductIn(BaseModel):
    name: str
    category: str = ""
    notes: str = ""
    active: bool = True


class ContactIn(BaseModel):
    name: str
    designation: str = ""
    branch_id: UUID | None = None
    phone: str = ""
    email: str = ""
    notes: str = ""
    active: bool = True


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
    code: str = ""
    description: str = ""
    category: str = ""
    start_on: str = ""
    end_on: str = ""
    notes: str = ""
    active: bool = True


class TargetIn(BaseModel):
    lender_id: UUID | None = None
    scheme_id: UUID | None = None
    period_kind: str = "custom"
    start_on: str
    end_on: str
    metric: str = "disbursement_amount"
    target_value: float = 0


class NoteIn(BaseModel):
    loan_case_id: UUID
    kind: str
    amount: float
    note: str = ""


@router.get("/lenders")
def list_lenders(db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    lenders = db.query(Lender).order_by(Lender.name).all()
    branches = db.query(LenderBranch).all()
    products = db.query(LenderProduct).all()
    contacts = db.query(LenderContact).all()
    return {
        "lenders": [
            {
                "id": str(row.id),
                "name": row.name,
                "code": row.code,
                "lender_type": row.lender_type,
                "active": row.active,
                "gst_treatment": row.gst_treatment,
                "website": row.website or "",
                "phone": row.phone or "",
                "notes": row.notes or "",
                "branches": [{"id": str(b.id), "name": b.name, "city": b.city, "code": b.code or "", "state": b.state or "", "active": b.active} for b in branches if b.lender_id == row.id],
                "products": [{"id": str(p.id), "name": p.name, "category": p.category or "", "active": p.active} for p in products if p.lender_id == row.id],
                "contacts": [{"id": str(c.id), "name": c.name, "designation": c.designation or "", "branch_id": str(c.branch_id) if c.branch_id else "", "phone": c.phone or "", "active": c.active} for c in contacts if c.lender_id == row.id],
            }
            for row in lenders
        ]
    }


@router.post("/lenders")
def add_lender(body: LenderIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    code = body.code.strip().upper()
    if db.query(Lender).filter(Lender.code == code).first():
        raise HTTPException(status_code=400, detail="That lender code already exists")
    row = Lender(id=uuid4(), name=body.name.strip()[:160], code=code[:40], lender_type=body.lender_type if body.lender_type in TYPES else "bank", gst_treatment=body.gst_treatment if body.gst_treatment in {"exclusive", "inclusive", "none"} else "exclusive", website=body.website.strip()[:200], phone=body.phone.strip()[:30], notes=body.notes.strip()[:1000], active=body.active)
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.post("/lenders/{lender_id}/branches")
def add_branch(lender_id: UUID, body: BranchIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    if db.query(Lender).filter(Lender.id == lender_id).first() is None:
        raise HTTPException(status_code=404, detail="Lender not found")
    row = LenderBranch(id=uuid4(), lender_id=lender_id, name=body.name.strip()[:160], city=body.city.strip()[:80], code=body.code.strip()[:40], address=body.address.strip()[:240], state=body.state.strip()[:80], pincode=body.pincode.strip()[:10], phone=body.phone.strip()[:30], active=body.active)
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.patch("/lenders/{lender_id}")
def edit_lender(lender_id: UUID, body: LenderIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    row = db.query(Lender).filter(Lender.id == lender_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Lender not found")
    code = body.code.strip().upper()[:40]
    taken = db.query(Lender).filter(Lender.code == code, Lender.id != lender_id).first()
    if taken:
        raise HTTPException(status_code=400, detail="That lender code already exists")
    row.name = body.name.strip()[:160]
    row.code = code
    row.lender_type = body.lender_type if body.lender_type in TYPES else row.lender_type
    row.website = body.website.strip()[:200]
    row.phone = body.phone.strip()[:30]
    row.notes = body.notes.strip()[:1000]
    row.active = body.active
    db.commit()
    return {"id": str(row.id)}


@router.post("/lenders/{lender_id}/products")
def add_product(lender_id: UUID, body: ProductIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    if db.query(Lender).filter(Lender.id == lender_id).first() is None:
        raise HTTPException(status_code=404, detail="Lender not found")
    name = body.name.strip()[:160]
    if db.query(LenderProduct).filter(LenderProduct.lender_id == lender_id, LenderProduct.name == name).first():
        raise HTTPException(status_code=400, detail="This lender already has that product")
    row = LenderProduct(id=uuid4(), lender_id=lender_id, name=name, category=body.category.strip()[:80], notes=body.notes.strip()[:500], active=body.active)
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.patch("/products/{product_id}")
def edit_product(product_id: UUID, body: ProductIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    row = db.query(LenderProduct).filter(LenderProduct.id == product_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")
    row.name = body.name.strip()[:160]
    row.category = body.category.strip()[:80]
    row.notes = body.notes.strip()[:500]
    row.active = body.active
    db.commit()
    return {"id": str(row.id)}


@router.patch("/branches/{branch_id}")
def edit_branch(branch_id: UUID, body: BranchIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    row = db.query(LenderBranch).filter(LenderBranch.id == branch_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Branch not found")
    row.name = body.name.strip()[:160]
    row.city = body.city.strip()[:80]
    row.code = body.code.strip()[:40]
    row.address = body.address.strip()[:240]
    row.state = body.state.strip()[:80]
    row.pincode = body.pincode.strip()[:10]
    row.phone = body.phone.strip()[:30]
    row.active = body.active
    db.commit()
    return {"id": str(row.id)}


@router.post("/lenders/{lender_id}/contacts")
def add_contact(lender_id: UUID, body: ContactIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    if db.query(Lender).filter(Lender.id == lender_id).first() is None:
        raise HTTPException(status_code=404, detail="Lender not found")
    if body.branch_id and db.query(LenderBranch).filter(LenderBranch.id == body.branch_id, LenderBranch.lender_id == lender_id).first() is None:
        raise HTTPException(status_code=400, detail="That branch is not on this lender")
    row = LenderContact(id=uuid4(), lender_id=lender_id, branch_id=body.branch_id, name=body.name.strip()[:160], designation=body.designation.strip()[:80], phone=body.phone.strip()[:30], email=body.email.strip()[:160], notes=body.notes.strip()[:500], active=body.active)
    db.add(row)
    db.commit()
    return {"id": str(row.id)}


@router.patch("/contacts/{contact_id}")
def edit_contact(contact_id: UUID, body: ContactIn, db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    row = db.query(LenderContact).filter(LenderContact.id == contact_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Banker not found")
    if body.branch_id and db.query(LenderBranch).filter(LenderBranch.id == body.branch_id, LenderBranch.lender_id == row.lender_id).first() is None:
        raise HTTPException(status_code=400, detail="That branch is not on this lender")
    row.name = body.name.strip()[:160]
    row.designation = body.designation.strip()[:80]
    row.branch_id = body.branch_id
    row.phone = body.phone.strip()[:30]
    row.email = body.email.strip()[:160]
    row.notes = body.notes.strip()[:500]
    row.active = body.active
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


def _current_scheme(row: LenderScheme) -> bool:
    today = date.today().isoformat()
    if not row.active:
        return False
    if row.start_on and row.start_on > today:
        return False
    if row.end_on and row.end_on < today:
        return False
    return True


def _scheme_out(row: LenderScheme) -> dict:
    return {
        "id": str(row.id),
        "lender_id": str(row.lender_id) if row.lender_id else "",
        "name": row.name,
        "code": row.code or "",
        "category": row.category or "",
        "start_on": row.start_on or "",
        "end_on": row.end_on or "",
        "active": row.active,
        "current": _current_scheme(row),
        "bonus_amount": float(row.bonus_amount or 0),
        "partner_percent": float(row.partner_percent or 0),
    }


@router.get("/schemes")
def list_schemes(db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    rows = db.query(LenderScheme).order_by(LenderScheme.name).all()
    return {"schemes": [_scheme_out(row) for row in rows]}


@router.post("/schemes")
def add_scheme(body: SchemeIn, db: Session = Depends(get_db), user: User = Depends(_admin)) -> dict:
    row = LenderScheme(
        id=uuid4(),
        lender_id=body.lender_id,
        name=body.name.strip()[:160],
        bonus_amount=round(body.bonus_amount, 2),
        partner_percent=round(body.partner_percent, 2),
        active=body.active,
        code=body.code.strip()[:40],
        description=body.description.strip()[:500],
        category=body.category.strip()[:80],
        start_on=body.start_on.strip()[:10],
        end_on=body.end_on.strip()[:10],
        notes=body.notes.strip()[:500],
        created_by=user.id,
    )
    db.add(row)
    write_audit(db, action="scheme_saved", actor_user_id=user.id, entity_type="lender_scheme", entity_id=str(row.id), detail={"name": row.name})
    db.commit()
    return {"id": str(row.id)}


def _in_period(when: str, start: str, end: str) -> bool:
    if not when or not start or not end:
        return False
    return start <= when[:10] <= end


def _achievement(db: Session, target: SchemeTarget) -> dict:
    amount = 0.0
    cases = 0
    seen = set()
    for row in db.query(LoanCase).all():
        if row.flag in {"cancelled", "hold"} or not row.counted:
            continue
        if target.lender_id and row.lender_id != target.lender_id:
            continue
        if target.scheme_id and row.scheme_id != target.scheme_id:
            continue
        dated = [line for line in _clean_disbursements(row.disbursements) if _in_period(str(line.get("date") or ""), target.start_on, target.end_on)]
        if not dated or row.id in seen:
            continue
        seen.add(row.id)
        cases += 1
        amount += sum(float(line.get("amount") or 0) for line in dated)
    achieved = cases if target.metric == "case_count" else round(amount, 2)
    target_value = float(target.target_value or 0)
    percent = None if target_value <= 0 else round(achieved / target_value * 100, 1)
    return {
        "achieved": achieved,
        "cases": cases,
        "remaining": None if target_value <= 0 else round(target_value - achieved, 2),
        "percent": percent,
    }


@router.get("/targets")
def list_targets(db: Session = Depends(get_db), _: User = Depends(_admin)) -> dict:
    rows = db.query(SchemeTarget).order_by(SchemeTarget.start_on.desc()).all()
    return {"targets": [{
        "id": str(row.id),
        "lender_id": str(row.lender_id) if row.lender_id else "",
        "scheme_id": str(row.scheme_id) if row.scheme_id else "",
        "period_kind": row.period_kind,
        "start_on": row.start_on,
        "end_on": row.end_on,
        "metric": row.metric,
        "target_value": float(row.target_value or 0),
        "active": row.active,
        **_achievement(db, row),
    } for row in rows]}


@router.post("/targets")
def add_target(body: TargetIn, db: Session = Depends(get_db), user: User = Depends(_admin)) -> dict:
    if body.metric not in {"disbursement_amount", "case_count"}:
        raise HTTPException(status_code=400, detail="Target must be disbursement amount or case count")
    if body.period_kind not in {"month", "quarter", "custom"}:
        raise HTTPException(status_code=400, detail="Period must be month, quarter, or custom")
    if not body.start_on or not body.end_on or body.start_on > body.end_on:
        raise HTTPException(status_code=400, detail="Enter a start date on or before the end date")
    row = SchemeTarget(
        id=uuid4(),
        lender_id=body.lender_id,
        scheme_id=body.scheme_id,
        period_kind=body.period_kind,
        start_on=body.start_on[:10],
        end_on=body.end_on[:10],
        metric=body.metric,
        target_value=round(body.target_value, 2),
        created_by=user.id,
    )
    db.add(row)
    write_audit(db, action="target_saved", actor_user_id=user.id, entity_type="scheme_target", entity_id=str(row.id), detail={"metric": row.metric, "target_value": row.target_value})
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
