import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="admin")
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    dsa_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Phase 2 — subscription
    plan_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    plan_cycle: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plan_status: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    plan_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    plan_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    wallet_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    seat_owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    payout_bank: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    applicant_name: Mapped[str] = mapped_column(String(200), nullable=False)
    full_phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    masked_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    loan_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    monthly_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    employment_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    loan_type: Mapped[str] = mapped_column(String(40), nullable=False, default="personal")
    product_category: Mapped[str] = mapped_column(String(40), nullable=False, default="loan")
    product_subtype: Mapped[str | None] = mapped_column(String(80), nullable=True)
    product_type_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="available", index=True)
    score: Mapped[str] = mapped_column(String(20), nullable=False, default="cold")
    price: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    source: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    utm_source: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(120), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_marketplace: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    sale_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fraud_risk: Mapped[str] = mapped_column(String(40), nullable=False, default="low")
    workspace_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    product_details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    quality_factors: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    website_lead_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def lead_grade(self) -> str:
        from app.services.lead_grades import grade_code

        return grade_code(self)

    @property
    def listing_type(self) -> str:
        from app.services.lead_grades import listing_type

        return listing_type(self)


DEFAULT_PIPELINE_STAGES = [
    "new",
    "contacted",
    "docs_collected",
    "bank_submitted",
    "sanctioned",
    "disbursed",
    "rejected",
]


class LeadPurchase(Base):
    __tablename__ = "lead_purchases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    price_paid: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    pipeline_stage: Mapped[str] = mapped_column(String(60), nullable=False, default="new", index=True)
    notes: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    next_followup_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deal_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


PARTNER_STATUSES = ("pending", "under_review", "approved", "rejected")


class PartnerApplication(Base):
    """Website partner apply → CRM review → DSA login."""

    __tablename__ = "partner_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    website_lead_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    ref_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    dsa_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending", index=True)
    generated_dsa_id: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    documents: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class PartnerProfile(Base):
    """Public firm profile — Growth+ published; Pro can be directory_featured."""

    __tablename__ = "partner_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    firm_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    slug: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    tagline: Mapped[str | None] = mapped_column(String(240), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    products: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    theme: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    directory_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class VisitingCard(Base):
    """Digital visiting card per seat user."""

    __tablename__ = "visiting_cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    designation: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(30), nullable=True)
    website: Mapped[str | None] = mapped_column(String(300), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    products: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    theme: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    qr_target_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class PayoutRequest(Base):
    """Partner bank payout request — manual admin settle (no RazorpayX yet)."""

    __tablename__ = "payout_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="pending", index=True)
    bank_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    utr: Mapped[str | None] = mapped_column(String(80), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

class AuditEvent(Base):
    """Append-only trust audit trail (Phase 7)."""

    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class CommissionSettings(Base):
    """Admin payout percent on disbursed cases. Default 1 until changed."""

    __tablename__ = "commission_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_percent: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class NetworkSettings(Base):
    """Admin-editable network levels and revenue share. Not hardcoded in payouts."""

    __tablename__ = "network_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    levels: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Certificate(Base):
    """Academy certificate issued once per user and course on a passing quiz score."""

    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    course_slug: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    course_title: Mapped[str] = mapped_column(String(160), nullable=False)
    badge: Mapped[str] = mapped_column(String(80), nullable=False)
    score_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    certificate_no: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NetworkLink(Base):
    __tablename__ = "network_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parent_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    child_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    invite_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    invite_phone: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    invite_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    invite_code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="invited", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
