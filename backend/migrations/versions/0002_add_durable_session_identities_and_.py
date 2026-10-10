"""Add durable session identities and history index

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("game_sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("session_id", sa.String(length=36), nullable=True))
        batch_op.alter_column("end_time", existing_type=sa.DATETIME(), nullable=True)
        batch_op.create_index("ix_sessions_user_end", ["user_id", "end_time", "id"], unique=False)
        batch_op.create_unique_constraint("uq_sessions_session_id", ["session_id"])
        batch_op.create_check_constraint(
            "ck_sessions_nonnegative", "duration_seconds >= 0 AND score >= 0"
        )

    with op.batch_alter_table("game_saves") as batch_op:
        batch_op.create_check_constraint("ck_save_slot", "slot BETWEEN 1 AND 5")
    with op.batch_alter_table("play_stats") as batch_op:
        batch_op.create_check_constraint(
            "ck_stats_nonnegative",
            "total_playtime_seconds >= 0 AND sessions_count >= 0 AND high_score >= 0",
        )
    # Resolve historical duplicate selection flags without deleting profile data.
    op.execute(
        sa.text(
            "UPDATE users SET is_default = 0 WHERE is_default = 1 AND (is_active = 0 OR id != (SELECT MIN(id) FROM users WHERE is_default = 1 AND is_active = 1))"
        )
    )
    op.create_index(
        "uq_users_active_default",
        "users",
        ["is_default"],
        unique=True,
        sqlite_where=sa.text("is_active = 1 AND is_default = 1"),
    )


def downgrade():
    # Keep unfinished sessions as zero-duration historical records on rollback.
    op.execute(sa.text("UPDATE game_sessions SET end_time = start_time WHERE end_time IS NULL"))
    op.drop_index("uq_users_active_default", table_name="users")
    with op.batch_alter_table("play_stats") as batch_op:
        batch_op.drop_constraint("ck_stats_nonnegative", type_="check")
    with op.batch_alter_table("game_saves") as batch_op:
        batch_op.drop_constraint("ck_save_slot", type_="check")
    with op.batch_alter_table("game_sessions", schema=None) as batch_op:
        batch_op.drop_constraint("uq_sessions_session_id", type_="unique")
        batch_op.drop_constraint("ck_sessions_nonnegative", type_="check")
        batch_op.drop_index("ix_sessions_user_end")
        batch_op.alter_column("end_time", existing_type=sa.DATETIME(), nullable=False)
        batch_op.drop_column("session_id")
