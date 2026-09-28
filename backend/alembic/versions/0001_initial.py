"""initial users + leads

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("applicant_name", sa.String(200), nullable=False),
        sa.Column("full_phone", sa.String(30), nullable=False),
        sa.Column("masked_phone", sa.String(30), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("city", sa.String(120), nullable=False),
        sa.Column("state", sa.String(120), nullable=True),
        sa.Column("loan_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("monthly_income", sa.Float(), nullable=True),
        sa.Column("employment_type", sa.String(80), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("loan_type", sa.String(40), nullable=False, server_default="personal"),
        sa.Column("product_category", sa.String(40), nullable=False, server_default="loan"),
        sa.Column("product_subtype", sa.String(80), nullable=True),
        sa.Column("product_type_id", sa.String(80), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="available"),
        sa.Column("score", sa.String(20), nullable=False, server_default="cold"),
        sa.Column("price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("source", sa.String(80), nullable=True),
        sa.Column("utm_source", sa.String(120), nullable=True),
        sa.Column("utm_medium", sa.String(120), nullable=True),
        sa.Column("utm_campaign", sa.String(120), nullable=True),
        sa.Column("is_marketplace", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sale_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("fraud_risk", sa.String(40), nullable=False, server_default="low"),
        sa.Column("workspace_id", sa.String(80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("product_details", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("quality_factors", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("quality_score", sa.Integer(), nullable=True),
        sa.Column("website_lead_id", sa.String(120), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_leads_full_phone", "leads", ["full_phone"])
    op.create_index("ix_leads_status", "leads", ["status"])
    op.create_index("ix_leads_source", "leads", ["source"])
    op.create_index("ix_leads_website_lead_id", "leads", ["website_lead_id"])
    op.create_index("ix_leads_created_at", "leads", ["created_at"])


def downgrade() -> None:
    op.drop_table("leads")
    op.drop_table("users")
