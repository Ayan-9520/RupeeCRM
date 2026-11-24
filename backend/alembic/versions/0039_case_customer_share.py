"""Customer address and stakeholder share on a case file."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0039_case_customer_share"
down_revision: Union[str, None] = "0038_case_bankers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("customer", JSONB, nullable=False, server_default="{}"))
    op.add_column("loan_cases", sa.Column("stakeholders", JSONB, nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("loan_cases", "stakeholders")
    op.drop_column("loan_cases", "customer")
