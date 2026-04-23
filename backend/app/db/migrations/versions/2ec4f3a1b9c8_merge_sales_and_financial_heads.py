"""merge sales and financial migration heads

Revision ID: 2ec4f3a1b9c8
Revises: f55161f2527f, 7a6e3fb2d4f1
Create Date: 2026-04-23 19:05:00.000000

"""
from typing import Sequence, Union


revision: str = "2ec4f3a1b9c8"
down_revision: Union[str, Sequence[str], None] = ("f55161f2527f", "7a6e3fb2d4f1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
