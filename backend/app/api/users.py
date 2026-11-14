from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import hash_password
from app.services.mailer import notify_password_issued
from app.db.session import get_db
from app.models import PartnerApplication, User
from app.services.departments import DEPARTMENTS
from app.services.partners import generate_temp_password, remember_issued_password
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
    employee_code: str = ""
    gender: str = ""
    base_location: str = ""
    office: str = ""
    agreement_percent: float | None = None
    issued_password: str = ""
    under_partner: str = ""

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    items: list[UserAdminOut]
    total: int
    pending_partners: int


class ResetPasswordOut(BaseModel):
    success: bool = True
    email: str
    temporary_password: str
    emailed: bool = False


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
    emailed: bool = False


@router.post("", response_model=CreateEmployeeOut)
def create_employee(
    body: CreateEmployeeIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
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
    created = User(
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(temp),
        role=body.role,
        is_active=True,
        department=department,
        sales_grade=grade,
    )
    db.add(created)
    db.flush()
    remember_issued_password(db, created, temp)
    db.commit()
    background.add_task(notify_password_issued, email, body.full_name.strip(), temp, "New login", [admin.email])
    return CreateEmployeeOut(
        email=email,
        full_name=body.full_name.strip(),
        role=body.role,
        temporary_password=temp,
        emailed=settings.smtp_enabled,
    )


class MyCallerIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    phone: str = ""
    base_location: str = ""
    gender: str = ""


def _partner_account(user: User) -> None:
    if user.role not in {"dsa", "affiliate"}:
        raise HTTPException(status_code=403, detail="Partners add their own telecallers")
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="The partner account adds the telecaller")


def _caller_card(row: User) -> dict:
    hr = dict(row.hr_profile or {})
    return {
        "id": str(row.id),
        "full_name": row.full_name or "",
        "email": row.email,
        "phone": row.phone or "",
        "gender": str(hr.get("gender") or ""),
        "base_location": str(hr.get("base_location") or ""),
        "is_active": bool(row.is_active),
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "employee_code": _employee_code(row),
        "issued_password": str(hr.get("issued_password") or ""),
    }


def _own_caller(db: Session, user: User, caller_id: UUID) -> User:
    _partner_account(user)
    row = db.query(User).filter(User.id == caller_id, User.role == "caller", User.seat_owner_id == user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="This telecaller is not on your team")
    return row


