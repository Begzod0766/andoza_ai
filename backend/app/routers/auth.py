from __future__ import annotations

import threading
import time
from datetime import date, datetime, timezone
from typing import Annotated
from uuid import UUID

import httpx
import structlog
from jose import JWTError
from jose import jwt as jose_jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import bcrypt as _bcrypt

from app.api.v1.deps import CurrentUser, _bearer_scheme
from app.config import NATIVE_APP_ORIGINS, settings
from app.core.cache import get_redis
from app.core.security import (
    create_access_token,
    create_refresh_token,
    is_guest_token_of_registered,
    refresh_token_claims,
    verify_token,
)
from app.core.sms import generate_otp, send_otp, store_otp, verify_otp
from app.database import get_db
from app.models.user import User
from app.services.guest_account import MergeResult, merge_guest_into, upgrade_guest
from app.schemas.auth import AppleLoginRequest, DeleteAccountRequest, GoogleLoginRequest, GuestCreateRequest, LoginRequest, LoginResponse, MeUpdate, OTPRequest, OTPVerify, RegisterRequest, UserOut

def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(password: str, password_hash: str) -> bool:
    return _bcrypt.checkpw(password.encode(), password_hash.encode())

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_OTP_RATE_LIMIT = 3        # max send requests per phone per window
_OTP_RATE_WINDOW = 600     # 10 minutes
_OTP_IP_RATE_LIMIT = 10   # max send requests per IP per hour
_OTP_IP_RATE_WINDOW = 3600  # 1 hour
_OTP_MAX_ATTEMPTS = 5      # max verify attempts before lockout
_OTP_ATTEMPT_TTL = 300     # 5 minutes — same as OTP lifetime

# Password login: throttled both by IP (blocks spraying many accounts from
# one source) and by username (blocks brute-forcing one account by spreading
# requests across many IPs). Both must pass independently.
_LOGIN_IP_RATE_LIMIT = 20     # max login attempts per IP per window
_LOGIN_IP_RATE_WINDOW = 900   # 15 minutes
_LOGIN_USER_RATE_LIMIT = 10   # max login attempts per username per window
_LOGIN_USER_RATE_WINDOW = 900  # 15 minutes

# Registration: lighter IP-only throttle — each attempt creates a distinct
# account, so there is no per-username axis to protect.
_REGISTER_IP_RATE_LIMIT = 20    # max registrations per IP per window
_REGISTER_IP_RATE_WINDOW = 3600  # 1 hour

# Account deletion: password confirmation must not be brute-forceable.
_DELETE_USER_RATE_LIMIT = 5
_DELETE_USER_RATE_WINDOW = 900

# Guest sessions (POST /auth/guest): one message for all three limits, so the
# answer does not tell an abuser which axis it hit.
_GUEST_IP_RATE_WINDOW = 3600       # 1 hour
_GUEST_INSTALL_RATE_WINDOW = 86400  # 1 day
_GUEST_GLOBAL_RATE_WINDOW = 86400   # 1 day

_IS_DEV = settings.ENVIRONMENT == "development"
_COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
_REFRESH_COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

# Header the native app clients (Flutter, and the legacy Capacitor app) send
# on every request so the backend can tell them apart from a browser. This is
# the PRIMARY signal — the Origin fallback below only covers WebView-based
# native shells that set it automatically; Flutter's HTTP client does not.
_NATIVE_CLIENT_HEADER = "x-client-type"
_NATIVE_CLIENT_HEADER_VALUE = "mobile"


def _is_native_client(request: Request) -> bool:
    """True when the request came from a native app client (Flutter or the
    Capacitor/WebView shell) rather than a browser.

    Native clients don't get a browser cookie jar the way a web page does,
    so they read the access/refresh JWTs straight out of the JSON response
    body and manage them as Bearer tokens themselves. Web requests must NOT
    get tokens in the body — only in the HttpOnly cookies — so an XSS bug
    can't read them out of a fetch()/axios response.

    Two independent signals, either is sufficient:
    - `X-Client-Type: mobile` header — set explicitly by the Flutter app's
      HTTP client (see tamir_uy_mobile_flutter/lib/services/api_client.dart).
    - `Origin` header matching one of the fixed native WebView origins that
      CORS always allow-lists (settings.NATIVE_APP_ORIGINS) — covers the
      legacy Capacitor/React-Native shell, whose WebView sets Origin
      automatically and never sends the custom header above.
    """
    if request.headers.get(_NATIVE_CLIENT_HEADER, "").strip().lower() == _NATIVE_CLIENT_HEADER_VALUE:
        return True
    return request.headers.get("origin") in NATIVE_APP_ORIGINS


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=not _IS_DEV,  # HTTPS-only in production
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


