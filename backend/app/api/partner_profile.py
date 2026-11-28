"""Phase 3: partner public profile + visiting card (authenticated)."""

from __future__ import annotations

import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.entitlements import has_module
from app.models import PartnerProfile, User, VisitingCard
from app.services.document_files import sniff_mime, storage_root

AVATAR_DIR = Path(__file__).resolve().parents[1] / "scripts" / "preset_avatars"
PHOTO_EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
ADMIN_ROLES = {"admin", "ceo", "super_admin"}

router = APIRouter(prefix="/api/partner", tags=["partner-profile"])

PROFILE_ORIGIN = "https://pro.rupeedial.com"


def _owner_id(user: User) -> UUID:
    return user.seat_owner_id or user.id


def _get_owner(db: Session, user: User) -> User:
    oid = _owner_id(user)
    if oid == user.id:
        return user
    owner = db.query(User).filter(User.id == oid).first()
    if not owner:
        raise HTTPException(status_code=400, detail="Seat owner missing")
    return owner


def _slugify(raw: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "", (raw or "").lower())
    return (s or "partner")[:40]


def _unique_slug(db: Session, owner_id: UUID, raw: str) -> str:
    base = _slugify(raw)
    slug = base
    n = 2
    while (
        db.query(PartnerProfile)
        .filter(PartnerProfile.slug == slug, PartnerProfile.owner_user_id != owner_id)
        .first()
    ):
        suffix = str(n)
        slug = f"{base[: 40 - len(suffix)]}{suffix}"
        n += 1
    return slug


class ProfileOut(BaseModel):
    id: UUID | None = None
    firm_name: str = ""
    slug: str = ""
    tagline: str | None = None
    bio: str | None = None
    city: str = ""
    state: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    products: list = Field(default_factory=list)
    theme: dict = Field(default_factory=dict)
    published: bool = False
    directory_featured: bool = False
    public_url: str | None = None
    can_publish: bool = False
    can_feature: bool = False

    model_config = {"from_attributes": True}


class ProfileIn(BaseModel):
    firm_name: str | None = None
    slug: str | None = None
    tagline: str | None = None
    bio: str | None = None
    city: str | None = None
    state: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    products: list[str] | None = None
    theme: dict | None = None
    published: bool | None = None
    directory_featured: bool | None = None


class CardOut(BaseModel):
    id: UUID | None = None
    designation: str | None = None
    company_name: str | None = None
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    city: str | None = None
    photo_url: str | None = None
    logo_url: str | None = None
    products: list = Field(default_factory=list)
    theme: dict = Field(default_factory=dict)
    qr_target_url: str | None = None
    full_name: str = ""

    model_config = {"from_attributes": True}


class CardIn(BaseModel):
    designation: str | None = None
    company_name: str | None = None
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    website: str | None = None
    city: str | None = None
    photo_url: str | None = None
    logo_url: str | None = None
    products: list[str] | None = None
    theme: dict | None = None
    qr_target_url: str | None = None


_PUBLISH_ROLES = {"admin", "ceo", "super_admin", "dsa", "caller", "coordinator", "affiliate"}


def _can_publish_profile(owner: User) -> bool:
    return has_module(owner, "public_profile") or owner.role in _PUBLISH_ROLES


def _profile_out(row: PartnerProfile | None, owner: User) -> ProfileOut:
    can_pub = _can_publish_profile(owner)
    can_feat = has_module(owner, "directory_featured") or owner.role in {"admin", "ceo", "super_admin"}
    if not row:
        return ProfileOut(can_publish=can_pub, can_feature=can_feat, email=owner.email, phone=owner.phone)
    slug = row.slug
    return ProfileOut(
        id=row.id,
        firm_name=row.firm_name,
        slug=slug,
        tagline=row.tagline,
        bio=row.bio,
        city=row.city,
        state=row.state,
        phone=row.phone,
        email=row.email,
        logo_url=row.logo_url,
        cover_url=row.cover_url,
        products=row.products or [],
        theme=row.theme or {},
        published=row.published,
        directory_featured=row.directory_featured,
        public_url=f"{PROFILE_ORIGIN}/{slug}" if slug else None,
        can_publish=can_pub,
        can_feature=can_feat,
    )


