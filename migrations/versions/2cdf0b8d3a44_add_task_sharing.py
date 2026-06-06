"""Add task sharing support

Revision ID: 2cdf0b8d3a44
Revises: 128bfd04cc94
Create Date: 2026-06-01 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2cdf0b8d3a44'
down_revision = '128bfd04cc94'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'task_share',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('task.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('permission', sa.String(length=20), nullable=False, server_default='edit'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('task_id', 'user_id', name='uq_task_user_share')
    )


def downgrade():
    op.drop_table('task_share')
