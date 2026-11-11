"""Monthly bank-login target, set beside the disbursement target."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0029_login_target"
down_revision: Union[str, None] = "0028_monthly_target"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("monthly_login_target_inr", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "monthly_login_target_inr")
