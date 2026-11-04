"""Sales grades T1–T10 and the manager each person reports to."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0022_sales_grades"
down_revision: Union[str, None] = "0021_profile_visits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sales_grade", sa.String(20), nullable=True))
    op.add_column("users", sa.Column("reports_to_user_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_users_sales_grade", "users", ["sales_grade"])
    op.create_index("ix_users_reports_to_user_id", "users", ["reports_to_user_id"])


def downgrade() -> None:
    op.drop_index("ix_users_reports_to_user_id", table_name="users")
    op.drop_index("ix_users_sales_grade", table_name="users")
    op.drop_column("users", "reports_to_user_id")
    op.drop_column("users", "sales_grade")
