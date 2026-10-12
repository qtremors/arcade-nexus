"""Atomic completion receipts, mode records, and independent recovery saves."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "game_sessions", sa.Column("mode", sa.String(40), nullable=False, server_default="classic")
    )
    op.add_column(
        "game_sessions",
        sa.Column("rules_version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("game_sessions", sa.Column("completion", sa.JSON(), nullable=True))
    op.create_table(
        "game_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "game_id", sa.Integer(), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("mode", sa.String(40), nullable=False),
        sa.Column("difficulty", sa.String(20), nullable=False),
        sa.Column("rules_version", sa.Integer(), nullable=False),
        sa.Column("high_score", sa.Integer(), nullable=False),
        sa.UniqueConstraint("user_id", "game_id", "mode", "difficulty", "rules_version"),
    )
    op.create_table(
        "recovery_saves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "game_id", sa.Integer(), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "game_id"),
    )


def downgrade():
    op.drop_table("recovery_saves")
    op.drop_table("game_records")
    with op.batch_alter_table("game_sessions") as batch:
        batch.drop_column("completion")
        batch.drop_column("rules_version")
        batch.drop_column("mode")