def _set_refresh_cookie(response: Response, token: str, max_age: int | None = None) -> None:
    """Set the HttpOnly refresh token cookie, scoped to the refresh endpoint only.
    *max_age* defaults to the registered-user refresh lifetime."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=not _IS_DEV,
        samesite="lax",
        max_age=_REFRESH_COOKIE_MAX_AGE if max_age is None else max_age,
        path="/api/v1/auth/refresh",
    )


def _get_client_ip(request: Request) -> str:
    """Return the real client IP, respecting X-Forwarded-For when trusted."""
    if settings.TRUST_PROXY_HEADERS:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
    return request.client.host  # type: ignore[union-attr]


async def _enforce_rate_limit(
    redis, key: str, limit: int, window: int, detail: str
) -> None:
    """Increment the counter for *key* and raise 429 once *limit* is exceeded
    within *window* seconds. Same get-check-incr-expire pattern as the OTP
    per-IP/per-phone limits above."""
    count_raw = await redis.get(key)
    count = int(count_raw) if count_raw else 0
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
        )
    pipe = redis.pipeline()
    await pipe.incr(key)
    if count == 0:
        await pipe.expire(key, window)
    await pipe.execute()


async def get_guest_caller(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    bearer: Annotated[str | None, Depends(_bearer_scheme)] = None,
) -> User | None:
    """The guest making this sign-in request, if any — so the sign-in can
    upgrade it or merge it into the account. Bearer first (the native app),
    then the `token` cookie (a WebView's guest cookie must not override the
    app's own token). Only an active guest counts; a registered user's token
    is ignored, exactly as these routes always ignored tokens. Never raises:
    a sign-in must not fail over a stale or broken token."""
    for token in (bearer, request.cookies.get("token")):
        if not token:
            continue
        sub = verify_token(token)
        if sub is None:
            continue
        try:
            user_id = UUID(sub)
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        except Exception:  # noqa: BLE001 — see docstring
            logger.warning("guest_caller_lookup_failed")
            # Leave the session usable for the sign-in itself.
            try:
                await db.rollback()
            except Exception:  # noqa: BLE001
                pass
            return None
        if user is not None and user.is_active and user.is_guest is True:
            return user
        # A valid token of someone who is not a guest: no guest here.
        return None
    return None


GuestCaller = Annotated[User | None, Depends(get_guest_caller)]


@router.post(
    "/otp/request",
    status_code=status.HTTP_200_OK,
    summary="Request an OTP via SMS",
)
async def request_otp(body: OTPRequest, request: Request) -> dict[str, str]:
    """Rate-limited: max 3 sends per phone per 10 min, 10 per IP per hour, 2000 globally per day."""
    redis = get_redis()

    # --- global daily cap ---
    today_key = f"otp_global_daily:{date.today().isoformat()}"
    global_count_raw = await redis.incr(today_key)
    if global_count_raw == 1:
        # first increment today — set TTL so the key expires at end of day
        await redis.expire(today_key, 86400)
    if global_count_raw > settings.OTP_GLOBAL_DAILY_LIMIT:
        logger.error("otp_daily_limit_exceeded", count=global_count_raw)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OTP service temporarily unavailable. Try again later.",
        )

    # --- per-IP rate limit ---
    client_ip = _get_client_ip(request)
    ip_key = f"otp_ip_rate:{client_ip}"
    ip_count_raw = await redis.get(ip_key)
    ip_count = int(ip_count_raw) if ip_count_raw else 0
    if ip_count >= _OTP_IP_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests from this IP. Please wait before trying again.",
        )
    ip_pipe = redis.pipeline()
    await ip_pipe.incr(ip_key)
    if ip_count == 0:
        await ip_pipe.expire(ip_key, _OTP_IP_RATE_WINDOW)
    await ip_pipe.execute()

    # --- per-phone rate limit ---
    rate_key = f"otp_rate:{body.phone}"
    count_raw = await redis.get(rate_key)
    count = int(count_raw) if count_raw else 0
    if count >= _OTP_RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests. Please wait before trying again.",
        )

    pipe = redis.pipeline()
    await pipe.incr(rate_key)
    if count == 0:
        await pipe.expire(rate_key, _OTP_RATE_WINDOW)
    await pipe.execute()

    code = generate_otp()
    await store_otp(body.phone, code, redis)

    try:
        delivered = await send_otp(body.phone, code)
        if not delivered:
            logger.warning("sms_delivery_failed", phone=body.phone)
    except Exception as exc:
        logger.error("sms_error", phone=body.phone, error=str(exc))

    logger.info("otp_requested", phone=body.phone)
    return {"message": "SMS yuborildi"}


@router.post(
    "/otp/verify",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify OTP, set HttpOnly cookie, return user info",
)
async def verify_otp_endpoint(
    body: OTPVerify,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    guest: GuestCaller,
) -> LoginResponse:
    """Brute-force guarded (max 5 attempts per 5-min window).
    On success: sets HttpOnly JWT cookies. JWTs are also echoed in the
    response body, but only for native app clients — see _is_native_client()."""
    redis = get_redis()

    attempts_key = f"otp_attempts:{body.phone}"
    attempts_raw = await redis.get(attempts_key)
    attempts = int(attempts_raw) if attempts_raw else 0
    if attempts >= _OTP_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Wait 5 minutes and request a new OTP.",
        )

    is_valid = await verify_otp(body.phone, body.code, redis)
    if not is_valid:
        pipe = redis.pipeline()
        await pipe.incr(attempts_key)
        if attempts == 0:
            await pipe.expire(attempts_key, _OTP_ATTEMPT_TTL)
        await pipe.execute()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code.",
        )

    await redis.delete(attempts_key)

    result = await db.execute(select(User).where(User.phone == body.phone))
    user = result.scalar_one_or_none()
    merged: MergeResult | None = None
    if user is None and guest is not None:
        # A new phone: the guest becomes this account, rooms and all (None:
        # a concurrent sign-up upgraded it first — make a fresh account).
        user = await upgrade_guest(db, guest, phone=body.phone)
    if user is None:
        user = User(phone=body.phone, registered_at=datetime.now(timezone.utc))
        db.add(user)
        await db.flush()
        # Same reason as register(): populate server defaults (created_at)
        # so the freshly-created user serialises into a complete LoginResponse.
        await db.refresh(user)
    elif guest is not None and user.is_active and user.id != guest.id:
        merged = await merge_guest_into(db, guest.id, user)

    logger.info("user_authenticated", user_id=str(user.id), phone=body.phone)

    return _login_response(user, request, response, merged)


@router.get(
    "/me",
    response_model=UserOut,
    summary="Return current user from cookie session",
)
async def get_me(current_user: CurrentUser) -> UserOut:
    return UserOut.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserOut,
    summary="Update the current user's settings (interface language)",
)
async def update_me(
    body: MeUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserOut:
    current_user.language = body.language
    db.add(current_user)
    await db.flush()
    return UserOut.model_validate(current_user)


@router.post(
    "/refresh",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate access + refresh tokens using the refresh cookie",
)
async def refresh_tokens(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> LoginResponse:
    """Consume the refresh_token cookie and issue fresh access + refresh cookies.

    Returns 401 if the cookie is missing, invalid, or expired.
    """
    if refresh_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing.",
        )

    claims = refresh_token_claims(refresh_token)
    user_id = claims.get("sub") if claims else None
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    # Locked and read fresh: a merge deleting this row now waits for the
    # refresh to commit, or has already deleted it (no row: 401) — never a
    # 500 from writing last_seen_at to a row that vanished meanwhile.
    try:
        user_uuid = UUID(str(user_id))
    except ValueError:
        user_uuid = None
    user = None
    if user_uuid is not None:
        user = (
            await db.execute(
                select(User).where(User.id == user_uuid).with_for_update()
                .execution_options(populate_existing=True)
            )
        ).scalar_one_or_none()
    if user is None or is_guest_token_of_registered(claims, user):
        # 401, not 404: a guest merged into another account (or deleted) has
        # no row any more, and its old refresh token must end the session
        # the way any dead token does. A guest's token after an upgrade is
        # dead too: the upgrade issued new ones.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )

    # Stale guests are cleaned up by this (app/tasks/maintenance.py).
    user.last_seen_at = datetime.now(timezone.utc)

    logger.info("tokens_rotated", user_id=user_id)

    # The lifetime follows what the row is NOW: a guest token refreshed after
    # an upgrade gets the registered (shorter) refresh token.
    return _login_response(user, request, response)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Clear the auth and refresh cookies",
)
async def logout(response: Response):  # noqa: ANN201 — 204 No Content, no body
    response.delete_cookie(key="token", path="/", samesite="lax")
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth/refresh",
        samesite="lax",
    )


@router.post(
    "/register",
    response_model=LoginResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register with username and password",
)
async def register(
    body: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    guest: GuestCaller,
) -> LoginResponse:
    """Rate-limited: max registrations per IP per hour to prevent mass account creation."""
    redis = get_redis()
    client_ip = _get_client_ip(request)
    await _enforce_rate_limit(
        redis,
        f"register_ip_rate:{client_ip}",
        _REGISTER_IP_RATE_LIMIT,
        _REGISTER_IP_RATE_WINDOW,
        "Bu IP manzildan juda ko'p ro'yxatdan o'tish urinishi bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )

    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu username allaqachon band.",
        )

    password_hash = _hash_password(body.password)
    user = None
    if guest is not None:
        # The guest becomes this account in place (same id, same rooms) and
        # keeps the language it already has. None: a concurrent sign-up
        # upgraded it first, so this one gets an account of its own.
        user = await upgrade_guest(
            db, guest,
            username=body.username,
            password_hash=password_hash,
            name=body.name,
        )
    if user is None:
        user = User(
            username=body.username,
            password_hash=password_hash,
            name=body.name,
            language=body.language or "uz",
            registered_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()
        # Reload so server-side defaults (created_at) are populated before we
        # serialise UserOut — otherwise the response is an incomplete
        # LoginResponse (missing created_at) and validation 500s. This makes
        # register return the SAME fully-loaded user shape as /login.
        await db.refresh(user)

    logger.info("user_registered", user_id=str(user.id), username=body.username)

    return _login_response(user, request, response)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with username and password",
)
async def login_with_password(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    guest: GuestCaller,
) -> LoginResponse:
    """Rate-limited by IP (anti credential-spraying) and by username
    (anti brute-force), each independently, before any credential check runs."""
    redis = get_redis()
    client_ip = _get_client_ip(request)
    await _enforce_rate_limit(
        redis,
        f"login_ip_rate:{client_ip}",
        _LOGIN_IP_RATE_LIMIT,
        _LOGIN_IP_RATE_WINDOW,
        "Bu IP manzildan juda ko'p kirish urinishi bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )
    await _enforce_rate_limit(
        redis,
        f"login_user_rate:{body.username}",
        _LOGIN_USER_RATE_LIMIT,
        _LOGIN_USER_RATE_WINDOW,
        "Bu hisob uchun juda ko'p kirish urinishi bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )

    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()

    if user is None or user.password_hash is None or not _verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username yoki parol noto'g'ri.",
        )

    # Not into an inactive account: the guest's rooms would be stranded there.
    merged = await merge_guest_into(db, guest.id, user) if guest is not None and user.is_active else None

    logger.info("user_logged_in", user_id=str(user.id), username=body.username)

    return _login_response(user, request, response, merged)


def _login_response(
    user: User, request: Request, response: Response, merged: MergeResult | None = None
) -> LoginResponse:
    """Sign *user* in: set the auth cookies and build the LoginResponse
    (tokens echoed in the body for native clients only). Shared by every
    sign-in route so all answer identically. *merged* is the guest merged
    into *user* by this sign-in, if any."""
    if user.is_guest is True:
        return _guest_login_response(user, request, response)
    subject = str(user.id)
    access_token = create_access_token(subject)
    refresh_token = create_refresh_token(subject)
    _set_auth_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)

    is_native = _is_native_client(request)
    return LoginResponse(
        user=UserOut.model_validate(user),
        access_token=access_token if is_native else None,
        refresh_token=refresh_token if is_native else None,
        guest_merged_rooms=merged.rooms if merged else None,
    )


def _guest_login_response(user: User, request: Request, response: Response) -> LoginResponse:
    """_login_response for a guest: the refresh token (and its cookie) lives
    GUEST_REFRESH_TOKEN_EXPIRE_DAYS — it is the guest's only "password"."""
    subject = str(user.id)
    days = settings.GUEST_REFRESH_TOKEN_EXPIRE_DAYS
    access_token = create_access_token(subject, guest=True)
    refresh_token = create_refresh_token(subject, expires_days=days, guest=True)
    _set_auth_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token, max_age=days * 86400)

    is_native = _is_native_client(request)
    return LoginResponse(
        user=UserOut.model_validate(user),
        access_token=access_token if is_native else None,
        refresh_token=refresh_token if is_native else None,
    )


