"""partner applications: website → CRM approve → DSA user"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_partners"
down_revision: Union[str, None] = "0002_purchases"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("dsa_id", sa.String(length=40), nullable=True))
    op.create_index("ix_users_dsa_id", "users", ["dsa_id"])

    op.create_table(
        "partner_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("website_lead_id", sa.String(80), nullable=False),
        sa.Column("ref_code", sa.String(40), nullable=True),
        sa.Column("dsa_type", sa.String(40), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("city", sa.String(120), nullable=False, server_default=""),
        sa.Column("state", sa.String(120), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("generated_dsa_id", sa.String(40), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("documents", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_partner_applications_website_lead_id", "partner_applications", ["website_lead_id"], unique=True)
    op.create_index("ix_partner_applications_phone", "partner_applications", ["phone"])
    op.create_index("ix_partner_applications_email", "partner_applications", ["email"])
    op.create_index("ix_partner_applications_status", "partner_applications", ["status"])
    op.create_index("ix_partner_applications_generated_dsa_id", "partner_applications", ["generated_dsa_id"])
    op.create_index("ix_partner_applications_user_id", "partner_applications", ["user_id"])
    op.create_index("ix_partner_applications_created_at", "partner_applications", ["created_at"])


def downgrade() -> None:
    op.drop_table("partner_applications")
    op.drop_index("ix_users_dsa_id", table_name="users")
    op.drop_column("users", "dsa_id")
    op.drop_column("users", "phone")
