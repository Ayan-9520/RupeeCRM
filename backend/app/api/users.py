from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models import PartnerApplication, User
from app.services.departments import DEPARTMENTS
from app.services.partners import generate_temp_password
from app.services.sales_grades import GRADES, downline_ids, grade_rank, grade_title

router = APIRouter(prefix="/api/users", tags=["users"])

ADMIN_ROLES = {"admin", "ceo", "super_admin"}


class UserAdminOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    phone: str | None = None
    dsa_id: str | None = None
    is_active: bool
    kyc_verified: bool = False
    rm2_name: str | None = None
    rm2_status: str = "Not set"
    sales_grade: str | None = None
    sales_title: str | None = None
    reports_to_user_id: UUID | None = None
    reports_to_name: str | None = None
    monthly_target_inr: float | None = None
    monthly_login_target_inr: float | None = None
    finance_level: str | None = None
    department: str | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    items: list[UserAdminOut]
    total: int
    pending_partners: int


class ResetPasswordOut(BaseModel):
    success: bool = True
    email: str
    temporary_password: str


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user


class CreateEmployeeIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    role: str = Field(pattern="^(coordinator|caller)$")
    department: str | None = None


class CreateEmployeeOut(BaseModel):
    email: str
    full_name: str
    role: str
    temporary_password: str


@router.post("", response_model=CreateEmployeeOut)
def create_employee(
    body: CreateEmployeeIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> CreateEmployeeOut:
    email = body.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="This email already has a login")
    starter = {"SALES": "T8", "OPS": "OP-E", "HR": "HR-E", "ITM": "MK-E", "ACC": "AC-E"}
    if body.role == "caller":
        department, grade = "SALES", "T9"
    else:
        department = (body.department or "").strip()
        if department not in DEPARTMENTS:
            raise HTTPException(status_code=400, detail="Pick a department")
        grade = starter[department]
    temp = generate_temp_password()
    db.add(
        User(
            email=email,
            full_name=body.full_name.strip(),
            password_hash=hash_password(temp),
            role=body.role,
            is_active=True,
            department=department,
            sales_grade=grade,
        )
    )
    db.commit()
    return CreateEmployeeOut(email=email, full_name=body.full_name.strip(), role=body.role, temporary_password=temp)


@router.get("", response_model=UserListOut)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserListOut:
    rows = db.query(User).order_by(User.created_at.desc()).limit(500).all()
    rm_ids = {u.rm2_user_id for u in rows if u.rm2_user_id} | {u.reports_to_user_id for u in rows if u.reports_to_user_id}
    rm_names = {
        u.id: u.full_name
        for u in (db.query(User).filter(User.id.in_(rm_ids)).all() if rm_ids else [])
    }
    pending = (
        db.query(PartnerApplication)
        .filter(PartnerApplication.status.in_(["pending", "under_review"]))
        .count()
    )
    items = [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            phone=u.phone,
            dsa_id=u.dsa_id,
            is_active=u.is_active,
            kyc_verified=bool(u.kyc_verified),
            rm2_name=rm_names.get(u.rm2_user_id) if u.rm2_user_id else None,
            rm2_status="Assigned" if u.rm2_user_id else "Not set",
            sales_grade=u.sales_grade,
            sales_title=grade_title(u.sales_grade),
            reports_to_user_id=u.reports_to_user_id,
            reports_to_name=rm_names.get(u.reports_to_user_id) if u.reports_to_user_id else None,
            monthly_target_inr=u.monthly_target_inr,
            monthly_login_target_inr=u.monthly_login_target_inr,
            finance_level=u.finance_level,
            department=u.department,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in rows
    ]
    return UserListOut(items=items, total=len(items), pending_partners=pending)


class GradeListOut(BaseModel):
    items: list[dict]


class DesignationIn(BaseModel):
    sales_grade: str | None = None
    reports_to_user_id: UUID | None = None


@router.get("/grades", response_model=GradeListOut)
def list_grades(_user: User = Depends(get_current_user)) -> GradeListOut:
    return GradeListOut(items=[{"code": code, "title": title} for code, title in GRADES.items()])


