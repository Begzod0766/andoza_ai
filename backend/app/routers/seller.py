"""A seller runs one shop and uploads 3D models into the catalog.

A seller is simply a user who owns a shop (``stores.owner_user_id``). Everything
here acts on the caller's own shop and its models only — the shop is looked up
from the caller, never from an id in the request, so there is no id to swap for
someone else's. A new shop and every uploaded model start pending and inactive
and reach the public catalog only once an admin approves them (see
``routers/admin_moderation.py``).
"""
from __future__ import annotations

import hashlib
import uuid as uuid_module
from typing import get_args

import structlog
from fastapi import APIRouter, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.i18n import translate_detail
from app.schemas.admin_catalog import FURNITURE_STYLES, ModelYaw
from app.api.v1.deps import CurrentUser, DbSession
from app.core.storage import absolute_media_url, upload_file
from app.database import run_after_commit
from app.core.model_files import is_glb_with_meshes, model_keys, served_key
from app.services.furniture_style_queue import enqueue_style_after_commit
from app.services.model_optimize_queue import enqueue_optimize_after_commit
from app.models.furniture import Furniture
from app.models.order import Order
from app.models.store import Store
from app.models.wallpaper import Wallpaper
from app.routers.admin_catalog import (
    _delete_files_after_commit,
    _invalidate_after_commit,
)
from app.routers.wallpapers import _EXT_BY_TYPE, _out as _wallpaper_out, read_wallpaper_image
from app.schemas.order import OrderStatusUpdate, SellerOrderOut
from app.services.order_status import SELLER_CAN_CANCEL, change_status
from app.services.push import notify
from app.schemas.wallpaper import WallpaperOut
from app.schemas.seller import (
    FURNITURE_CATEGORIES,
    PLACEMENTS,
    ROOM_TYPES,
    normalize_styles,
    parse_styles_form,
    SellerFurnitureOut,
    SellerFurniturePage,
    SellerFurnitureUpdate,
    SellerStoreOut,
    SellerStoreUpdate,
    StoreApply,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/seller", tags=["seller"])

_MAX_GLB_BYTES = 50 * 1024 * 1024
_MAX_THUMB_BYTES = 5 * 1024 * 1024
# A seller's queue of unreviewed models is capped, so one account cannot bury
# the moderators in uploads.
_MAX_PENDING_MODELS = 20
# The same for a shop's wallpapers awaiting review.
_MAX_PENDING_WALLPAPERS = 50
# The moderation note of an approved oboy its shop removed. Such a row stays so
# rooms priced with it keep working, which is why the seller cannot delete it,
# swap its image or send it back to review (see _is_hidden_by_shop).
_HIDDEN_BY_SHOP = "Do'kon olib tashladi"
_THUMB_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
# What the first bytes of each accepted image must look like (a model is
# checked whole, by is_glb_with_meshes). The browser's filename and
# content-type are the uploader's word; this is the file's.
_THUMB_MAGIC = {"image/jpeg": (b"\xff\xd8\xff",), "image/png": (b"\x89PNG",), "image/webp": (b"RIFF",)}


async def _own_store(db: DbSession, user) -> Store | None:
    return (await db.execute(select(Store).where(Store.owner_user_id == user.id))).scalar_one_or_none()


async def _require_store(db: DbSession, user) -> Store:
    store = await _own_store(db, user)
    if store is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sizda do'kon yo'q")
    return store


async def _require_approved_store(db: DbSession, user) -> Store:
    store = await _require_store(db, user)
    if store.status != "approved":
        if store.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Do'koningiz hali tasdiqlanmagan",
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Do'koningiz rad etilgan",
        )
    return store


def _out(f: Furniture, request: Request) -> SellerFurnitureOut:
    return SellerFurnitureOut(
        id=f.id,
        category=f.category,
        room_type=f.room_type,
        styles=f.styles or [],
        styles_source=f.styles_source,
        placement=f.placement,
        model_yaw=f.model_yaw or 0,  # unset on a row not yet flushed
        name_uz=f.name_uz,
        price_uzs=f.price_uzs,
        glb_url=absolute_media_url(request, served_key(f.glb_key, f.glb_opt_key) if f.glb_key else None),
        thumbnail_url=absolute_media_url(request, f.thumbnail_key),
        footprint_w=float(f.footprint_w) if f.footprint_w is not None else None,
        footprint_d=float(f.footprint_d) if f.footprint_d is not None else None,
        height_cm=float(f.height_cm) if f.height_cm is not None else None,
        is_active=f.is_active,
        status=f.status,
        moderation_note=f.moderation_note,
        created_at=f.created_at,
    )


