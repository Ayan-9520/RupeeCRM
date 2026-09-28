"""Public partner directory + profile by slug (Phase 3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.entitlements import has_module
from app.models import PartnerProfile, User

router = APIRouter(prefix="/api/public", tags=["public-directory"])

PUBLIC_SITE = "https://rupeedial.com"


class DirectoryItem(BaseModel):
    firm_name: str
    slug: str
    tagline: str | None = None
    city: str
    state: str | None = None
    logo_url: str | None = None
    products: list = Field(default_factory=list)
    featured: bool = False
    public_url: str


class DirectoryListOut(BaseModel):
    items: list[DirectoryItem]
    total: int


class PublicProfileOut(BaseModel):
    firm_name: str
    slug: str
    tagline: str | None = None
    bio: str | None = None
    city: str
    state: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    products: list = Field(default_factory=list)
    theme: dict = Field(default_factory=dict)
    featured: bool = False
    contact_name: str | None = None
    public_url: str
    subdomain_hint: str | None = None


def _owner_allowed(owner: User | None) -> bool:
    if not owner:
        return False
    if owner.role in {"admin", "ceo", "super_admin"}:
        return True
    return has_module(owner, "public_profile")


@router.get("/directory/partners", response_model=DirectoryListOut)
def list_directory(
    q: str | None = None,
    city: str | None = None,
    featured: bool | None = None,
    limit: int = Query(default=48, ge=1, le=100),
    db: Session = Depends(get_db),
) -> DirectoryListOut:
    rows = (
        db.query(PartnerProfile)
        .filter(PartnerProfile.published.is_(True), PartnerProfile.suspended.is_(False))
        .order_by(PartnerProfile.directory_featured.desc(), PartnerProfile.firm_name.asc())
        .limit(200)
        .all()
    )
    items: list[DirectoryItem] = []
    for row in rows:
        owner = db.query(User).filter(User.id == row.owner_user_id).first()
        if not _owner_allowed(owner):
            continue
        if featured is True and not row.directory_featured:
            continue
        if city and city.lower() not in (row.city or "").lower():
            continue
        if q:
            blob = f"{row.firm_name} {row.tagline or ''} {row.city} {' '.join(row.products or [])}".lower()
            if q.lower() not in blob:
                continue
        items.append(
            DirectoryItem(
                firm_name=row.firm_name,
                slug=row.slug,
                tagline=row.tagline,
                city=row.city,
                state=row.state,
                logo_url=row.logo_url,
                products=row.products or [],
                featured=bool(row.directory_featured),
                public_url=f"{PUBLIC_SITE}/p/{row.slug}",
            )
        )
    return DirectoryListOut(items=items[:limit], total=len(items))


@router.get("/partners/{slug}", response_model=PublicProfileOut)
def get_public_profile(slug: str, db: Session = Depends(get_db)) -> PublicProfileOut:
    row = (
        db.query(PartnerProfile)
        .filter(
            PartnerProfile.slug == slug.lower().strip(),
            PartnerProfile.published.is_(True),
            PartnerProfile.suspended.is_(False),
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    owner = db.query(User).filter(User.id == row.owner_user_id).first()
    if not _owner_allowed(owner):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    return PublicProfileOut(
        firm_name=row.firm_name,
        slug=row.slug,
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
        featured=bool(row.directory_featured),
        contact_name=owner.full_name if owner else None,
        public_url=f"{PUBLIC_SITE}/p/{row.slug}",
        subdomain_hint=f"{row.slug}.rupeedial.com",
    )
