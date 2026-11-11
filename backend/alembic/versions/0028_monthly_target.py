"""Monthly disbursement target on the user, for the productivity chart."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_monthly_target"
down_revision: Union[str, None] = "0027_automation_rule_prefs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("monthly_target_inr", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "monthly_target_inr")
