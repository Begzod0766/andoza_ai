"""A shop's street address and map point, shared by the admin and seller shop forms."""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator

# A loose box around Uzbekistan (lat 37.18–45.59 N, lng 55.99–73.15 E) with a small margin.
# It catches a swapped pair, a 0,0 and a point in another country; it does not try to trace
# the border.
UZ_LAT = (37.0, 45.8)
UZ_LNG = (55.8, 73.3)


class StoreLocationIn(BaseModel):
    address: str | None = Field(default=None, max_length=300)
    lat: float | None = None
    lng: float | None = None

    @field_validator("address", mode="before")
    @classmethod
    def _strip_address(cls, v: object) -> object:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def _point(self):
        sent_lat, sent_lng = "lat" in self.model_fields_set, "lng" in self.model_fields_set
        if sent_lat != sent_lng or (self.lat is None) != (self.lng is None):
            raise ValueError("lat va lng birga yuborilishi kerak")
        if self.lat is not None and self.lng is not None:
            if not (UZ_LAT[0] <= self.lat <= UZ_LAT[1] and UZ_LNG[0] <= self.lng <= UZ_LNG[1]):
                raise ValueError("Nuqta O'zbekiston hududida bo'lishi kerak")
            self.lat, self.lng = round(self.lat, 6), round(self.lng, 6)
        return self
