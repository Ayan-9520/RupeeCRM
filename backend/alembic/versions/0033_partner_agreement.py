"""Partner agreement percent of the lender payout."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0033_partner_agreement"
down_revision: Union[str, None] = "0032_hr_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("agreement_percent", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "agreement_percent")