@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProfileOut:
    owner = _get_owner(db, user)
    row = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == owner.id).first()
    return _profile_out(row, owner)


@router.put("/profile", response_model=ProfileOut)
def upsert_profile(
    body: ProfileIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProfileOut:
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only account owner can edit public profile")
    owner = user
    row = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == owner.id).first()
    data = body.model_dump(exclude_unset=True)

    # The public link is pro.rupeedial.com/{name}. A new firm name replaces the slug.
    if "firm_name" in data or not row:
        source = data.get("firm_name") or (row.firm_name if row else None) or owner.full_name or "partner"
        data["slug"] = _unique_slug(db, owner.id, str(source))
    elif data.get("slug"):
        data["slug"] = _unique_slug(db, owner.id, str(data["slug"]))

    if data.get("published"):
        if not _can_publish_profile(owner):
            raise HTTPException(status_code=403, detail="Public profile is available after partner approval")
        if row and row.suspended:
            raise HTTPException(status_code=403, detail="Profile is suspended by admin")
    if data.get("directory_featured"):
        if not (has_module(owner, "directory_featured") or owner.role in {"admin", "ceo", "super_admin"}):
            raise HTTPException(status_code=403, detail="Featured listing requires Pro plan")

    if not row:
        if not data.get("firm_name"):
            data["firm_name"] = owner.full_name
        if not data.get("slug"):
            raise HTTPException(status_code=400, detail="Slug required")
        row = PartnerProfile(
            id=uuid4(),
            owner_user_id=owner.id,
            firm_name=data.get("firm_name") or owner.full_name,
            slug=data["slug"],
            phone=data.get("phone") or owner.phone,
            email=data.get("email") or owner.email,
        )
        db.add(row)

    for key, val in data.items():
        if not hasattr(row, key):
            continue
        setattr(row, key, val)

    if not row.published:
        row.directory_featured = False
    if row.suspended:
        row.published = False
        row.directory_featured = False

    page = f"{PROFILE_ORIGIN}/{row.slug}"
    for card in db.query(VisitingCard).filter(VisitingCard.user_id == owner.id).all():
        if not card.qr_target_url or str(card.qr_target_url).startswith(PROFILE_ORIGIN):
            card.qr_target_url = page

    db.commit()
    db.refresh(row)
    return _profile_out(row, owner)


@router.get("/visiting-card", response_model=CardOut)
def get_card(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> CardOut:
    owner = _get_owner(db, user)
    if not (has_module(owner, "visiting_card") or owner.role in {"admin", "ceo", "super_admin"}):
        # Starter+ all have visiting_card; still allow admin
        pass
    card = db.query(VisitingCard).filter(VisitingCard.user_id == user.id).first()
    profile = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == owner.id).first()
    default_qr = f"{PROFILE_ORIGIN}/{profile.slug}" if profile and profile.slug else None
    if not card:
        return CardOut(
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            company_name=profile.firm_name if profile else None,
            city=profile.city if profile else None,
            logo_url=profile.logo_url if profile else None,
            products=list(profile.products or []) if profile else [],
            qr_target_url=default_qr,
        )
    return CardOut(
        id=card.id,
        designation=card.designation,
        company_name=card.company_name,
        phone=card.phone,
        email=card.email,
        whatsapp=card.whatsapp,
        website=card.website,
        city=card.city,
        photo_url=card.photo_url,
        logo_url=card.logo_url,
        products=card.products or [],
        theme=card.theme or {},
        qr_target_url=card.qr_target_url or default_qr,
        full_name=user.full_name,
    )


