"""Department on the employee login."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0031_user_department"
down_revision: Union[str, None] = "0030_billing_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("department", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "department")
