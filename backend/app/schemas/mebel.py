"""Request/response shapes for the /mebel mini-app.

Only what the engine relies on is checked here — the schema version, the
cabinet count and each cabinet's size and shelf ranges (the same limits as
frontend/src/features/mebel/engine/validate.ts). The rest of the project JSON
is the frontend's to evolve, so unknown fields are kept as they are.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_CABINETS = 30


# Size and shelf limits per cabinet type: the same as LIMITS_BY_TYPE in
# frontend/src/features/mebel/engine/validate.ts.
LIMITS_BY_TYPE: dict[str, dict[str, tuple[int, int]]] = {
    "base": {"width": (150, 1200), "height": (300, 1000), "depth": (250, 700), "shelves": (0, 4)},
    "wall": {"width": (150, 1200), "height": (300, 1000), "depth": (200, 400), "shelves": (0, 4)},
    "tall": {"width": (150, 1200), "height": (1200, 2400), "depth": (300, 650), "shelves": (0, 8)},
}


class CabinetIn(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    # A cabinet saved before types existed is a base cabinet.
    type: Literal["base", "wall", "tall"] = "base"
    width: int
    height: int
    depth: int
    shelves: int
    doors: int | None = Field(default=None, ge=0, le=2)
    drawers: int | None = Field(default=None, ge=0, le=4)

    @model_validator(mode="after")
    def _fits_its_type(self) -> "CabinetIn":
        if self.drawers and self.type != "base":
            raise ValueError("only a base cabinet has drawers")
        for field, (lo, hi) in LIMITS_BY_TYPE[self.type].items():
            value = getattr(self, field)
            if not lo <= value <= hi:
                raise ValueError(f"{field} {value} is outside {lo}-{hi} for a {self.type} cabinet")
        return self


class SheetIn(BaseModel):
    length: int = Field(ge=100, le=10000)
    width: int = Field(ge=100, le=10000)


class DefaultsIn(BaseModel):
    """Only the sheet size is checked: the engine divides by it."""
    model_config = ConfigDict(extra="allow")

    sheet: SheetIn | None = None


MAX_FREE_PARTS = 100
MAX_FREE_PIECES = 1000

Band = Literal["visible", "hidden"] | None


class FreePartEdges(BaseModel):
    L1: Band
    L2: Band
    W1: Band
    W2: Band


class FreePartIn(BaseModel):
    """A part entered by hand, belonging to no cabinet: the same limits as the engine."""
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=16)
    name: str = Field(min_length=1, max_length=60)
    length: int = Field(ge=10, le=3000)
    width: int = Field(ge=10, le=3000)
    qty: int = Field(ge=1, le=100)
    material: Literal["board", "back", "facade"]
    grain: Literal["length", "none"]
    edges: FreePartEdges


class ProjectData(BaseModel):
    model_config = ConfigDict(extra="allow")

    schemaVersion: Literal[1]
    defaults: DefaultsIn
    cabinets: list[CabinetIn] = Field(max_length=MAX_CABINETS)
    # saved before free parts existed: none
    freeParts: list[FreePartIn] = Field(default_factory=list, max_length=MAX_FREE_PARTS)

    @model_validator(mode="after")
    def _not_empty(self) -> "ProjectData":
        if not self.cabinets and not self.freeParts:
            raise ValueError("a project needs a cabinet or a free part")
        if sum(f.qty for f in self.freeParts) > MAX_FREE_PIECES:
            raise ValueError(f"at most {MAX_FREE_PIECES} free pieces")
        return self


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    data: ProjectData


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    updated_at: datetime
    # What tells two projects of the same name apart on the list: counted from the stored JSON.
    cabinets: int = 0
    free_parts: int = 0
    cut_at: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def _count(cls, value):
        # From an ORM row or a dict alike: every declared field as given, the counts from `data`.
        get = value.get if isinstance(value, dict) else (lambda k, d=None: getattr(value, k, d))
        data = get("data")
        if not isinstance(data, dict):
            return value
        fields = {k: get(k) for k in cls.model_fields if k not in ("cabinets", "free_parts") and get(k) is not None}
        return {**fields, "cabinets": len(data.get("cabinets") or []), "free_parts": len(data.get("freeParts") or [])}


class ProjectOut(ProjectSummary):
    data: dict
    schema_version: int
    created_at: datetime


MAX_OFFCUTS = 500


class OffcutIn(BaseModel):
    """An offcut entered by hand or left by a job's layout: a sawn board rectangle."""
    model_config = ConfigDict(populate_by_name=True)

    material: Literal["board", "back", "facade"]
    material_id: str | None = Field(default=None, alias="materialId", max_length=64)
    thickness: int = Field(ge=1, le=50)
    length: int = Field(ge=200, le=5000)
    width: int = Field(ge=200, le=5000)


class OffcutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, serialize_by_alias=True)

    id: uuid.UUID
    material: str
    material_id: str | None = Field(default=None, serialization_alias="materialId")
    thickness: int
    length: int
    width: int
    source_project_id: uuid.UUID | None = None
    created_at: datetime


class CutIn(BaseModel):
    """What "Kesildi" moves: the store offcuts the layout cut from, and the offcuts it leaves."""
    used: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_OFFCUTS)
    produced: list[OffcutIn] = Field(default_factory=list, max_length=MAX_OFFCUTS)


class PriceBookData(BaseModel):
    model_config = ConfigDict(extra="allow")

    markupPercent: float = Field(default=0, ge=0, le=300)


class SuggestIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class PriceBookIn(BaseModel):
    data: PriceBookData