# --------------------------------------------------------------------------- #
# The shop
# --------------------------------------------------------------------------- #

@router.get(
    "/store",
    response_model=SellerStoreOut | None,
    summary="The caller's own shop, or null if they have none (not yet a seller)",
)
async def get_store(current_user: CurrentUser, db: DbSession) -> Store | None:
    # null, not 404: "no shop yet" is the normal first state of the seller page.
    return await _own_store(db, current_user)


@router.post(
    "/store",
    response_model=SellerStoreOut,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to run a shop (waits for an admin)",
)
async def apply_for_store(body: StoreApply, current_user: CurrentUser, db: DbSession) -> Store:
    if await _own_store(db, current_user) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sizda allaqachon do'kon bor")
    store = Store(
        name=body.name.strip(),
        district=body.district,
        phone=body.phone,
        telegram=body.telegram,
        logo_color=body.logo_color,
        owner_user_id=current_user.id,
        partner_tier="standard",
        status="pending",
        is_active=False,
    )
    db.add(store)
    await db.flush()
    await db.refresh(store)
    logger.info("seller_applied", store_id=str(store.id), user_id=str(current_user.id))
    return store


@router.post(
    "/store/resubmit",
    response_model=SellerStoreOut,
    summary="Send a rejected shop application back for review",
)
async def resubmit_store(current_user: CurrentUser, db: DbSession) -> Store:
    store = await _require_store(db, current_user)
    if store.status != "rejected":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Faqat rad etilgan ariza qayta yuboriladi")
    store.status = "pending"
    store.moderation_note = None
    await db.flush()
    await db.refresh(store)
    return store


@router.patch("/store", response_model=SellerStoreOut, summary="Edit the caller's own shop")
async def update_store(body: SellerStoreUpdate, current_user: CurrentUser, db: DbSession) -> Store:
    store = await _require_store(db, current_user)
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "name" and value is not None:
            value = value.strip()
        setattr(store, field, value)
    await db.flush()
    await db.refresh(store)
    if store.status == "approved":
        _invalidate_after_commit(db, "stores:")
        _invalidate_after_commit(db, "furniture:")
    return store


# --------------------------------------------------------------------------- #
# The shop's 3D models
# --------------------------------------------------------------------------- #