@router.get("/downline", response_model=UserListOut)
def my_downline(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> UserListOut:
    if user.role in ADMIN_ROLES:
        return list_users(db, user)
    allowed = downline_ids(db, user.id) | {user.id}
    rows = db.query(User).filter(User.id.in_(allowed)).order_by(User.full_name.asc()).all()
    names = {u.id: u.full_name for u in rows}
    items = [
        UserAdminOut(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role,
            phone=u.phone,
            dsa_id=u.dsa_id,
            is_active=u.is_active,
            kyc_verified=bool(u.kyc_verified),
            sales_grade=u.sales_grade,
            sales_title=grade_title(u.sales_grade),
            reports_to_user_id=u.reports_to_user_id,
            reports_to_name=names.get(u.reports_to_user_id) if u.reports_to_user_id else None,
            monthly_target_inr=u.monthly_target_inr,
            monthly_login_target_inr=u.monthly_login_target_inr,
            created_at=u.created_at.isoformat() if u.created_at else None,
        )
        for u in rows
    ]
    return UserListOut(items=items, total=len(items), pending_partners=0)


class DeskPerson(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone: str | None = None
    department: str | None = None
    sales_grade: str | None = None
    sales_title: str | None = None
    finance_level: str | None = None
    reports_to_name: str | None = None
    joined_at: str | None = None


class DeskNode(DeskPerson):
    children: list["DeskNode"] = []


DeskNode.model_rebuild()


class DeskOut(BaseModel):
    me: DeskPerson
    chain: list[DeskPerson]
    team: list[DeskNode]


def _desk_person(row: User, names: dict) -> DeskPerson:
    return DeskPerson(
        id=row.id,
        full_name=row.full_name,
        email=row.email,
        phone=row.phone,
        department=row.department,
        sales_grade=row.sales_grade,
        sales_title=grade_title(row.sales_grade),
        finance_level=row.finance_level,
        reports_to_name=names.get(row.reports_to_user_id) if row.reports_to_user_id else None,
        joined_at=row.created_at.isoformat() if row.created_at else None,
    )


@router.get("/me/desk", response_model=DeskOut)
def my_desk(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DeskOut:
    rows = db.query(User).filter(User.is_active.is_(True)).all()
    names = {row.id: row.full_name for row in rows}
    by_manager: dict = {}
    for row in rows:
        if row.reports_to_user_id:
            by_manager.setdefault(row.reports_to_user_id, []).append(row)

    def node(row: User, seen: set) -> DeskNode | None:
        if row.id in seen:
            return None
        seen.add(row.id)
        children = []
        for child in sorted(by_manager.get(row.id, []), key=lambda item: item.full_name.lower()):
            built = node(child, seen)
            if built:
                children.append(built)
        base = _desk_person(row, names)
        return DeskNode(**base.model_dump(), children=children)

    team: list[DeskNode] = []
    for child in sorted(by_manager.get(user.id, []), key=lambda item: item.full_name.lower()):
        built = node(child, {user.id})
        if built:
            team.append(built)

    chain: list[DeskPerson] = []
    seen_up: set = set()
    cursor = user
    while cursor.reports_to_user_id and cursor.reports_to_user_id not in seen_up and len(chain) < 12:
        seen_up.add(cursor.id)
        manager = next((row for row in rows if row.id == cursor.reports_to_user_id), None)
        if not manager:
            break
        chain.append(_desk_person(manager, names))
        cursor = manager
    return DeskOut(me=_desk_person(user, names), chain=chain, team=team)


@router.put("/{user_id}/designation", response_model=UserAdminOut)
def set_designation(
    user_id: UUID,
    body: DesignationIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserAdminOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.sales_grade and body.sales_grade not in GRADES:
        raise HTTPException(status_code=400, detail="Unknown designation")
    manager = None
    if body.reports_to_user_id:
        if body.reports_to_user_id == user.id:
            raise HTTPException(status_code=400, detail="A person cannot report to themselves")
        manager = db.query(User).filter(User.id == body.reports_to_user_id).first()
        if not manager:
            raise HTTPException(status_code=404, detail="Manager not found")
        their_rank = grade_rank(body.sales_grade or user.sales_grade)
        manager_rank = grade_rank(manager.sales_grade)
        if their_rank and manager_rank and manager_rank >= their_rank:
            raise HTTPException(status_code=400, detail="A person reports to someone more senior. The CEO is the top.")
        if manager.id in downline_ids(db, user.id):
            raise HTTPException(status_code=400, detail="That person already reports up to this user")
    user.sales_grade = body.sales_grade or None
    user.reports_to_user_id = manager.id if manager else None
    db.commit()
    db.refresh(user)
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        is_active=user.is_active,
        kyc_verified=bool(user.kyc_verified),
        sales_grade=user.sales_grade,
        sales_title=grade_title(user.sales_grade),
        reports_to_user_id=user.reports_to_user_id,
        reports_to_name=manager.full_name if manager else None,
        monthly_target_inr=user.monthly_target_inr,
        monthly_login_target_inr=user.monthly_login_target_inr,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


class TargetsIn(BaseModel):
    monthly_target_inr: float | None = Field(default=None, ge=0, le=100_000_000)
    monthly_login_target_inr: float | None = Field(default=None, ge=0, le=100_000_000)


@router.put("/{user_id}/targets", response_model=UserAdminOut)
def set_targets(
    user_id: UUID,
    body: TargetsIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserAdminOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if "monthly_target_inr" in body.model_fields_set:
        user.monthly_target_inr = body.monthly_target_inr or None
    if "monthly_login_target_inr" in body.model_fields_set:
        user.monthly_login_target_inr = body.monthly_login_target_inr or None
    db.commit()
    db.refresh(user)
    manager = db.query(User).filter(User.id == user.reports_to_user_id).first() if user.reports_to_user_id else None
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        is_active=user.is_active,
        kyc_verified=bool(user.kyc_verified),
        sales_grade=user.sales_grade,
        sales_title=grade_title(user.sales_grade),
        reports_to_user_id=user.reports_to_user_id,
        reports_to_name=manager.full_name if manager else None,
        monthly_target_inr=user.monthly_target_inr,
        monthly_login_target_inr=user.monthly_login_target_inr,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post("/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_password(
    user_id: UUID,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> ResetPasswordOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    temp = generate_temp_password()
    user.password_hash = hash_password(temp)
    user.is_active = True
    from app.services.partners import remember_issued_password

    remember_issued_password(db, user, temp)
    db.commit()
    return ResetPasswordOut(email=user.email, temporary_password=temp)
