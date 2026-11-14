"""Which company telecaller may see a purchased lead."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0034_caller_assign"
down_revision: Union[str, None] = "0033_partner_agreement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lead_purchases", sa.Column("assigned_caller_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_lead_purchases_assigned_caller_id", "lead_purchases", ["assigned_caller_id"])


def downgrade() -> None:
    op.drop_index("ix_lead_purchases_assigned_caller_id", table_name="lead_purchases")
    op.drop_column("lead_purchases", "assigned_caller_id")