@router.post(
    "/guest",
    response_model=LoginResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Open a guest session (no sign-up)",
)
async def create_guest(
    body: GuestCreateRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoginResponse:
    """A new guest user with no phone/username/email/sub. Free features work
    for it; paid and identity ones answer 403 registration_required. Off
    unless GUEST_MODE_ENABLED. Rate-limited per IP, per app install and
    globally per day."""
    if not settings.GUEST_MODE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mehmon rejimi hozircha yoqilmagan.",
        )

    redis = get_redis()
    await _enforce_rate_limit(
        redis,
        f"guest_ip_rate:{_get_client_ip(request)}",
        settings.GUEST_IP_RATE_LIMIT,
        _GUEST_IP_RATE_WINDOW,
        "Juda ko'p mehmon sessiyasi ochildi. Birozdan keyin qayta urinib ko'ring.",
    )
    if body.install_id is not None:
        await _enforce_rate_limit(
            redis,
            f"guest_install_rate:{body.install_id}",
            settings.GUEST_INSTALL_RATE_LIMIT,
            _GUEST_INSTALL_RATE_WINDOW,
            "Juda ko'p mehmon sessiyasi ochildi. Birozdan keyin qayta urinib ko'ring.",
        )
    await _enforce_rate_limit(
        redis,
        "guest_global_daily",
        settings.GUEST_GLOBAL_DAILY_LIMIT,
        _GUEST_GLOBAL_RATE_WINDOW,
        "Juda ko'p mehmon sessiyasi ochildi. Birozdan keyin qayta urinib ko'ring.",
    )

    user = User(
        is_guest=True,
        language=body.language or "uz",
        last_seen_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    # Load server defaults (created_at) so UserOut serialises fully.
    await db.refresh(user)

    # user_id only: no IP or install id in the log.
    logger.info("guest_created", user_id=str(user.id))
    return _guest_login_response(user, request, response)


_GOOGLE_ISSUERS = frozenset({"accounts.google.com", "https://accounts.google.com"})
_GOOGLE_IP_RATE_LIMIT = 20     # max Google sign-in attempts per IP per window
_GOOGLE_IP_RATE_WINDOW = 900   # 15 minutes
_GOOGLE_INVALID_DETAIL = "Google orqali kirib bo'lmadi. Qayta urinib ko'ring."


class _GoogleUnavailable(Exception):
    """Google's signing certs could not be fetched (network/outage)."""


def _verify_google_id_token(token: str, client_ids: list[str]) -> dict:
    """Check the ID token's signature (against Google's published certs),
    expiry and audience, and return its claims. Raises ValueError if it is not
    a valid token for one of *client_ids*, _GoogleUnavailable if the certs
    could not be fetched. Blocking (may fetch certs): call it off the event
    loop. Tests replace this function so no network is used."""
    from google.auth import exceptions as google_exceptions
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        return google_id_token.verify_oauth2_token(
            token, google_requests.Request(), audience=client_ids
        )
    except google_exceptions.TransportError as exc:
        raise _GoogleUnavailable(str(exc)) from exc


@router.post(
    "/google",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in with a Google ID token",
)
async def login_with_google(
    body: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    guest: GuestCaller,
) -> LoginResponse:
    """Exchange a Google ID token (from Google Identity Services on the web,
    or Google Sign-In on Android/iOS) for our own session.

    The user is found by the token's `sub` (Google's stable account id); a
    first sign-in creates a new account. It is deliberately NEVER linked to an
    existing username/password or phone account by email: that would let
    whoever controls a Google account with a matching email take the other
    account over."""
    client_ids = settings.GOOGLE_CLIENT_ID_LIST
    if not client_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google orqali kirish hozircha mavjud emas.",
        )

    redis = get_redis()
    await _enforce_rate_limit(
        redis,
        f"google_ip_rate:{_get_client_ip(request)}",
        _GOOGLE_IP_RATE_LIMIT,
        _GOOGLE_IP_RATE_WINDOW,
        "Bu IP manzildan juda ko'p kirish urinishi bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )

    try:
        claims = await run_in_threadpool(_verify_google_id_token, body.id_token, client_ids)
    except _GoogleUnavailable as exc:
        logger.warning("google_certs_unavailable", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google bilan bog'lanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
        ) from exc
    except ValueError as exc:
        logger.info("google_login_rejected", reason=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_GOOGLE_INVALID_DETAIL
        ) from exc

    # Checked again here, not only by the library: the audience/issuer rules
    # are ours, and must hold whatever the verifier's defaults are.
    sub = claims.get("sub")
    if (
        not sub
        or claims.get("aud") not in client_ids
        or claims.get("iss") not in _GOOGLE_ISSUERS
    ):
        logger.info("google_login_rejected", reason="claims", aud=claims.get("aud"))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_GOOGLE_INVALID_DETAIL
        )
    if claims.get("email_verified") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google hisobingizdagi email tasdiqlanmagan.",
        )

    result = await db.execute(select(User).where(User.google_sub == sub))
    user = result.scalar_one_or_none()
    merged: MergeResult | None = None

    if user is None:
        name = (claims.get("name") or "").strip()[:100] or None
        email = (claims.get("email") or "").strip()[:255] or None
        if guest is not None:
            user = await upgrade_guest(db, guest, google_sub=sub, email=email, name=name)
        if user is None:
            user = User(
                google_sub=sub, email=email, name=name, language=body.language or "uz",
                registered_at=datetime.now(timezone.utc),
            )
            db.add(user)
            await db.flush()
            # Load server defaults (created_at) so UserOut serialises fully,
            # exactly as register() does.
            await db.refresh(user)
        logger.info("user_registered_google", user_id=str(user.id))
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_GOOGLE_INVALID_DETAIL
        )
    elif guest is not None:
        merged = await merge_guest_into(db, guest.id, user)

    logger.info("user_logged_in_google", user_id=str(user.id))
    return _login_response(user, request, response, merged)