@router.get("/my-callers")
def my_callers(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    _partner_account(user)
    rows = (
        db.query(User)
        .filter(User.role == "caller", User.seat_owner_id == user.id)
        .order_by(User.full_name.asc())
        .all()
    )
    return {"items": [_caller_card(row) for row in rows]}


@router.post("/my-callers", response_model=CreateEmployeeOut)
def create_my_caller(
    body: MyCallerIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CreateEmployeeOut:
    _partner_account(user)
    existing_count = (
        db.query(User).filter(User.role == "caller", User.seat_owner_id == user.id, User.is_active.is_(True)).count()
    )
    if existing_count >= 10:
        raise HTTPException(status_code=400, detail="A partner can have up to 10 telecallers")
    email = body.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="This email already has a login")
    temp = generate_temp_password()
    created = User(
        email=email,
        full_name=body.full_name.strip(),
        phone=(body.phone or "").strip()[:30] or None,
        password_hash=hash_password(temp),
        role="caller",
        is_active=True,
        department="SALES",
        sales_grade="T9",
        seat_owner_id=user.id,
        reports_to_user_id=user.id,
        hr_profile={
            "gender": (body.gender or "").strip()[:40],
            "base_location": " ".join((body.base_location or "").split())[:180],
        },
    )
    db.add(created)
    db.flush()
    remember_issued_password(db, created, temp)
    db.commit()
    background.add_task(notify_password_issued, email, created.full_name, temp, "Partner telecaller", [user.email])
    return CreateEmployeeOut(email=email, full_name=created.full_name, role="caller", temporary_password=temp, emailed=settings.smtp_enabled)


class MyCallerEdit(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    phone: str = ""
    base_location: str = ""
    gender: str = ""
    is_active: bool = True


@router.patch("/my-callers/{caller_id}")
def update_my_caller(
    caller_id: UUID,
    body: MyCallerEdit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _own_caller(db, user, caller_id)
    row.full_name = " ".join(body.full_name.split())
    row.phone = (body.phone or "").strip()[:30] or None
    row.is_active = body.is_active
    profile = dict(row.hr_profile or {})
    profile["gender"] = (body.gender or "").strip()[:40]
    profile["base_location"] = " ".join((body.base_location or "").split())[:180]
    row.hr_profile = profile
    db.commit()
    db.refresh(row)
    return _caller_card(row)


@router.post("/my-callers/{caller_id}/reset-password")
def reset_my_caller(
    caller_id: UUID,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Email the telecaller a link to set their own password. The chosen password then shows on this list."""
    row = _own_caller(db, user, caller_id)
    if not settings.smtp_enabled:
        temp = generate_temp_password()
        row.password_hash = hash_password(temp)
        row.is_active = True
        remember_issued_password(db, row, temp)
        db.commit()
        db.refresh(row)
        return {"email": row.email, "emailed": False, "issued_password": temp}
    from app.services.partners import email_password_reset
    from app.services.mailer import send_email

    ok = email_password_reset(row)
    if not ok:
        raise HTTPException(status_code=503, detail="The reset email could not be sent")
    note = (
        f"A password reset link was sent to {row.full_name} ({row.email}).\n"
        "They set the new password from that email. It then shows on the partner's telecaller list and on Users."
    )
    background.add_task(send_email, user.email, f"Reset link sent to {row.full_name}", note)
    admin = (settings.admin_email or "").strip()
    if admin and admin.lower() != (user.email or "").lower():
        background.add_task(send_email, admin, f"Reset link sent to {row.full_name}", note)
    return {"email": row.email, "emailed": True, "issued_password": str((row.hr_profile or {}).get("issued_password") or "")}


@router.get("", response_model=UserListOut)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> UserListOut:
    rows = db.query(User).order_by(User.created_at.desc()).limit(500).all()
    rm_ids = {u.rm2_user_id for u in rows if u.rm2_user_id} | {u.reports_to_user_id for u in rows if u.reports_to_user_id}
    seat_ids = {u.seat_owner_id for u in rows if u.seat_owner_id}
    known_ids = rm_ids | seat_ids
    known = {u.id: u for u in (db.query(User).filter(User.id.in_(known_ids)).all() if known_ids else [])}
    rm_names = {key: person.full_name for key, person in known.items()}
    pending = (
        db.query(PartnerApplication)
        .filter(PartnerApplication.status.in_(["pending", "under_review"]))
        .count()
    )
    saved_password: dict = {}
    for app in db.query(PartnerApplication).all():
        password = str((app.documents or {}).get("issued_password") or "")
        if not password:
            continue
        if app.user_id:
            saved_password[app.user_id] = password
        if app.email:
            saved_password[app.email.lower()] = password
    items = []
    for u in rows:
        fields = _staff_fields(u)
        if not fields["issued_password"]:
            fields["issued_password"] = saved_password.get(u.id) or saved_password.get((u.email or "").lower()) or ""
        items.append(
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
            agreement_percent=u.agreement_percent,
            under_partner=_under_partner(u, known),
            **fields,
        )
        )
    items = items
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
    employee_code: str = ""
    hr_profile: dict = {}


class DeskNode(DeskPerson):
    children: list["DeskNode"] = []


DeskNode.model_rebuild()


class DeskOut(BaseModel):
    me: DeskPerson
    chain: list[DeskPerson]
    team: list[DeskNode]


def _employee_code(row: User) -> str:
    return "RD" + str(row.id).replace("-", "")[:8].upper()


def _under_partner(row: User, owners: dict) -> str:
    if row.role != "caller":
        return ""
    owner = owners.get(row.seat_owner_id) if row.seat_owner_id else None
    if owner and owner.role in {"dsa", "affiliate"}:
        return owner.full_name or owner.email
    return "Company"


def _staff_fields(row: User) -> dict:
    hr = dict(row.hr_profile or {})
    return {
        "employee_code": _employee_code(row),
        "gender": str(hr.get("gender") or ""),
        "base_location": str(hr.get("base_location") or ""),
        "office": str(hr.get("office") or ""),
        "issued_password": str(hr.get("issued_password") or ""),
    }


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
        employee_code=_employee_code(row),
        hr_profile={key: value for key, value in dict(row.hr_profile or {}).items() if key != "issued_password"},
    )


class HrProfileIn(BaseModel):
    personal_email: str = ""
    birthday: str = ""
    gender: str = ""
    address: str = ""
    employment_status: str = ""
    biometric_code: str = ""
    office: str = ""
    whatsapp: str = ""
    facebook: str = ""
    linkedin: str = ""
    skype: str = ""
    twitter: str = ""
    about: str = ""
    base_location: str = ""
    region: str = ""
    line_name: str = ""
    regional_head: str = ""
    confirmation_status: str = ""
    blood_group: str = ""
    father_name: str = ""
    spouse_name: str = ""
    marital_status: str = ""
    marriage_date: str = ""
    nationality: str = ""
    bank_name: str = ""
    account_number: str = ""
    ifsc: str = ""
    pan: str = ""
    uan: str = ""
    agent_code: str = ""
    visa_country: str = ""
    visa_type: str = ""
    visa_expiry: str = ""
    weekly_off: str = ""
    shift_timing: str = ""
    employee_type: str = ""
    esic_eligible: str = ""
    induction: str = ""
    email_quota: str = ""
    pf_eligible: str = ""
    probation_period: str = ""
    notice_period: str = ""
    qualification: str = ""
    institute: str = ""
    aadhaar: str = ""
    specially_abled: str = ""
    emergency_phone: str = ""
    emergency_person: str = ""
    emergency_relation: str = ""
    education_lines: str = ""
    language_lines: str = ""
    photo: str = ""


@router.put("/me/hr-profile")
def save_hr_profile(
    body: HrProfileIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    personal = {
        "photo", "personal_email", "birthday", "gender", "address", "whatsapp", "facebook", "linkedin",
        "skype", "twitter", "about", "blood_group", "father_name", "spouse_name", "marital_status",
        "marriage_date", "nationality", "qualification", "institute", "specially_abled",
        "emergency_phone", "emergency_person", "emergency_relation", "education_lines", "language_lines",
        "office", "base_location",
    }
    payroll = {"bank_name", "account_number", "ifsc", "pan", "uan", "visa_country", "visa_type", "visa_expiry", "aadhaar"}
    company = {
        "employment_status", "biometric_code", "weekly_off", "shift_timing", "employee_type", "esic_eligible",
        "induction", "email_quota", "pf_eligible", "probation_period", "notice_period", "confirmation_status",
        "region", "regional_head", "line_name", "agent_code",
    }
    allowed = set(personal)
    if user.role in ADMIN_ROLES or user.role == "coordinator":
        allowed |= payroll
    if user.role in ADMIN_ROLES:
        allowed |= company
    saved = dict(user.hr_profile or {})
    limits = {"about": 1000, "education_lines": 2000, "language_lines": 2000, "photo": 180000, "address": 300}
    for key, value in body.model_dump().items():
        if key not in allowed:
            continue
        raw = str(value or "").strip()
        if key == "photo":
            if raw and not raw.startswith("data:image/"):
                raise HTTPException(status_code=400, detail="Profile photo must be an image")
            saved[key] = raw[:180000]
            continue
        text = raw if key in {"education_lines", "language_lines"} else " ".join(raw.split())
        saved[key] = text[: limits.get(key, 180)]
    user.hr_profile = saved
    db.commit()
    public = dict(saved)
    public.pop("issued_password", None)
    return public


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


class LoginEditIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    phone: str = ""
    department: str | None = None
    is_active: bool = True
    role: str | None = None
    gender: str = ""
    base_location: str = ""
    office: str = ""
    agreement_percent: float | None = None


def _admin_out(db: Session, user: User) -> UserAdminOut:
    manager = db.query(User).filter(User.id == user.reports_to_user_id).first() if user.reports_to_user_id else None
    owner = db.query(User).filter(User.id == user.seat_owner_id).first() if user.seat_owner_id else None
    owners = {owner.id: owner} if owner else {}
    return UserAdminOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        phone=user.phone,
        dsa_id=user.dsa_id,
        is_active=user.is_active,
        kyc_verified=bool(user.kyc_verified),
        sales_grade=user.sales_grade,
        sales_title=grade_title(user.sales_grade),
        reports_to_user_id=user.reports_to_user_id,
        reports_to_name=manager.full_name if manager else None,
        finance_level=user.finance_level,
        department=user.department,
        created_at=user.created_at.isoformat() if user.created_at else None,
        agreement_percent=user.agreement_percent,
        under_partner=_under_partner(user, owners),
        **_staff_fields(user),
    )


@router.patch("/{user_id}", response_model=UserAdminOut)
def update_login(
    user_id: UUID,
    body: LoginEditIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
) -> UserAdminOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and not body.is_active:
        raise HTTPException(status_code=400, detail="You cannot disable your own login")
    user.full_name = " ".join(body.full_name.split())
    phone = "".join(ch for ch in body.phone if ch.isdigit())
    user.phone = phone[:15] or None
    user.is_active = body.is_active
    staff = user.role in {"coordinator", "caller"} and not user.finance_level and user.role not in ADMIN_ROLES
    if staff and body.role in {"coordinator", "caller"}:
        user.role = body.role
        if user.role == "caller":
            user.department = "SALES"
            user.sales_grade = user.sales_grade or "T9"
        else:
            department = (body.department or user.department or "").strip()
            if department not in DEPARTMENTS:
                raise HTTPException(status_code=400, detail="Pick a department")
            user.department = department
            user.sales_grade = user.sales_grade or {"SALES": "T8", "OPS": "OP-E", "HR": "HR-E", "ITM": "MK-E", "ACC": "AC-E"}[department]
    if user.role in {"dsa", "affiliate"} and body.agreement_percent is not None:
        percent = float(body.agreement_percent)
        if not 50 <= percent <= 95:
            raise HTTPException(status_code=400, detail="Agreement percent must be from 50 to 95")
        user.agreement_percent = percent
        from app.models import LoanCase

        for case in db.query(LoanCase).filter(LoanCase.partner_user_id == user.id, LoanCase.payout_status != "paid").all():
            case.payable_percent = percent
    profile = dict(user.hr_profile or {})
    for key, value in (("gender", body.gender), ("base_location", body.base_location), ("office", body.office)):
        profile[key] = " ".join(str(value or "").split())[:180]
    user.hr_profile = profile
    db.commit()
    db.refresh(user)
    return _admin_out(db, user)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_password(
    user_id: UUID,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
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
    background.add_task(notify_password_issued, user.email, user.full_name, temp, "Reset by admin", [admin.email])
    return ResetPasswordOut(email=user.email, temporary_password=temp, emailed=settings.smtp_enabled)
