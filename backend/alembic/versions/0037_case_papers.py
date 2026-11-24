"""Sanction letter and bank confirmation on a case file."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0037_case_papers"
down_revision: Union[str, None] = "0036_career_work_mode"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("sanction_letter_key", sa.String(240), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("sanction_letter_name", sa.String(180), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("bank_confirmation_key", sa.String(240), nullable=False, server_default=""))
    op.add_column("loan_cases", sa.Column("bank_confirmation_name", sa.String(180), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("loan_cases", "bank_confirmation_name")
    op.drop_column("loan_cases", "bank_confirmation_key")
    op.drop_column("loan_cases", "sanction_letter_name")
    op.drop_column("loan_cases", "sanction_letter_key")
