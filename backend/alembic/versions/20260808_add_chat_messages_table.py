"""
Alembic migration — adds chat_messages table for AI Finance Assistant.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "20260808_add_chat_messages"
down_revision = "2e3b699a4583"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_chat_messages_user_id",
        "chat_messages",
        ["user_id"],
    )
    op.create_index(
        "ix_chat_messages_user_conv",
        "chat_messages",
        ["user_id", "conversation_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_user_conv", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_table("chat_messages")
