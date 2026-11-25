"""Lender application number and disbursement lines on a case."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0040_case_disbursements"
down_revision: Union[str, None] = "0039_case_customer_share"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("application_no", sa.String(80), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("lan", sa.String(80), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("roi", sa.Float(), nullable=False, server_default="0"))
    op.add_column("loan_cases", sa.Column("tenure_months", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("loan_cases", sa.Column("disbursements", JSONB, nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("loan_cases", "disbursements")
    op.drop_column("loan_cases", "tenure_months")
    op.drop_column("loan_cases", "roi")
    op.drop_column("loan_cases", "lan")
    op.drop_column("loan_cases", "application_no")
