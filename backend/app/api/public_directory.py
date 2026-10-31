"""Public partner directory + profile by slug."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import PartnerProfile, User, VisitingCard
from app.services.partners import backfill_approved_profiles

router = APIRouter(prefix="/api/public", tags=["public-directory"])

PROFILE_ORIGIN = "https://pro.rupeedial.com"


class DirectoryItem(BaseModel):
    firm_name: str
    slug: str
    tagline: str | None = None
    city: str
    state: str | None = None
    pincode: str | None = None
    logo_url: str | None = None
    products: list = Field(default_factory=list)
    featured: bool = False
    contact_name: str | None = None
    designation: str | None = None
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
    pincode: str | None = None
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    designation: str | None = None
    languages: str | None = None
    years: str | None = None
    since: str | None = None
    logo_url: str | None = None
    cover_url: str | None = None
    products: list = Field(default_factory=list)
    theme: dict = Field(default_factory=dict)
    featured: bool = False
    contact_name: str | None = None
    public_url: str
    subdomain_hint: str | None = None


def _text(theme: dict, key: str) -> str:
    value = theme.get(key)
    if value is None:
        return ""
    return str(value).strip()


def _card_bits(row: PartnerProfile, card: VisitingCard | None) -> dict:
    theme = row.theme if isinstance(row.theme, dict) else {}
    show_phone = theme.get("show_phone", True) is not False
    show_whatsapp = theme.get("show_whatsapp") is True
    whatsapp = _text(theme, "whatsapp") or ((card.whatsapp or "").strip() if card else "")
    designation = _text(theme, "designation") or ((card.designation or "").strip() if card else "")
    photo = row.logo_url or (card.photo_url if card and card.photo_url else None)
    return {
        "pincode": _text(theme, "pincode") or None,
        "languages": _text(theme, "languages") or None,
        "years": _text(theme, "years") or None,
        "since": _text(theme, "since") or None,
        "designation": designation or None,
        "whatsapp": whatsapp if show_whatsapp and whatsapp else None,
        "phone": row.phone if show_phone else None,
        "logo_url": photo,
        "theme": theme,
    }


@router.get("/directory/partners", response_model=DirectoryListOut)
def list_directory(
    q: str | None = None,
    city: str | None = None,
    pincode: str | None = None,
    featured: bool | None = None,
    limit: int = Query(default=48, ge=1, le=100),
    db: Session = Depends(get_db),
) -> DirectoryListOut:
    backfill_approved_profiles(db)
    rows = (
        db.query(PartnerProfile)
        .filter(PartnerProfile.published.is_(True), PartnerProfile.suspended.is_(False))
        .order_by(PartnerProfile.directory_featured.desc(), PartnerProfile.firm_name.asc())
        .limit(200)
        .all()
    )
    items: list[DirectoryItem] = []
    pin = (pincode or "").strip()
    for row in rows:
        owner = db.query(User).filter(User.id == row.owner_user_id).first()
        if not owner:
            continue
        bits = _card_bits(row, None)
        row_pin = bits["pincode"] or ""
        if featured is True and not row.directory_featured:
            continue
        if city and city.lower() not in (row.city or "").lower():
            continue
        if pin and pin not in row_pin:
            continue
        if q:
            blob = " ".join(
                [
                    row.firm_name or "",
                    row.tagline or "",
                    row.city or "",
                    row_pin,
                    owner.full_name or "",
                    " ".join(row.products or []),
                ]
            ).lower()
            if q.lower() not in blob:
                continue
        items.append(
            DirectoryItem(
                firm_name=row.firm_name,
                slug=row.slug,
                tagline=row.tagline,
                city=row.city,
                state=row.state,
                pincode=bits["pincode"],
                logo_url=bits["logo_url"],
                products=row.products or [],
                featured=bool(row.directory_featured),
                contact_name=owner.full_name,
                designation=bits["designation"],
                public_url=f"{PROFILE_ORIGIN}/{row.slug}",
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
    if not owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partner not found")
    card = db.query(VisitingCard).filter(VisitingCard.user_id == owner.id).first()
    bits = _card_bits(row, card)
    show_email = bits["theme"].get("show_email", True) is not False
    return PublicProfileOut(
        firm_name=row.firm_name,
        slug=row.slug,
        tagline=row.tagline,
        bio=row.bio,
        city=row.city,
        state=row.state,
        pincode=bits["pincode"],
        phone=bits["phone"],
        email=row.email if show_email else None,
        whatsapp=bits["whatsapp"],
        designation=bits["designation"],
        languages=bits["languages"],
        years=bits["years"],
        since=bits["since"],
        logo_url=bits["logo_url"],
        cover_url=row.cover_url,
        products=row.products or [],
        theme=bits["theme"],
        featured=bool(row.directory_featured),
        contact_name=owner.full_name,
        public_url=f"{PROFILE_ORIGIN}/{row.slug}",
        subdomain_hint=f"pro.rupeedial.com/{row.slug}",
    )
