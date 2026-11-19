"""How a career applicant wants to work."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0036_career_work_mode"
down_revision: Union[str, None] = "0035_career_applications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("career_applications", sa.Column("work_mode", sa.String(40), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("career_applications", "work_mode")
