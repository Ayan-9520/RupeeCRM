"""Phase 3: partner public profile + visiting card (authenticated)."""

from __future__ import annotations

import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.entitlements import has_module
from app.models import PartnerProfile, User, VisitingCard

router = APIRouter(prefix="/api/partner", tags=["partner-profile"])

PUBLIC_SITE = "https://rupeedial.com"


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
    s = re.sub(r"[^a-z0-9]+", "-", (raw or "").lower().strip())
    s = re.sub(r"-+", "-", s).strip("-")
    return (s or "partner")[:60]


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


def _profile_out(row: PartnerProfile | None, owner: User) -> ProfileOut:
    can_pub = has_module(owner, "public_profile") or owner.role in {"admin", "ceo", "super_admin"}
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
        public_url=f"{PUBLIC_SITE}/p/{slug}" if slug else None,
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

    if "slug" in data and data["slug"] is not None:
        data["slug"] = _slugify(str(data["slug"]))
    elif not row:
        base = _slugify(data.get("firm_name") or owner.full_name or "partner")
        data["slug"] = base

    if data.get("published"):
        if not (has_module(owner, "public_profile") or owner.role in {"admin", "ceo", "super_admin"}):
            raise HTTPException(status_code=403, detail="Public profile requires Growth plan or higher")
        if not owner.kyc_verified and owner.role not in {"admin", "ceo", "super_admin"}:
            raise HTTPException(status_code=403, detail="KYC verification required before publishing")
        if row and row.suspended:
            raise HTTPException(status_code=403, detail="Profile is suspended by admin")
    if data.get("directory_featured"):
        if not (has_module(owner, "directory_featured") or owner.role in {"admin", "ceo", "super_admin"}):
            raise HTTPException(status_code=403, detail="Featured listing requires Pro plan")

    slug = data.get("slug") or (row.slug if row else None)
    if slug:
        clash = (
            db.query(PartnerProfile)
            .filter(PartnerProfile.slug == slug, PartnerProfile.owner_user_id != owner.id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="Slug already taken")

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
    default_qr = f"{PUBLIC_SITE}/p/{profile.slug}" if profile and profile.slug else None
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
            or (f"{PUBLIC_SITE}/p/{profile.slug}" if profile else None),
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
