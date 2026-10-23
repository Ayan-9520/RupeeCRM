"""Readable case-file numbers (RD-MCF-YYYYMMDD-NNNN) and an explicit link to the My Leads purchase."""

from typing import Sequence, Union
from uuid import UUID

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "0018_case_numbers"
down_revision: Union[str, None] = "0017_notifications_automation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FIRST_CASE_NO = 1001
SAMPLE_DEAL = "RD-MCF-SAMPLE-0844"


def upgrade() -> None:
    op.add_column("loan_cases", sa.Column("lead_purchase_id", PG_UUID(as_uuid=True), nullable=True))
    op.add_column("loan_cases", sa.Column("case_no", sa.Integer(), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, deal_no, (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day "
            "FROM loan_cases ORDER BY created_at ASC, id ASC"
        )
    ).fetchall()
    number = FIRST_CASE_NO
    for row in rows:
        deal_no = row.deal_no
        purchase_id = None
        if deal_no.startswith("RD-LP-"):
            try:
                purchase_id = UUID(deal_no[len("RD-LP-"):])
            except ValueError:
                purchase_id = None
        new_deal = deal_no if deal_no == SAMPLE_DEAL else f"RD-MCF-{row.day.strftime('%Y%m%d')}-{number}"
        bind.execute(
            sa.text("UPDATE loan_cases SET case_no = :no, deal_no = :deal, lead_purchase_id = :pid WHERE id = :id"),
            {"no": number, "deal": new_deal, "pid": purchase_id, "id": row.id},
        )
        number += 1

    op.create_index("ux_loan_cases_case_no", "loan_cases", ["case_no"], unique=True)
    op.create_index("ux_loan_cases_lead_purchase", "loan_cases", ["lead_purchase_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE loan_cases SET deal_no = 'RD-LP-' || replace(lead_purchase_id::text, '-', '') "
            "WHERE lead_purchase_id IS NOT NULL"
        )
    )
    op.drop_index("ux_loan_cases_lead_purchase", table_name="loan_cases")
    op.drop_index("ux_loan_cases_case_no", table_name="loan_cases")
    op.drop_column("loan_cases", "case_no")
    op.drop_column("loan_cases", "lead_purchase_id")
