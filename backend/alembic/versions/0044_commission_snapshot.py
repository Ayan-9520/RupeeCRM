"""Store the commission inputs from the moment a case is first counted."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0044_commission_snapshot"
down_revision: Union[str, None] = "0043_lender_master"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "commission_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("loan_case_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("lender_id", UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("method", sa.String(40), nullable=False, server_default="percent_of_disbursed_base"),
        sa.Column("base_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("receivable_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("payable_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("receivable_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("payable_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("bonus_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("bonus_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("bonus_partner_percent", sa.Float(), nullable=False, server_default="0"),
        sa.Column("loyalty_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("inputs", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("loan_case_id", "version", name="uq_commission_snapshot_version"),
    )


def downgrade() -> None:
    op.drop_table("commission_snapshots")
