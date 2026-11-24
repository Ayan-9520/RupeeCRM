"""Several bank officers on one case file."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0038_case_bankers"
down_revision: Union[str, None] = "0037_case_papers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("bankers", JSONB, nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("loan_cases", "bankers")
