from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MebelOffcut(Base):
    """A sawn piece of board kept in a workshop's store (the /mebel offcut stock).

    It enters on "Kesildi" from a job's cutting layout, or by hand, and leaves on
    "Kesildi" of the job whose layout cut from it. The job it came from may be
    deleted: the offcut stays, ``source_project_id`` goes null.
    """

    __tablename__ = "mebel_offcuts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True,
    )
    material: Mapped[str] = mapped_column(String(16), nullable=False)
    material_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    thickness: Mapped[int] = mapped_column(Integer, nullable=False)
    length: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    source_project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("furniture_projects.id", ondelete="SET NULL"), nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