@router.put("/visiting-card", response_model=CardOut)
def upsert_card(
    body: CardIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CardOut:
    owner = _get_owner(db, user)
    # Per-seat cards: Growth+ has card_per_seat; Starter only owner
    if user.seat_owner_id and user.seat_owner_id != user.id:
        if not has_module(owner, "card_per_seat"):
            raise HTTPException(status_code=403, detail="Per-seat cards require Growth plan or higher")

    card = db.query(VisitingCard).filter(VisitingCard.user_id == user.id).first()
    data = body.model_dump(exclude_unset=True)
    profile = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == owner.id).first()
    if not card:
        card = VisitingCard(
            id=uuid4(),
            user_id=user.id,
            company_name=data.get("company_name") or (profile.firm_name if profile else None),
            phone=data.get("phone") or user.phone,
            email=data.get("email") or user.email,
            city=data.get("city") or (profile.city if profile else None),
            products=data.get("products") or (list(profile.products or []) if profile else []),
            qr_target_url=data.get("qr_target_url")
            or (f"{PROFILE_ORIGIN}/{profile.slug}" if profile else None),
        )
        db.add(card)
    for key, val in data.items():
        if hasattr(card, key):
            setattr(card, key, val)
    db.commit()
    db.refresh(card)
    return CardOut(
        id=card.id,
        designation=card.designation,
        company_name=card.company_name,
        phone=card.phone,
        email=card.email,
        whatsapp=card.whatsapp,
        website=card.website,
        city=card.city,
        photo_url=card.photo_url,
        logo_url=card.logo_url,
        products=card.products or [],
        theme=card.theme or {},
        qr_target_url=card.qr_target_url,
        full_name=user.full_name,
    )


def _photo_folder() -> Path:
    folder = storage_root() / "partner-photos"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _safe_stem(raw: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (raw or "").lower())[:40]


def _store_photo(slug: str, data: bytes, ext: str) -> str:
    folder = _photo_folder()
    stem = _safe_stem(slug)
    for old in folder.glob(f"{stem}.*"):
        old.unlink(missing_ok=True)
    (folder / f"{stem}{ext}").write_bytes(data)
    return f"{settings.crm_public_url.rstrip('/')}/api/public/partner-photo/{stem}"


def _apply_photo(db: Session, row: PartnerProfile, url: str | None) -> str | None:
    row.logo_url = url
    card = db.query(VisitingCard).filter(VisitingCard.user_id == row.owner_user_id).first()
    if card:
        card.photo_url = url
    db.commit()
    return url


def _owned_profile(db: Session, user: User) -> PartnerProfile:
    if user.seat_owner_id and user.seat_owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the account owner can change the profile photo")
    row = db.query(PartnerProfile).filter(PartnerProfile.owner_user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=400, detail="Save the profile once before adding a photo")
    return row


class PresetIn(BaseModel):
    name: str = ""


@router.get("/profile/photo-options")
def photo_options(_user: User = Depends(get_current_user)) -> dict:
    names = sorted(path.stem for path in AVATAR_DIR.glob("avatar-*") if path.suffix.lower() in {".png", ".jpg", ".jpeg"} and path.is_file())
    return {"items": names}


@router.post("/profile/photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_profile(db, user)
    data = await file.read()
    mime = sniff_mime(data, file.content_type or "")
    url = _store_photo(row.slug, data, PHOTO_EXT[mime])
    return {"logo_url": _apply_photo(db, row, url)}


@router.post("/profile/photo/preset")
def choose_profile_preset(
    body: PresetIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_profile(db, user)
    stem = _safe_stem(body.name)
    src = next((AVATAR_DIR / f"{stem}{ext}" for ext in (".png", ".jpg", ".jpeg") if (AVATAR_DIR / f"{stem}{ext}").is_file()), None)
    if src is None:
        raise HTTPException(status_code=404, detail="That icon is not available")
    url = _store_photo(row.slug, src.read_bytes(), ".jpg" if src.suffix.lower() != ".png" else ".png")
    return {"logo_url": _apply_photo(db, row, url)}


@router.delete("/profile/photo")
def remove_profile_photo(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    row = _owned_profile(db, user)
    stem = _safe_stem(row.slug)
    for old in _photo_folder().glob(f"{stem}.*"):
        old.unlink(missing_ok=True)
    _apply_photo(db, row, None)
    return {"logo_url": None}


@router.post("/profile/photo/{slug}")
async def upload_profile_photo_for(
    slug: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    if user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only an admin can set another expert photo")
    row = db.query(PartnerProfile).filter(PartnerProfile.slug == _safe_stem(slug)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Expert not found")
    data = await file.read()
    mime = sniff_mime(data, file.content_type or "")
    url = _store_photo(row.slug, data, PHOTO_EXT[mime])
    return {"logo_url": _apply_photo(db, row, url)}
