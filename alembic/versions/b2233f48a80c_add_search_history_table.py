"""add search history table

Revision ID: b2233f48a80c
Revises: 31159d34a1f1
Create Date: 2025-12-30 00:13:45.014838

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2233f48a80c'
down_revision: Union[str, Sequence[str], None] = '31159d34a1f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