_APPLE_ISSUER = "https://appleid.apple.com"
_APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
_APPLE_KEYS_TTL = 24 * 3600        # Apple rotates its keys rarely
_APPLE_KEYS_MIN_REFETCH = 60       # an unknown `kid` refetches at most once a minute
_APPLE_IP_RATE_LIMIT = 20          # max Apple sign-in attempts per IP per window
_APPLE_IP_RATE_WINDOW = 900        # 15 minutes
_APPLE_INVALID_DETAIL = "Apple orqali kirib bo'lmadi. Qayta urinib ko'ring."

# In-process cache of Apple's public signing keys, by `kid`.
_apple_keys: dict[str, dict] = {}
_apple_keys_fetched_at = 0.0
_apple_keys_lock = threading.Lock()


class _AppleUnavailable(Exception):
    """Apple's signing keys could not be fetched (network/outage)."""


def _fetch_apple_keys() -> None:
    global _apple_keys, _apple_keys_fetched_at
    try:
        res = httpx.get(_APPLE_KEYS_URL, timeout=10)
        res.raise_for_status()
        keys = res.json()["keys"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise _AppleUnavailable(str(exc)) from exc
    _apple_keys = {k["kid"]: k for k in keys if isinstance(k, dict) and "kid" in k}
    _apple_keys_fetched_at = time.monotonic()


def _apple_key(kid: str) -> dict | None:
    """Apple's public key *kid*, from the cache while it is fresh. A kid we
    have not seen refetches once (Apple may have rotated), but not more than
    once a minute, so random kids cannot turn into a stream of fetches."""
    with _apple_keys_lock:
        age = time.monotonic() - _apple_keys_fetched_at
        if not _apple_keys or age > _APPLE_KEYS_TTL or (
            kid not in _apple_keys and age > _APPLE_KEYS_MIN_REFETCH
        ):
            _fetch_apple_keys()
        return _apple_keys.get(kid)


def _verify_apple_identity_token(token: str, client_ids: list[str]) -> dict:
    """Check the identity token's RS256 signature (against Apple's published
    keys), issuer, audience and expiry, and return its claims. Raises
    ValueError if it is not a valid token for one of *client_ids*,
    _AppleUnavailable if the keys could not be fetched. Blocking (may fetch
    keys): call it off the event loop. Tests replace this function so no
    network is used."""
    try:
        header = jose_jwt.get_unverified_header(token)
    except JWTError as exc:
        raise ValueError(f"malformed token: {exc}") from exc
    if header.get("alg") != "RS256" or not header.get("kid"):
        raise ValueError("unexpected token header")
    key = _apple_key(header["kid"])
    if key is None:
        raise ValueError("unknown signing key")
    try:
        # aud is checked below against the whole list; jose takes one value.
        claims = jose_jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=_APPLE_ISSUER,
            options={"verify_aud": False, "require_exp": True},
        )
    except JWTError as exc:
        raise ValueError(str(exc)) from exc
    if claims.get("aud") not in client_ids:
        raise ValueError("wrong audience")
    return claims


