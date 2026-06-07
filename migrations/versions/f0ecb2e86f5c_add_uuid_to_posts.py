"""add uuid to posts

Revision ID: f0ecb2e86f5c
Revises: 2cdf0b8d3a44
Create Date: 2026-06-07 09:15:53.230159

"""
import uuid
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f0ecb2e86f5c'
down_revision = '2cdf0b8d3a44'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))
    
    from app import create_app
    from app.models import Post, db
    app = create_app()
    with app.app_context():
        posts = Post.query.all()
        for post in posts:
            post.uuid = str(uuid.uuid4())
        db.session.commit()
    
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.alter_column('uuid', nullable=False)
        batch_op.create_unique_constraint('uq_posts_uuid', ['uuid'])


def downgrade():
    with op.batch_alter_table('posts', schema=None) as batch_op:
        batch_op.drop_constraint('uq_posts_uuid', type_='unique')
        batch_op.drop_column('uuid')
