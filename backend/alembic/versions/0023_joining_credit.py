"""One-time ₹500 joining credit for a new partner."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_joining_credit"
down_revision: Union[str, None] = "0022_sales_grades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("joining_credit_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "joining_credit_at")
