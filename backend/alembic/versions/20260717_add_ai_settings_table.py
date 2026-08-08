"""add_ai_settings_table

Revision ID: 20260717
Revises: a1b2c3d4e5f6
Create Date: 2026-07-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260717'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_settings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('mode', sa.String(length=20), nullable=False),
        sa.Column('provider', sa.String(length=30), nullable=False),
        sa.Column('encrypted_api_key', sa.Text(), nullable=True),
        sa.Column('base_url', sa.String(length=512), nullable=True),
        sa.Column('default_model', sa.String(length=128), nullable=True),
        sa.Column('assistant_model', sa.String(length=128), nullable=True),
        sa.Column('smart_entry_model', sa.String(length=128), nullable=True),
        sa.Column('ocr_model', sa.String(length=128), nullable=True),
        sa.Column('sms_model', sa.String(length=128), nullable=True),
        sa.Column('gmail_model', sa.String(length=128), nullable=True),
        sa.Column('investment_advisor_model', sa.String(length=128), nullable=True),
        sa.Column('cloud_fallback_enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_ai_settings_user_id'), 'ai_settings', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_settings_user_id'), table_name='ai_settings')
    op.drop_table('ai_settings')