@router.get("/furniture", response_model=SellerFurniturePage, summary="The caller's own models, every status")
async def list_furniture(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> SellerFurniturePage:
    store = await _require_store(db, current_user)
    total = (await db.execute(
        select(func.count()).select_from(Furniture).where(Furniture.store_id == store.id)
    )).scalar_one()
    rows = (await db.execute(
        select(Furniture).where(Furniture.store_id == store.id)
        .order_by(Furniture.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()
    return SellerFurniturePage(items=[_out(f, request) for f in rows], total=total, page=page, per_page=per_page)


@router.post(
    "/furniture",
    response_model=SellerFurnitureOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a 3D model (.glb) into the caller's shop; it waits for an admin",
)
async def upload_furniture(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile,
    name_uz: str = Form(..., min_length=1, max_length=200),
    category: str = Form(...),
    room_type: str | None = Form(default=None),
    styles: str | None = Form(default=None),
    placement: str = Form(default="pol"),
    model_yaw: int = Form(default=0),
    price_uzs: int | None = Form(default=None, ge=0),
    footprint_w: float | None = Form(default=None, gt=0, le=2000),
    footprint_d: float | None = Form(default=None, gt=0, le=2000),
    height_cm: float | None = Form(default=None, gt=0, le=1000),
    thumbnail: UploadFile | None = None,
) -> SellerFurnitureOut:
    store = await _require_approved_store(db, current_user)

    if category not in FURNITURE_CATEGORIES:
        raise HTTPException(status_code=422, detail=translate_detail("category {allowed} dan biri bo'lishi kerak", allowed=', '.join(sorted(FURNITURE_CATEGORIES))))
    if room_type is not None and room_type not in ROOM_TYPES:
        raise HTTPException(status_code=422, detail=translate_detail("room_type {allowed} dan biri (yoki bo'sh) bo'lishi kerak", allowed=', '.join(sorted(ROOM_TYPES))))
    if placement not in PLACEMENTS:
        raise HTTPException(status_code=422, detail=translate_detail("placement {allowed} dan biri bo'lishi kerak", allowed=', '.join(sorted(PLACEMENTS))))
    if model_yaw not in get_args(ModelYaw):
        raise HTTPException(status_code=422, detail=translate_detail("model_yaw {allowed} dan biri bo'lishi kerak", allowed=", ".join(map(str, get_args(ModelYaw)))))
    try:
        style_list = parse_styles_form(styles)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=translate_detail("styles {allowed} dan bo'lishi kerak", allowed=", ".join(FURNITURE_STYLES))) from exc

    pending = (await db.execute(
        select(func.count()).select_from(Furniture)
        .where(Furniture.store_id == store.id, Furniture.status == "pending")
    )).scalar_one()
    if pending >= _MAX_PENDING_MODELS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Tasdiqlanmagan modellar ko'p. Avval ular ko'rib chiqilishini kuting",
        )

    glb = await file.read()
    if not glb:
        raise HTTPException(status_code=400, detail="Bo'sh fayl yuborildi")
    if len(glb) > _MAX_GLB_BYTES:
        raise HTTPException(status_code=413, detail=translate_detail("Fayl hajmi {mb} MB dan oshmasligi kerak", mb=_MAX_GLB_BYTES // (1024 * 1024)))
    if not is_glb_with_meshes(glb):
        raise HTTPException(status_code=415, detail="Fayl haqiqiy .glb emas")

    thumb_bytes: bytes | None = None
    thumb_type = ""
    if thumbnail is not None and (thumbnail.filename or ""):
        thumb_type = thumbnail.content_type or ""
        if thumb_type not in _THUMB_EXT:
            raise HTTPException(status_code=415, detail="Rasm faqat jpeg/png/webp formatida bo'lishi mumkin")
        thumb_bytes = await thumbnail.read()
        if len(thumb_bytes) > _MAX_THUMB_BYTES:
            raise HTTPException(status_code=413, detail=translate_detail("Rasm hajmi {mb} MB dan oshmasligi kerak", mb=_MAX_THUMB_BYTES // (1024 * 1024)))
        if thumb_bytes and not thumb_bytes.startswith(_THUMB_MAGIC[thumb_type]):
            raise HTTPException(status_code=415, detail="Rasm fayli buzilgan yoki noto'g'ri formatda")

    thumbnail_key: str | None = None
    if thumb_bytes:
        tkey = f"furniture/{uuid_module.uuid4()}_thumb.{_THUMB_EXT[thumb_type]}"
        try:
            stored = await upload_file(thumb_bytes, tkey, content_type=thumb_type)
        except Exception as exc:
            logger.error("seller_thumbnail_upload_failed", key=tkey, error=str(exc))
            raise HTTPException(status_code=502, detail="Rasmni saqlab bo'lmadi") from exc
        thumbnail_key = stored if stored.startswith("http") else tkey

    gkey = f"furniture/{uuid_module.uuid4()}.glb"
    try:
        stored_glb = await upload_file(glb, gkey, content_type="model/gltf-binary")
    except Exception as exc:
        logger.error("seller_glb_upload_failed", key=gkey, error=str(exc))
        _delete_files_after_commit(db, [thumbnail_key], "seller_orphan_thumbnail_delete_failed")
        raise HTTPException(status_code=502, detail="Modelni saqlab bo'lmadi") from exc

    furniture = Furniture(
        store_id=store.id,
        category=category,
        room_type=room_type,
        styles=style_list,
        styles_source="manual" if style_list else None,
        placement=placement,
        model_yaw=model_yaw,
        name_uz=name_uz.strip(),
        price_uzs=price_uzs,
        glb_key=stored_glb if stored_glb.startswith("http") else gkey,
        thumbnail_key=thumbnail_key,
        footprint_w=footprint_w,
        footprint_d=footprint_d,
        height_cm=height_cm,
        status="pending",
        is_active=False,
    )
    db.add(furniture)
    await db.flush()
    await db.refresh(furniture)
    enqueue_optimize_after_commit(db, "furniture", str(furniture.id))
    if not style_list:
        enqueue_style_after_commit(db, str(furniture.id))
    logger.info("seller_model_uploaded", id=str(furniture.id), store_id=str(store.id), user_id=str(current_user.id))
    return _out(furniture, request)


async def _own_model(db: DbSession, user, furniture_id: uuid_module.UUID) -> Furniture:
    """The model, only if it belongs to the caller's shop. Someone else's id and a
    missing one answer the same 404, so ids cannot be probed."""
    store = await _require_store(db, user)
    f = (await db.execute(select(Furniture).where(Furniture.id == furniture_id))).scalar_one_or_none()
    if f is None or f.store_id != store.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model topilmadi")
    return f


@router.patch("/furniture/{furniture_id}", response_model=SellerFurnitureOut, summary="Edit one of the caller's models")
async def update_furniture(
    furniture_id: uuid_module.UUID,
    body: SellerFurnitureUpdate,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
) -> SellerFurnitureOut:
    f = await _own_model(db, current_user, furniture_id)
    changes = body.model_dump(exclude_unset=True)

    if "category" in changes and changes["category"] not in FURNITURE_CATEGORIES:
        raise HTTPException(status_code=422, detail="category noto'g'ri")
    if changes.get("room_type") is not None and changes["room_type"] not in ROOM_TYPES:
        raise HTTPException(status_code=422, detail="room_type noto'g'ri")
    if "placement" in changes and changes["placement"] not in PLACEMENTS:
        raise HTTPException(status_code=422, detail="placement noto'g'ri")
    if "styles" in changes:
        if changes["styles"] is None:
            del changes["styles"]  # null means "leave as is", never "wipe"
        else:
            try:
                changes["styles"] = normalize_styles(changes["styles"])
                changes["styles_source"] = "manual"
            except ValueError as exc:
                raise HTTPException(status_code=422, detail=translate_detail("styles {allowed} dan bo'lishi kerak", allowed=", ".join(FURNITURE_STYLES))) from exc
    # Only an approved model may be shown: this switch hides and re-shows it, it
    # does not bypass moderation.
    if changes.get("is_active") is True and f.status != "approved":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Model hali tasdiqlanmagan")

    for field, value in changes.items():
        if field == "name_uz" and value is not None:
            value = value.strip()
        setattr(f, field, value)
    await db.flush()
    await db.refresh(f)
    _invalidate_after_commit(db, "furniture:")
    return _out(f, request)


@router.delete("/furniture/{furniture_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete one of the caller's models")
async def delete_furniture(furniture_id: uuid_module.UUID, current_user: CurrentUser, db: DbSession) -> None:
    f = await _own_model(db, current_user, furniture_id)
    keys = [*model_keys(f.glb_key, f.glb_opt_key), f.thumbnail_key]
    await db.delete(f)
    await db.flush()
    _invalidate_after_commit(db, "furniture:")
    _delete_files_after_commit(db, keys, "seller_model_file_delete_failed")
    logger.info("seller_model_deleted", id=str(furniture_id), user_id=str(current_user.id))


# ── The shop's wallpapers ────────────────────────────────────────────────────


async def _own_wallpaper(db: DbSession, user, wallpaper_id: uuid_module.UUID) -> tuple[Store, Wallpaper]:
    """The wallpaper, only if it belongs to the caller's (approved) shop. Someone
    else's id and a missing one answer the same 404, so ids cannot be probed."""
    store = await _require_approved_store(db, user)
    w = (await db.execute(select(Wallpaper).where(Wallpaper.id == wallpaper_id))).scalar_one_or_none()
    if w is None or w.store_id != store.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oboy topilmadi")
    w.store = store  # set directly: _out reads it and a lazy load would fail here
    return store, w


async def _require_free_image(db: DbSession, store: Store, digest: str, *, except_id: uuid_module.UUID | None = None) -> None:
    """One image per (sha256, kind): 409 if an oboy with these bytes exists. The
    answer says whether it is the caller's own, but a foreign row is never touched."""
    query = select(Wallpaper).where(Wallpaper.sha256 == digest, Wallpaper.kind == "oboy")
    if except_id is not None:
        query = query.where(Wallpaper.id != except_id)
    found = (await db.execute(query)).scalars().first()
    if found is None:
        return
    if found.store_id == store.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu oboy ro'yxatingizda bor, uni tahrirlang")
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu rasm kutubxonada allaqachon bor")


async def _require_pending_room(db: DbSession, store: Store) -> None:
    pending = (await db.execute(
        select(func.count()).select_from(Wallpaper).where(Wallpaper.store_id == store.id, Wallpaper.status == "pending")
    )).scalar_one()
    if pending >= _MAX_PENDING_WALLPAPERS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Tekshiruvni kutayotgan oboylar juda ko'p (50)",
        )


async def _store_wallpaper_image(file: UploadFile, data: bytes) -> tuple[str, str]:
    """Put the image in storage; returns (storage_key, content_type)."""
    content_type = file.content_type or "image/jpeg"
    key = f"wallpapers/{uuid_module.uuid4()}.{_EXT_BY_TYPE.get(content_type, 'jpg')}"
    try:
        stored_url = await upload_file(data, key, content_type=content_type)
    except Exception as exc:
        logger.error("seller_wallpaper_upload_failed", key=key, error=str(exc))
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Rasmni saqlab bo'lmadi") from exc
    return (stored_url if stored_url.startswith("http") else key), content_type


def _is_hidden_by_shop(w: Wallpaper) -> bool:
    return w.status == "rejected" and w.moderation_note == _HIDDEN_BY_SHOP


async def _flush_new_image(db: DbSession) -> None:
    """Flush, turning a lost race on the (sha256, kind) unique index (two uploads
    of the same bytes at once) into the same 409 as the lookup before it."""
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu rasm kutubxonada allaqachon bor") from exc


def _clean_wallpaper_name(name: str) -> str:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="name bo'sh bo'lmasligi kerak")
    return name


@router.get("/wallpapers", response_model=list[WallpaperOut], summary="The caller's own wallpapers, every status")
async def list_wallpapers(request: Request, current_user: CurrentUser, db: DbSession) -> list[WallpaperOut]:
    store = await _require_store(db, current_user)
    rows = (await db.execute(
        select(Wallpaper).where(Wallpaper.store_id == store.id).order_by(Wallpaper.created_at.desc())
    )).scalars().all()
    for w in rows:
        w.store = store
    return [_wallpaper_out(w, request) for w in rows]


@router.post(
    "/wallpapers",
    response_model=WallpaperOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a roll wallpaper to the caller's shop; it waits for an admin",
)
async def create_wallpaper(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile,
    name: str = Form(..., min_length=1, max_length=120),
    price_uzs: int = Form(..., gt=0),
    width_cm: float = Form(..., ge=30, le=150),
    total_length_m: float = Form(..., ge=1, le=50),
) -> WallpaperOut:
    store = await _require_approved_store(db, current_user)
    name = _clean_wallpaper_name(name)
    data = await read_wallpaper_image(file)
    digest = hashlib.sha256(data).hexdigest()
    await _require_free_image(db, store, digest)
    await _require_pending_room(db, store)
    key, content_type = await _store_wallpaper_image(file, data)

    w = Wallpaper(
        name=name, kind="oboy", store_id=store.id, price_uzs=price_uzs, width_cm=width_cm,
        total_length_m=total_length_m, storage_key=key, content_type=content_type,
        size_bytes=len(data), sha256=digest, uploaded_by=current_user.id, status="pending",
    )
    w.store = store
    db.add(w)
    await _flush_new_image(db)
    await db.refresh(w, attribute_names=["created_at"])
    logger.info("seller_wallpaper_added", id=str(w.id), store_id=str(store.id), user_id=str(current_user.id))
    return _wallpaper_out(w, request)


@router.patch("/wallpapers/{wallpaper_id}", response_model=WallpaperOut, summary="Edit one of the caller's wallpapers")
async def update_wallpaper(
    wallpaper_id: uuid_module.UUID,
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile | None = None,
    name: str | None = Form(default=None, min_length=1, max_length=120),
    price_uzs: int | None = Form(default=None, gt=0),
    width_cm: float | None = Form(default=None, ge=30, le=150),
    total_length_m: float | None = Form(default=None, ge=1, le=50),
) -> WallpaperOut:
    store, w = await _own_wallpaper(db, current_user, wallpaper_id)
    hidden = _is_hidden_by_shop(w)
    if file is not None and (w.status == "approved" or hidden):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tasdiqlangan oboyning rasmini almashtirib bo'lmaydi")
    if name is not None:
        name = _clean_wallpaper_name(name)

    new_image: tuple[bytes, str, str] | None = None
    if file is not None:
        data = await read_wallpaper_image(file)
        digest = hashlib.sha256(data).hexdigest()
        await _require_free_image(db, store, digest, except_id=w.id)
        new_image = (data, digest, file.content_type or "image/jpeg")

    # An edit to a rejected oboy sends it back for review, so it takes a place in the queue.
    # (A row the shop hid was approved before, so editing it just shows it again.)
    resubmit = w.status == "rejected" and not hidden
    if resubmit:
        await _require_pending_room(db, store)

    if new_image is not None:
        data, digest, _ = new_image
        w.storage_key, w.content_type = await _store_wallpaper_image(file, data)
        w.sha256, w.size_bytes = digest, len(data)
    for field, value in (("name", name), ("price_uzs", price_uzs), ("width_cm", width_cm), ("total_length_m", total_length_m)):
        if value is not None:
            setattr(w, field, value)
    if resubmit:
        w.status, w.moderation_note = "pending", None
    elif hidden:
        w.status, w.moderation_note = "approved", None
    if new_image is not None:
        await _flush_new_image(db)
    else:
        await db.flush()
    logger.info("seller_wallpaper_updated", id=str(w.id), user_id=str(current_user.id))
    return _wallpaper_out(w, request)


@router.delete("/wallpapers/{wallpaper_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove one of the caller's wallpapers")
async def delete_wallpaper(wallpaper_id: uuid_module.UUID, current_user: CurrentUser, db: DbSession) -> None:
    _, w = await _own_wallpaper(db, current_user, wallpaper_id)
    if _is_hidden_by_shop(w):
        return  # already removed by the shop; the row stays for the rooms priced with it
    if w.status == "approved":
        # Old rooms priced with it keep working, so the row stays; it just leaves the library.
        w.status, w.moderation_note = "rejected", _HIDDEN_BY_SHOP
        await db.flush()
    else:
        await db.delete(w)
        await db.flush()
    logger.info("seller_wallpaper_removed", id=str(wallpaper_id), user_id=str(current_user.id))


# ── Orders for the caller's shop ─────────────────────────────────────────────


@router.get(
    "/orders",
    response_model=list[SellerOrderOut],
    summary="Orders placed with the caller's shop, newest first",
)
async def list_orders(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> list[SellerOrderOut]:
    store = await _require_approved_store(db, current_user)
    result = await db.execute(
        select(Order)
        .where(Order.store_id == store.id)
        .options(selectinload(Order.lines))
        .order_by(Order.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return [SellerOrderOut.model_validate(o) for o in result.scalars().all()]


@router.patch(
    "/orders/{order_id}/status",
    response_model=SellerOrderOut,
    summary="Move one of the shop's orders to its next stage",
)
async def advance_order(
    order_id: uuid_module.UUID,
    body: OrderStatusUpdate,
    current_user: CurrentUser,
    db: DbSession,
) -> SellerOrderOut:
    store = await _require_approved_store(db, current_user)
    # Locked for the update: two taps (or two devices) must not both read
    # "accepted" and each move it on, skipping a stage.
    result = await db.execute(
        select(Order)
        .where(Order.id == order_id, Order.store_id == store.id)
        .options(selectinload(Order.lines))
        .with_for_update(of=Order)
    )
    order = result.scalar_one_or_none()
    if order is None:
        # Someone else's order looks exactly like one that does not exist.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyurtma topilmadi")

    changed = change_status(order, body.status, by="seller", cancellable=SELLER_CAN_CANCEL, reason=body.reason)
    if not changed:
        return SellerOrderOut.model_validate(order)  # a repeated tap changes nothing
    await db.flush()
    logger.info("order_status_changed", order_id=str(order.id), store_id=str(store.id), status=body.status)
    # Told only once the move is durable; values copied out so the hook needs no ORM object.
    buyer_id, new_status = order.user_id, order.status

    async def _push() -> None:
        notify(buyer_id, "order_status", {"status": new_status})

    run_after_commit(db, _push)
    return SellerOrderOut.model_validate(order)