@router.post(
    "/apple",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="Sign in with an Apple identity token",
)
async def login_with_apple(
    body: AppleLoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    guest: GuestCaller,
) -> LoginResponse:
    """Exchange a Sign in with Apple identity token for our own session.

    Same rules as the Google login: the user is found by the token's `sub`
    (Apple's stable account id), a first sign-in creates a new account, and
    it is NEVER linked to another account by email. Apple puts no name in
    the token; the app forwards the one Apple gave it on the first
    authorization, and it is used only when the account is created."""
    client_ids = settings.APPLE_CLIENT_ID_LIST
    if not client_ids:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple orqali kirish hozircha mavjud emas.",
        )

    redis = get_redis()
    await _enforce_rate_limit(
        redis,
        f"apple_ip_rate:{_get_client_ip(request)}",
        _APPLE_IP_RATE_LIMIT,
        _APPLE_IP_RATE_WINDOW,
        "Bu IP manzildan juda ko'p kirish urinishi bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )

    try:
        claims = await run_in_threadpool(
            _verify_apple_identity_token, body.identity_token, client_ids
        )
    except _AppleUnavailable as exc:
        logger.warning("apple_keys_unavailable", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Apple bilan bog'lanib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
        ) from exc
    except ValueError as exc:
        logger.info("apple_login_rejected", reason=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_APPLE_INVALID_DETAIL
        ) from exc

    # Checked again here, as for Google: the audience/issuer rules are ours.
    sub = claims.get("sub")
    if not sub or claims.get("aud") not in client_ids or claims.get("iss") != _APPLE_ISSUER:
        logger.info("apple_login_rejected", reason="claims", aud=claims.get("aud"))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_APPLE_INVALID_DETAIL
        )

    result = await db.execute(select(User).where(User.apple_sub == sub))
    user = result.scalar_one_or_none()
    merged: MergeResult | None = None

    if user is None:
        name = (body.name or "").strip()[:100] or None
        # May be an @privaterelay.appleid.com address: kept for display only.
        email = (claims.get("email") or "").strip()[:255] or None
        if guest is not None:
            user = await upgrade_guest(db, guest, apple_sub=sub, email=email, name=name)
        if user is None:
            user = User(
                apple_sub=sub, email=email, name=name, language=body.language or "uz",
                registered_at=datetime.now(timezone.utc),
            )
            db.add(user)
            await db.flush()
            # Load server defaults (created_at) so UserOut serialises fully.
            await db.refresh(user)
        logger.info("user_registered_apple", user_id=str(user.id))
    elif not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=_APPLE_INVALID_DETAIL
        )
    elif guest is not None:
        merged = await merge_guest_into(db, guest.id, user)

    logger.info("user_logged_in_apple", user_id=str(user.id))
    return _login_response(user, request, response, merged)


@router.post(
    "/delete-account",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Permanently delete the signed-in user's account and data",
)
async def delete_my_account(
    body: DeleteAccountRequest,
    request: Request,
    response: Response,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Irreversible. Accounts with a password must confirm it; phone/OTP,
    Google and Apple accounts have none. Admins cannot delete themselves here. Rate-limited per
    user so the password prompt cannot be brute-forced."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator hisobini bu yerdan o'chirib bo'lmaydi",
        )
    await _enforce_rate_limit(
        get_redis(),
        f"delete_account_rate:{current_user.id}",
        _DELETE_USER_RATE_LIMIT,
        _DELETE_USER_RATE_WINDOW,
        "Juda ko'p urinish bo'ldi. Birozdan keyin qayta urinib ko'ring.",
    )
    if current_user.password_hash is not None and (
        not body.password or not _verify_password(body.password, current_user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Parol noto'g'ri")

    # Imported here: the service reuses app.routers.admin_catalog helpers, and a
    # module-level import would be circular through app.routers.__init__.
    from app.services.account_deletion import delete_account

    await delete_account(db, current_user)

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(key="token", path="/", samesite="lax")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh", samesite="lax")
    return response
