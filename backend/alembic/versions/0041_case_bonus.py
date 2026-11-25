"""A lender bonus on the case, separate from the commission rate."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0041_case_bonus"
down_revision: Union[str, None] = "0040_case_disbursements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("bonus_name", sa.String(120), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("bonus_amount", sa.Float(), nullable=False, server_default="0"))
    op.add_column("loan_cases", sa.Column("bonus_partner_percent", sa.Float(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("loan_cases", "bonus_partner_percent")
    op.drop_column("loan_cases", "bonus_amount")
    op.drop_column("loan_cases", "bonus_name")
