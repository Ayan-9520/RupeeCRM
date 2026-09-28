"""Phase 6: bank payout requests + user payout_bank"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_payouts"
down_revision: Union[str, None] = "0005_profiles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "payout_bank",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.create_table(
        "payout_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("bank_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("utr", sa.String(80), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_payout_requests_user_id", "payout_requests", ["user_id"])
    op.create_index("ix_payout_requests_status", "payout_requests", ["status"])
    op.create_index("ix_payout_requests_created_at", "payout_requests", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_payout_requests_created_at", table_name="payout_requests")
    op.drop_index("ix_payout_requests_status", table_name="payout_requests")
    op.drop_index("ix_payout_requests_user_id", table_name="payout_requests")
    op.drop_table("payout_requests")
    op.drop_column("users", "payout_bank")
