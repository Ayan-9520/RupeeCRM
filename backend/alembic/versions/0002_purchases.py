"""lead purchases for my-leads pipeline

Revision ID: 0002_purchases
Revises: 0001_initial
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_purchases"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lead_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("price_paid", sa.Float(), nullable=False, server_default="0"),
        sa.Column("pipeline_stage", sa.String(60), nullable=False, server_default="new"),
        sa.Column("notes", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("next_followup_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deal_value", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_lead_purchases_lead_id", "lead_purchases", ["lead_id"])
    op.create_index("ix_lead_purchases_buyer_user_id", "lead_purchases", ["buyer_user_id"])
    op.create_index("ix_lead_purchases_pipeline_stage", "lead_purchases", ["pipeline_stage"])
    op.create_index("ix_lead_purchases_created_at", "lead_purchases", ["created_at"])


def downgrade() -> None:
    op.drop_table("lead_purchases")
