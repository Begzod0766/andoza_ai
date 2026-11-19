"""A guest account becoming a real one (spec 2026-11-20 mehmon rejimi §1).

* **upgrade** — the guest signs up with a new identity (username, phone, Google
  or Apple): the same row gets it and stops being a guest. Its rooms never move.
* **merge** — the guest signs in to an account that already exists: everything
  the guest owns moves to that account and the guest row is deleted. Done in the
  caller's session/transaction; the guest row is locked first, so two sign-ins
  racing on one guest merge it once (the second is a plain login).

Rooms follow their apartment (``rooms.apartment_id``), and everything hanging
off a room (state, finishes, placements, electrical, estimates, share token)
follows the room, so moving ``apartments.user_id`` moves the guest's whole
work. Storage files are not moved: their keys live on the rows.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import structlog
from sqlalchemy import and_, delete, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.apartment import Apartment
from app.models.content_report import ContentReport
from app.models.device_token import DeviceToken
from app.models.draft_room import DraftRoom
from app.models.furniture_project import FurnitureProject
from app.models.lead import Lead
from app.models.media_job import MediaJob
from app.models.mebel_offcut import MebelOffcut
from app.models.order import Order
from app.models.price_book import PriceBook
from app.models.room import Room
from app.models.room_render import RoomRender
from app.models.shop_inquiry import ShopInquiry
from app.models.user import User
from app.models.user_model import UserModel
from app.models.wallpaper import Wallpaper

logger = structlog.get_logger(__name__)

# The identity a sign-up may give a guest row; anything else is refused.
_IDENTITY_FIELDS = ("username", "password_hash", "name", "phone", "google_sub", "apple_sub", "email")

# Tables whose `user_id` simply moves to the target. Orders, leads and inquiries
# are closed to guests (registration_required) and moved only as a precaution.
_OWNED_BY_USER_ID = (
    Apartment, DraftRoom, FurnitureProject, MebelOffcut, MediaJob, RoomRender, Order, Lead, ShopInquiry,
)


@dataclass
class MergeResult:
    rooms: int
    apartments: int


async def upgrade_guest(db: AsyncSession, guest: User, **identity: str | None) -> User:
    """Give *guest* a real identity in place: same id, same rooms."""
    unknown = set(identity) - set(_IDENTITY_FIELDS)
    if unknown:
        raise TypeError(f"upgrade_guest: not an identity field: {sorted(unknown)}")
    for field, value in identity.items():
        setattr(guest, field, value)
    guest.is_guest = False
    guest.registered_at = datetime.now(timezone.utc)
    await db.flush()
    method = next(iter(identity), None)
    logger.info("guest_upgraded", user_id=str(guest.id), method=method)
    return guest


async def merge_guest_into(db: AsyncSession, guest_id: uuid.UUID, target: User) -> MergeResult | None:
    """Move everything guest *guest_id* owns to *target* and delete the guest.
    None (nothing done) when the row is gone, is no longer a guest, or is the target."""
    guest = (
        await db.execute(select(User).where(User.id == guest_id).with_for_update())
    ).scalar_one_or_none()
    if guest is None or guest.is_guest is not True or guest.id == target.id:
        return None
    to = target.id

    rooms = (
        await db.execute(
            select(func.count(Room.id))
            .join(Apartment, Room.apartment_id == Apartment.id)
            .where(Apartment.user_id == guest_id, Room.deleted == False)  # noqa: E712
        )
    ).scalar_one() or 0

    apartments = 0
    for model in _OWNED_BY_USER_ID:
        res = await db.execute(
            update(model).where(model.user_id == guest_id).values(user_id=to)
            .execution_options(synchronize_session=False)
        )
        if model is Apartment:
            apartments = res.rowcount or 0
    await db.execute(
        update(Wallpaper).where(Wallpaper.uploaded_by == guest_id).values(uploaded_by=to)
        .execution_options(synchronize_session=False)
    )

    # Imported models: the target keeps its own copy of a file both have.
    await db.execute(
        delete(UserModel)
        .where(
            UserModel.user_id == guest_id,
            UserModel.sha256.in_(select(UserModel.sha256).where(UserModel.user_id == to)),
        )
        .execution_options(synchronize_session=False)
    )
    await db.execute(
        update(UserModel).where(UserModel.user_id == guest_id).values(user_id=to)
        .execution_options(synchronize_session=False)
    )

    # One price book per user (PK = user_id): the target's wins.
    target_has_book = (
        await db.execute(select(PriceBook.user_id).where(PriceBook.user_id == to))
    ).scalar_one_or_none() is not None
    if target_has_book:
        await db.execute(
            delete(PriceBook).where(PriceBook.user_id == guest_id)
            .execution_options(synchronize_session=False)
        )
    else:
        await db.execute(
            update(PriceBook).where(PriceBook.user_id == guest_id).values(user_id=to)
            .execution_options(synchronize_session=False)
        )

    # Reports: one per (reporter, target); a report both made stays the target's.
    theirs = aliased(ContentReport)
    await db.execute(
        delete(ContentReport)
        .where(
            ContentReport.reporter_id == guest_id,
            exists().where(and_(
                theirs.reporter_id == to,
                theirs.target_type == ContentReport.target_type,
                theirs.target_id == ContentReport.target_id,
            )),
        )
        .execution_options(synchronize_session=False)
    )
    await db.execute(
        update(ContentReport).where(ContentReport.reporter_id == guest_id).values(reporter_id=to)
        .execution_options(synchronize_session=False)
    )

    # The app registers its push token again for the account it is now in.
    await db.execute(
        delete(DeviceToken).where(DeviceToken.user_id == guest_id)
        .execution_options(synchronize_session=False)
    )

    # Core DELETE, as account_deletion does: the DB cascades whatever is left,
    # and the ORM does not lazy-load (and cascade-delete) a stale collection.
    db.expunge(guest)
    await db.execute(delete(User).where(User.id == guest_id))

    logger.info("guest_merged", target_user_id=str(to), rooms=rooms, apartments=apartments)
    return MergeResult(rooms=rooms, apartments=apartments)
