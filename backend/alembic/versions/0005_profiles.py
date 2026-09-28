"""Phase 3: partner public profiles + visiting cards"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_profiles"
down_revision: Union[str, None] = "0004_plans"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partner_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("firm_name", sa.String(200), nullable=False, server_default=""),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("tagline", sa.String(240), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("city", sa.String(120), nullable=False, server_default=""),
        sa.Column("state", sa.String(120), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("cover_url", sa.String(500), nullable=True),
        sa.Column("products", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("theme", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("directory_featured", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("owner_user_id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_partner_profiles_owner_user_id", "partner_profiles", ["owner_user_id"])
    op.create_index("ix_partner_profiles_slug", "partner_profiles", ["slug"])
    op.create_index("ix_partner_profiles_published", "partner_profiles", ["published"])

    op.create_table(
        "visiting_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("designation", sa.String(120), nullable=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("whatsapp", sa.String(30), nullable=True),
        sa.Column("website", sa.String(300), nullable=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("products", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("theme", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("qr_target_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_visiting_cards_user_id", "visiting_cards", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_visiting_cards_user_id", table_name="visiting_cards")
    op.drop_table("visiting_cards")
    op.drop_index("ix_partner_profiles_published", table_name="partner_profiles")
    op.drop_index("ix_partner_profiles_slug", table_name="partner_profiles")
    op.drop_index("ix_partner_profiles_owner_user_id", table_name="partner_profiles")
    op.drop_table("partner_profiles")
