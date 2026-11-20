from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    *,
    guest: bool = False,
) -> str:
    """Return a signed JWT access token for *subject*. *guest* marks a token
    issued to a guest account: it stops working once the row is upgraded."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.now(tz=timezone.utc) + expires_delta
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "access",
    }
    if guest:
        payload["guest"] = True
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str, expires_days: Optional[int] = None, *, guest: bool = False) -> str:
    """Return a signed JWT refresh token for *subject*, valid *expires_days*
    (default ``REFRESH_TOKEN_EXPIRE_DAYS``; guests get a longer one)."""
    if expires_days is None:
        expires_days = settings.REFRESH_TOKEN_EXPIRE_DAYS
    expire = datetime.now(tz=timezone.utc) + timedelta(days=expires_days)
    payload = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }
    if guest:
        payload["guest"] = True
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def _claims(token: str, token_type: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    return payload if payload.get("type") == token_type else None


def access_token_claims(token: str) -> Optional[dict]:
    """The claims of a valid access token, or None."""
    return _claims(token, "access")


def refresh_token_claims(token: str) -> Optional[dict]:
    """The claims of a valid refresh token, or None."""
    return _claims(token, "refresh")


def is_guest_token_of_registered(claims: dict, user) -> bool:
    """A token issued to a guest, presented for a row that is no longer one
    (upgraded): refused, so only the tokens issued at the upgrade work."""
    return claims.get("guest") is True and getattr(user, "is_guest", None) is not True


def verify_token(token: str) -> Optional[str]:
    """Decode *token* and return the ``sub`` claim, or *None* on failure.

    Only tokens with ``type == "access"`` are accepted; refresh tokens are
    explicitly rejected so they cannot be used as session credentials.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        sub: Optional[str] = payload.get("sub")
        return sub
    except JWTError:
        return None


def verify_refresh_token(token: str) -> Optional[str]:
    """Decode *token* and return the ``sub`` claim, or *None* on failure.

    Only tokens with ``type == "refresh"`` are accepted; access tokens are
    explicitly rejected so they cannot be used as refresh credentials.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        sub: Optional[str] = payload.get("sub")
        return sub
    except JWTError:
        return None
