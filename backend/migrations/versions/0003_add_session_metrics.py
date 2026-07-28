"""Persist bounded game measurements for event achievements.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "game_sessions", sa.Column("metrics", sa.JSON(), nullable=False, server_default="{}")
    )


def downgrade():
    with op.batch_alter_table("game_sessions") as batch:
        batch.drop_column("metrics")
