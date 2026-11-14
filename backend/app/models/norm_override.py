"""Prices an admin set over the three norm files, and every change made to them (spec 2026-11-15)."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NormOverride(Base):
    __tablename__ = "norm_overrides"
    __table_args__ = (UniqueConstraint("file", "path", name="uq_norm_overrides_file_path"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file: Mapped[str] = mapped_column(String(32), nullable=False, comment="plumbing | tile | bathroom_extras")
    path: Mapped[str] = mapped_column(String(120), nullable=False, comment="Dotted key in the file, e.g. part_uzs.trap_pol")
    value: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class NormOverrideLog(Base):
    __tablename__ = "norm_override_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    file: Mapped[str] = mapped_column(String(32), nullable=False)
    path: Mapped[str] = mapped_column(String(120), nullable=False)
    old_value: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True, comment="Null: it was the file's own value")
    new_value: Mapped[float | None] = mapped_column(Numeric(14, 4), nullable=True, comment="Null: back to the file's own value")
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
