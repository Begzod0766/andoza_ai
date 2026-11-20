from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import access_token_claims, is_guest_token_of_registered
from app.database import get_db
from app.i18n.messages import localized
from app.models.user import User

# auto_error=False — we handle the missing-token case ourselves
_bearer_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/otp/verify", auto_error=False)


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    bearer_token: Annotated[str | None, Depends(_bearer_scheme)] = None,
) -> User:
    # Cookie takes precedence over Bearer header (HttpOnly → not accessible to JS)
    token = request.cookies.get("token") or bearer_token
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    claims = access_token_claims(token)
    sub = claims.get("sub") if claims else None
    if sub is None:
        raise credentials_exception
    try:
        user_id = UUID(sub)
    except ValueError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or is_guest_token_of_registered(claims, user):
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


async def require_admin(
    current_user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    """Gate for admin-only routers (shop/3D-model management, etc.). A single
    dependency instead of an inline `if not current_user.is_admin` in every
    endpoint, since admin surfaces span many endpoints at once."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faqat administrator uchun",
        )
    return current_user


def registration_required(request: Request, feature: str) -> HTTPException:
    """The one answer a guest gets from a paid or identity endpoint (spec
    2026-11-20 mehmon rejimi). The app and the Studio match on ``code`` and
    open their sign-up prompt for ``feature``. 403, never 401: a 401 starts
    both clients' refresh/logout cycle. The global handler passes a dict
    detail through untouched, so ``message`` is localized here."""
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "registration_required",
            "feature": feature,
            "message": localized(request, "Bu imkoniyat uchun ro'yxatdan o'ting."),
        },
    )


def registered_user(feature: str) -> Callable[..., Awaitable[User]]:
    """Dependency: the signed-in user, refused with registration_required
    when it is a guest. ``is_guest is True`` (identity, not truthiness)."""

    async def registered_user_dependency(
        request: Request,
        current_user: Annotated[User, Depends(get_current_active_user)],
    ) -> User:
        if current_user.is_guest is True:
            raise registration_required(request, feature)
        return current_user

    return registered_user_dependency


# Convenience type aliases for Annotated deps
CurrentUser = Annotated[User, Depends(get_current_active_user)]
AdminUser = Annotated[User, Depends(require_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
