"""Scheme dates and measurable targets. Does not change case money."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0046_scheme_targets"
down_revision: Union[str, None] = "0045_dump_approval"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lender_schemes", sa.Column("code", sa.String(40), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("description", sa.Text(), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("category", sa.String(80), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("start_on", sa.String(10), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("end_on", sa.String(10), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("notes", sa.Text(), nullable=False, server_default=""))
    op.add_column("lender_schemes", sa.Column("created_by", UUID(as_uuid=True), nullable=True))
    op.add_column("lender_schemes", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("lender_schemes", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.add_column("loan_cases", sa.Column("scheme_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_loan_cases_scheme_id", "loan_cases", ["scheme_id"])
    op.create_table(
        "scheme_targets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lender_id", UUID(as_uuid=True), nullable=True),
        sa.Column("scheme_id", UUID(as_uuid=True), nullable=True),
        sa.Column("period_kind", sa.String(20), nullable=False, server_default="custom"),
        sa.Column("start_on", sa.String(10), nullable=False, server_default=""),
        sa.Column("end_on", sa.String(10), nullable=False, server_default=""),
        sa.Column("metric", sa.String(40), nullable=False, server_default="disbursement_amount"),
        sa.Column("target_value", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("scheme_targets")
    op.drop_index("ix_loan_cases_scheme_id", table_name="loan_cases")
    op.drop_column("loan_cases", "scheme_id")
    for name in ("updated_at", "created_at", "created_by", "notes", "end_on", "start_on", "category", "description", "code"):
        op.drop_column("lender_schemes", name)
