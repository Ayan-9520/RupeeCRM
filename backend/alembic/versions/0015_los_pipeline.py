"""LOS pipeline, lender cases, tasks, and sanction records."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0015_los_pipeline"
down_revision: Union[str, None] = "0014_followups_bank_logins"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_los_pipelines",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("current_stage", sa.String(40), nullable=False, server_default="lead_purchased"),
        sa.Column("case_owner_id", UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_rm_id", UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_dsa_id", UUID(as_uuid=True), nullable=True),
        sa.Column("banker_name", sa.String(120), nullable=True),
        sa.Column("banker_mobile", sa.String(10), nullable=True),
        sa.Column("banker_email", sa.String(255), nullable=True),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("sla_target_date", sa.String(10), nullable=True),
        sa.Column("reminder_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_stage_changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("last_stage_changed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("lead_purchase_id", name="uq_customer_los_pipelines_purchase"),
    )
    op.create_index("ix_customer_los_pipelines_profile", "customer_los_pipelines", ["customer_profile_id"])
    op.create_index("ix_customer_los_pipelines_dsa", "customer_los_pipelines", ["dsa_id"])

    op.create_table(
        "customer_pipeline_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("from_stage", sa.String(40), nullable=True),
        sa.Column("to_stage", sa.String(40), nullable=False),
        sa.Column("changed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_pipeline_history_purchase", "customer_pipeline_history", ["lead_purchase_id"])

    op.create_table(
        "customer_lender_cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lender_name", sa.String(120), nullable=True),
        sa.Column("branch", sa.String(120), nullable=True),
        sa.Column("banker_name", sa.String(120), nullable=True),
        sa.Column("banker_mobile", sa.String(10), nullable=True),
        sa.Column("banker_email", sa.String(255), nullable=True),
        sa.Column("login_date", sa.String(10), nullable=True),
        sa.Column("login_status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("sanctioned_amount", sa.Float(), nullable=True),
        sa.Column("roi", sa.Float(), nullable=True),
        sa.Column("tenure", sa.Integer(), nullable=True),
        sa.Column("processing_fee", sa.Float(), nullable=True),
        sa.Column("insurance_amount", sa.Float(), nullable=True),
        sa.Column("disbursed_amount", sa.Float(), nullable=True),
        sa.Column("payout_expected", sa.Float(), nullable=True),
        sa.Column("payout_received", sa.Float(), nullable=True),
        sa.Column("payout_status", sa.String(20), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("is_best_offer", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_lender_cases_purchase", "customer_lender_cases", ["lead_purchase_id"])
    op.create_index("ix_customer_lender_cases_profile", "customer_lender_cases", ["customer_profile_id"])
    op.create_index("ix_customer_lender_cases_dsa", "customer_lender_cases", ["dsa_id"])

    op.create_table(
        "customer_tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("task_type", sa.String(40), nullable=False, server_default="general"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("assigned_user_id", UUID(as_uuid=True), nullable=True),
        sa.Column("comments", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_tasks_purchase", "customer_tasks", ["lead_purchase_id"])
    op.create_index("ix_customer_tasks_profile", "customer_tasks", ["customer_profile_id"])
    op.create_index("ix_customer_tasks_dsa", "customer_tasks", ["dsa_id"])

    op.create_table(
        "customer_sanction_disbursals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_profile_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lead_purchase_id", UUID(as_uuid=True), nullable=False),
        sa.Column("lender_case_id", UUID(as_uuid=True), nullable=True),
        sa.Column("lead_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dsa_id", UUID(as_uuid=True), nullable=False),
        sa.Column("sanction_amount", sa.Float(), nullable=True),
        sa.Column("final_roi", sa.Float(), nullable=True),
        sa.Column("final_tenure", sa.Integer(), nullable=True),
        sa.Column("emi", sa.Float(), nullable=True),
        sa.Column("processing_fee", sa.Float(), nullable=True),
        sa.Column("insurance_deduction", sa.Float(), nullable=True),
        sa.Column("net_disbursal", sa.Float(), nullable=True),
        sa.Column("disbursal_date", sa.String(10), nullable=True),
        sa.Column("utr_number", sa.String(80), nullable=True),
        sa.Column("bank_account_credited", sa.String(40), nullable=True),
        sa.Column("payout_expected", sa.Float(), nullable=True),
        sa.Column("payout_received", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("lead_purchase_id", name="uq_customer_sanction_purchase"),
    )
    op.create_index("ix_customer_sanction_profile", "customer_sanction_disbursals", ["customer_profile_id"])
    op.create_index("ix_customer_sanction_dsa", "customer_sanction_disbursals", ["dsa_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_sanction_dsa", table_name="customer_sanction_disbursals")
    op.drop_index("ix_customer_sanction_profile", table_name="customer_sanction_disbursals")
    op.drop_table("customer_sanction_disbursals")
    op.drop_index("ix_customer_tasks_dsa", table_name="customer_tasks")
    op.drop_index("ix_customer_tasks_profile", table_name="customer_tasks")
    op.drop_index("ix_customer_tasks_purchase", table_name="customer_tasks")
    op.drop_table("customer_tasks")
    op.drop_index("ix_customer_lender_cases_dsa", table_name="customer_lender_cases")
    op.drop_index("ix_customer_lender_cases_profile", table_name="customer_lender_cases")
    op.drop_index("ix_customer_lender_cases_purchase", table_name="customer_lender_cases")
    op.drop_table("customer_lender_cases")
    op.drop_index("ix_customer_pipeline_history_purchase", table_name="customer_pipeline_history")
    op.drop_table("customer_pipeline_history")
    op.drop_index("ix_customer_los_pipelines_dsa", table_name="customer_los_pipelines")
    op.drop_index("ix_customer_los_pipelines_profile", table_name="customer_los_pipelines")
    op.drop_table("customer_los_pipelines")
