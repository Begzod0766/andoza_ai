# Mehmon rejimi — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest `User` row that the app gets from `POST /auth/guest`, that can use every free endpoint, is refused every paid/identity one with one fixed 403, and turns into (upgrade) or moves into (merge) a real account on sign-in.

**Architecture:** One new column set on `users` and one dependency factory `registered_user(feature)` in `deps.py`; all ownership checks stay as they are. Upgrade/merge live in a new service `app/services/guest_account.py`, called from the existing auth routes when an optional guest caller is present. A first Celery beat entry deletes stale guests through the existing `account_deletion.delete_account`.

**Tech Stack:** FastAPI, SQLAlchemy 2 async, Alembic, Redis (fakeredis in tests), Celery beat, pytest (DB stubbed, as in `tests/test_account_deletion.py` and `tests/test_auth_google.py`).

**Spec:** `docs/superpowers/specs/2026-11-20-mehmon-rejimi-design.md`

## Global Constraints

- 403 contract: `{"detail": {"code": "registration_required", "feature": "<feature>", "message": "<localized>"}}`, HTTP 403, never 401.
- Feature keys: `ai_design`, `ai_build`, `smeta_ask`, `render`, `photo_model`, `mebel_ai`, `contact`, `order`, `workshop_link`, `business` (server); `market_prices` is client-only (never sent by the server).
- Rate limits on `/auth/guest`: `guest_ip_rate:{ip}` 30 / 3600 s, `guest_install_rate:{install_id}` 3 / 86400 s, `guest_global_daily` 5000 / 86400 s; `GUEST_MODE_ENABLED: bool = False` (off → 503).
- Tokens: access 30 min (unchanged); refresh 30 days for registered, `GUEST_REFRESH_TOKEN_EXPIRE_DAYS = 90` for guests.
- Cleanup: guest with no live room idle > 14 days; any guest idle > 100 days; idle = `coalesce(last_seen_at, created_at)`.
- JSON fields: `UserOut.is_guest: bool = False`, `LoginResponse.guest_merged_rooms: int | None = None`, `EstimateResponse.prices_approximate_for_guest: bool = False`.
- Guest estimate note (uz/ru/en): "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi." / "Цены ориентировочные. После регистрации они будут уточнены." / "Prices are approximate. Sign up to get them refined."
- Room share link stays OPEN for guests.
- Never log request/response bodies, phone numbers of guests, IPs or install ids in new log events.
- Run tests: `cd backend && uv run --python 3.11 --with-requirements requirements.txt --with-requirements requirements-test.txt pytest <paths>` (no `timeout` on macOS).
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- Merge where the target already has a `price_books` row (PK = `user_id`): must drop the guest's, not raise IntegrityError → Task 7 `test_merge_price_book_conflict_keeps_target`.
- An old app build (no guest, no token) hitting the new login routes must get the exact same response as today plus only `guest_merged_rooms: null` → Task 8 `test_login_without_guest_token_unchanged`.
- A guest token on the streaming `POST /rooms/{id}/ai-build` must get the JSON 403 before any SSE byte, also when `AI_FEATURES_ENABLED=false` → Task 4 `test_ai_build_stream_rejects_guest_before_stream`.
- A refresh racing an upgrade/merge: old guest refresh token after upgrade → 30-day token; after merge (row gone) → 401, never a new user → Task 3 `test_refresh_after_merge_is_401` / `test_refresh_after_upgrade_gets_registered_ttl`.
- Cleanup racing an upgrade: a guest selected for deletion that upgraded meanwhile must survive → Task 9 `test_cleanup_rechecks_is_guest_before_delete`.

## File Structure

- `backend/app/models/user.py` — + `is_guest`, `last_seen_at`, `registered_at`.
- `backend/alembic/versions/1786000052_users_guest_mode.py` — the three columns, partial index, backfill `registered_at`.
- `backend/app/schemas/auth.py` — `UserOut.is_guest`, `LoginResponse.guest_merged_rooms`, `GuestCreateRequest`.
- `backend/app/config.py` — guest settings.
- `backend/app/core/security.py` — `create_refresh_token(..., expires_days)`.
- `backend/app/api/v1/deps.py` — `registration_required`, `registered_user`.
- `backend/app/i18n/messages.py` — the 403 message (ru/en).
- `backend/app/routers/auth.py` — `/auth/guest`, `get_guest_caller`, upgrade/merge in register/otp/google/apple/login, guest TTL + `last_seen_at` in refresh.
- `backend/app/routers/{ai,render,photo_model,mebel,leads,shop_inquiries,orders,seller,usta_profile,usta_portfolio}.py` — gating.
- `backend/app/routers/estimate.py`, `backend/app/schemas/estimate.py`, `backend/app/services/smeta_text.py` — guest estimate + PDF note.
- `backend/app/services/guest_account.py` — `upgrade_guest`, `merge_guest_into`, `MergeResult`.
- `backend/app/tasks/maintenance.py`, `backend/celery_app.py` — cleanup task + first `beat_schedule`.
- `docs/CONFIGURATION.md` — new env vars, the real-client-IP gate (`TRUST_PROXY_HEADERS` stays off).
- Tests: `backend/tests/test_guest_model.py`, `test_auth_guest.py`, `test_guest_refresh.py`, `test_guest_gating.py`, `test_estimate_guest.py`, `test_guest_account.py`, `test_guest_upgrade.py`, `test_guest_cleanup.py`.

---

### Task 1: Guest columns, migration, `/auth/me`

**Files:** Modify `backend/app/models/user.py`, `backend/app/schemas/auth.py`; Create `backend/alembic/versions/1786000052_users_guest_mode.py`; Test `backend/tests/test_guest_model.py`

**Interfaces:** Produces `User.is_guest: Mapped[bool]` (`default=False, server_default="false", nullable=False`), `User.last_seen_at: Mapped[datetime | None]`, `User.registered_at: Mapped[datetime | None]` (both `DateTime(timezone=True)`); `UserOut.is_guest: bool = False`.

- [ ] Test:
```python
def test_migration_chain():
    m = importlib.import_module("alembic.versions.1786000052_users_guest_mode")  # or load by path
    assert (m.revision, m.down_revision) == ("1786000052", "1786000051")

def test_user_out_carries_is_guest():
    u = User(id=uuid.uuid4(), is_guest=True, language="uz", is_admin=False, created_at=datetime.now(timezone.utc))
    assert UserOut.model_validate(u).is_guest is True
    assert UserOut.model_fields["is_guest"].default is False

def test_me_for_guest(client):  # override get_current_active_user with the guest above
    body = client.get("/api/v1/auth/me").json()
    assert body["is_guest"] is True and body["phone"] is None and body["username"] is None
```
- [ ] Run `pytest tests/test_guest_model.py` → fails (`ModuleNotFoundError` / missing field).
- [ ] Implement the columns and schema field. Migration: `upgrade()` adds the three columns, `CREATE INDEX ix_users_is_guest ON users (id) WHERE is_guest`, `UPDATE users SET registered_at = created_at`; `downgrade()` drops them. Load the module in the test with `importlib.util.spec_from_file_location` (file name starts with a digit).
- [ ] Run → pass. Commit `feat(auth): guest columns on users`.

### Task 2: `POST /auth/guest` with rate limits

**Files:** Modify `backend/app/config.py`, `backend/app/core/security.py`, `backend/app/schemas/auth.py`, `backend/app/routers/auth.py`, `docs/CONFIGURATION.md`; Test `backend/tests/test_auth_guest.py`

**Interfaces:**
- Consumes `User.is_guest`, `_enforce_rate_limit`, `_get_client_ip`, `_is_native_client`.
- Produces settings `GUEST_MODE_ENABLED: bool = False`, `GUEST_REFRESH_TOKEN_EXPIRE_DAYS: int = 90`, `GUEST_IP_RATE_LIMIT: int = 30`, `GUEST_INSTALL_RATE_LIMIT: int = 3`, `GUEST_GLOBAL_DAILY_LIMIT: int = 5000`, `GUEST_CLEANUP_EMPTY_DAYS: int = 14`, `GUEST_CLEANUP_IDLE_DAYS: int = 100`.
- `create_refresh_token(subject: str, expires_days: int | None = None) -> str` (None → `REFRESH_TOKEN_EXPIRE_DAYS`).
- `class GuestCreateRequest(BaseModel): install_id: UUID | None = None; language: Literal["uz","ru","en"] | None = None`.
- `_guest_login_response(user: User, request: Request, response: Response) -> LoginResponse` — like `_login_response` but refresh TTL 90 days; `_login_response` delegates to it when `user.is_guest is True`.
- Route `POST /auth/guest`, 201, `response_model=LoginResponse`: `async def create_guest(body: GuestCreateRequest, request: Request, response: Response, db) -> LoginResponse`.

- [ ] Test (`X-Client-Type: mobile`, fake DB like `tests/test_auth_google.py::_FakeUserDb`):
```python
def test_off_by_default(client): assert client.post(URL, json={}).status_code == 503
def test_creates_guest(client, guest_on):
    r = client.post(URL, json={"install_id": str(uuid.uuid4()), "language": "ru"}, headers=NATIVE)
    assert r.status_code == 201
    b = r.json(); assert b["user"]["is_guest"] is True and b["user"]["language"] == "ru"
    assert b["access_token"] and b["refresh_token"]
    exp = jwt.get_unverified_claims(b["refresh_token"])["exp"]
    assert 89 * 86400 < exp - time.time() <= 90 * 86400
    added = db.added[0]; assert added.phone is None and added.username is None and added.last_seen_at is not None
def test_ip_limit(client, guest_on):
    codes = [client.post(URL, json={}, headers=NATIVE).status_code for _ in range(31)]
    assert codes[:30] == [201] * 30 and codes[30] == 429
def test_install_limit(client, guest_on):
    iid = str(uuid.uuid4())
    assert [client.post(URL, json={"install_id": iid}, headers=NATIVE).status_code for _ in range(4)] == [201, 201, 201, 429]
def test_global_limit(client, guest_on, monkeypatch):
    monkeypatch.setattr(settings, "GUEST_GLOBAL_DAILY_LIMIT", 2)
    assert [client.post(URL, json={}, headers=NATIVE).status_code for _ in range(3)][-1] == 429
def test_web_gets_cookies_not_body_tokens(client, guest_on):
    r = client.post(URL, json={}); assert r.json()["access_token"] is None and "token" in r.cookies
```
- [ ] Run `pytest tests/test_auth_guest.py` → 404 on the route.
- [ ] Implement. Order inside the route: flag check (503 `"Mehmon rejimi hozircha yoqilmagan."`) → IP limit → install limit (only when `install_id`) → global limit → `User(is_guest=True, language=body.language or "uz", last_seen_at=now)` → flush/refresh → `logger.info("guest_created", user_id=...)` → `_guest_login_response`. Add the settings rows and a line to `docs/CONFIGURATION.md`: keep `TRUST_PROXY_HEADERS` off (it would trust the client-written `X-Forwarded-For[0]`), and before `GUEST_MODE_ENABLED=true` verify that uvicorn's `--proxy-headers` gives real client IPs. (Corrected after the 2026-11-20 review.)
- [ ] Run → pass. Commit `feat(auth): POST /auth/guest`.

### Task 3: Refresh for guests

**Files:** Modify `backend/app/routers/auth.py` (`refresh_tokens`); Test `backend/tests/test_guest_refresh.py`

**Interfaces:** Consumes `create_refresh_token(expires_days)`, `User.last_seen_at`. Produces: refresh issues a 90-day refresh token when `user.is_guest`, 30-day otherwise; sets `user.last_seen_at = now` for every user; a refresh token whose user row is gone answers **401** `"Invalid or expired refresh token."` (was 404).

- [ ] Test:
```python
def test_guest_refresh_is_90_days(...)            # exp - now within (89d, 90d]; db user.last_seen_at set
def test_refresh_after_upgrade_gets_registered_ttl(...)  # token minted while guest; row now is_guest=False → exp within (29d, 30d]
def test_refresh_after_merge_is_401(...)          # row lookup returns None → 401; db.add never called
```
- [ ] Run → the 90-day and 401 assertions fail.
- [ ] Implement; keep the cookie-only input (`refresh_token: Cookie()`), unchanged for old clients.
- [ ] Run → pass; also run `tests/test_auth_router.py tests/test_auth_token_body_gating.py` (adjust any test that asserted 404 for a missing user to 401). Commit `feat(auth): guest refresh TTL and last_seen_at`.

### Task 4: `registered_user` and the paid endpoints (spec table A)

**Files:** Modify `backend/app/api/v1/deps.py`, `backend/app/i18n/messages.py`, `backend/app/routers/ai.py`, `backend/app/routers/render.py`, `backend/app/routers/photo_model.py`, `backend/app/routers/mebel.py`; Test `backend/tests/test_guest_gating.py`

**Interfaces:**
- `def registration_required(request: Request, feature: str) -> HTTPException` — 403, detail `{"code": "registration_required", "feature": feature, "message": localized(request, "Bu imkoniyat uchun ro'yxatdan o'ting.")}`.
- `def registered_user(feature: str) -> Callable[..., Awaitable[User]]` — depends on `get_current_active_user`; raises `registration_required` when `user.is_guest is True` (identity check, so existing tests' `MagicMock` users, whose `.is_guest` is a truthy mock, stay registered), else returns the user.
- Gated with `current_user: Annotated[User, Depends(registered_user("<f>"))]`: `POST /rooms/{room_id}/ai-design`, `/ai-design/image`, `/ai-design/pin` → `ai_design`; `POST /rooms/{room_id}/ai-build` → `ai_build`; `POST /rooms/{room_id}/smeta/ask` → `smeta_ask`; `POST /render`, `/render/relight`, `/render/upscale` → `render`; `POST /models/from-photo`, `GET /models/from-photo/glb` → `photo_model` (before `_require_model_builder`); `POST /mebel/ai/suggest` → `mebel_ai`.
- Produces `GATED_ROUTES: dict[tuple[str, str], str]` in the test module, reused by Task 5.

- [ ] Test:
```python
@pytest.mark.parametrize(("method", "path", "feature"), PAID)   # the 11 routes above, ids filled with uuid4()
def test_guest_gets_registration_required(client, as_guest, method, path, feature):
    r = client.request(method, path, json={}, files=None)
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "registration_required" and r.json()["detail"]["feature"] == feature
    assert isinstance(r.json()["detail"]["message"], str)

@pytest.mark.parametrize(...)  # same table, registered user
def test_registered_user_not_gated(...):  # status may be 404/422/503 — only assert detail is not the guest dict

def test_ai_build_stream_rejects_guest_before_stream(client, as_guest, monkeypatch):
    for flag in (False, True):
        monkeypatch.setattr(settings, "AI_FEATURES_ENABLED", flag)
        r = client.post(f"/api/v1/rooms/{uuid.uuid4()}/ai-build", json={"prompt": "x"})
        assert r.status_code == 403 and r.headers["content-type"].startswith("application/json")

def test_message_is_localized(client, as_guest):
    r = client.post("/api/v1/render", headers={"Accept-Language": "ru"}, files={"file": ("a.jpg", b"x", "image/jpeg")})
    assert r.json()["detail"]["message"] != "Bu imkoniyat uchun ro'yxatdan o'ting."

PAID_MODULES = {"app.routers.ai", "app.routers.render", "app.routers.photo_model"}
UNGATED_OK = {("GET", "/api/v1/renders"), ("GET", "/api/v1/renders/all"), ("DELETE", "/api/v1/renders/{render_id}")}

def _gated(route) -> bool:
    return any(getattr(d.call, "__qualname__", "").startswith("registered_user") for d in route.dependant.dependencies)

def test_every_paid_route_is_gated():  # inventory: a new route in a paid module fails here until gated or listed
    for r in app.routes:
        if not isinstance(r, APIRoute): continue
        key = (next(iter(r.methods)), r.path)
        if (r.endpoint.__module__ in PAID_MODULES and key not in UNGATED_OK) or key == ("POST", "/api/v1/mebel/ai/suggest"):
            assert _gated(r), key
```
  `as_guest` overrides `get_current_active_user` with a guest (`is_guest=True, is_active=True`).
- [ ] Run → 403 assertions fail (routes answer 404/503).
- [ ] Implement; add the uz message with ru "Для этой функции нужно зарегистрироваться." and en "Sign up to use this feature." to `i18n/messages.py`. Make the inner function's `__qualname__` start with `registered_user` (define it inside the factory).
- [ ] Run → pass; run `tests/test_render_router.py tests/test_ai_*.py tests/test_mebel_ai.py tests/test_photo_model*.py` unchanged. Commit `feat(auth): registration_required on paid endpoints`.

### Task 5: Identity endpoints (spec table B), share stays open

**Files:** Modify `backend/app/routers/leads.py`, `shop_inquiries.py`, `orders.py`, `mebel.py` (workshop link), `seller.py`, `usta_profile.py`, `usta_portfolio.py`; Test `backend/tests/test_guest_gating.py` (extend)

**Interfaces:** Consumes `registered_user`. Gates: `POST /leads`, `POST /shops/{store_id}/inquiries` → `contact`; `POST /orders` → `order`; `POST /mebel/projects/{project_id}/workshop-link` → `workshop_link`; routers `APIRouter(prefix="/seller", dependencies=[Depends(registered_user("business"))])`, `shop_inquiries.seller_router`, `usta_profile.router`, `usta_portfolio.router` (not `usta_portfolio.public_router`) → `business`.

- [ ] Test: parametrized `IDENTITY` table (plus `GET /api/v1/seller/stats`, `POST /api/v1/usta/profile`, `GET /api/v1/usta/portfolio`) → 403 + feature, as in Task 4. Plus:
```python
def test_guest_may_share_room(client, as_guest, monkeypatch):
    # stub get_owned_room → a room; POST /api/v1/rooms/{id}/share
    assert r.status_code in (200, 201) and "token" in r.json()
def test_public_usta_portfolio_open(client): assert client.get(PUBLIC_PORTFOLIO).status_code != 403
```
- [ ] Run → fail. Implement. Run → pass with `tests/test_orders.py tests/test_seller*.py tests/test_usta_*.py tests/test_shop_inquiries.py tests/test_room_share_router.py tests/test_mebel_workshop.py` unchanged. Commit `feat(auth): identity endpoints need registration`.

### Task 6: Guest estimate — skip AI/market, flag, PDF note

**Files:** Modify `backend/app/routers/estimate.py`, `backend/app/schemas/estimate.py`, `backend/app/services/smeta_text.py`; Test `backend/tests/test_estimate_guest.py`

**Interfaces:**
- `EstimateResponse.prices_approximate_for_guest: bool = False` — `True` whenever the caller is a guest, in `POST …/estimate/preview`, `POST …/estimate`, `GET /estimates/{id}` / `GET …/estimate` (every handler that builds `EstimateResponse`).
- `PDF_TEXT["guest_prices_note"]` in `smeta_text.py` with the three Global Constraints strings.
- `_build_pdf(room: Room, est: ComputedEstimate, lang: str = DEFAULT_LANGUAGE, guest_note: bool = False) -> bytes`; `_pdf_story(..., guest_note: bool = False)` appends one paragraph `tx("guest_prices_note")` under the totals.
- `is_guest = current_user.is_guest is True` (same identity rule as Task 4). For guests: `fill_ai_price_gaps` not called; `_with_market_prices(computed, market and not is_guest, ...)`.

- [ ] Test:
```python
async def test_guest_preview_skips_ai_and_market(...):  # patch fill_ai_price_gaps and apply_market_prices with AsyncMock
    r = client.post(f"/api/v1/rooms/{rid}/estimate/preview?market=true")
    assert r.status_code == 200 and r.json()["prices_approximate_for_guest"] is True
    assert r.json()["market_checked"] == 0
    fill.assert_not_awaited(); market.assert_not_awaited()
async def test_registered_flag_false(...):  # same call as a registered user → False, fill awaited
@pytest.mark.parametrize("lang", ["uz", "ru", "en"])
def test_pdf_note_only_for_guest(lang):
    story_text = " ".join(p.text for p in _pdf_story(room, est, lang, FONTS, guest_note=True) if hasattr(p, "text"))
    assert PDF_TEXT["guest_prices_note"][lang] in story_text
    assert PDF_TEXT["guest_prices_note"][lang] not in _text(_pdf_story(room, est, lang, FONTS))
def test_note_wording():
    assert PDF_TEXT["guest_prices_note"] == {"uz": "Narxlar taxminiy. Ro'yxatdan o'tsangiz, aniqlashtiriladi.",
        "ru": "Цены ориентировочные. После регистрации они будут уточнены.", "en": "Prices are approximate. Sign up to get them refined."}
def test_guest_pdf_200(...):  # GET /api/v1/rooms/{rid}/estimate/pdf as guest → 200, application/pdf
```
  Reuse the room/DB stubs of `tests/test_estimate_router.py` and `tests/test_estimate_pdf_language.py`.
- [ ] Run → fail (field missing). Implement. Run → pass with `tests/test_estimate_router.py tests/test_estimate_pdf_language.py tests/test_smeta_text.py`. Commit `feat(estimate): guest estimate is marked approximate`.

### Task 7: `guest_account` service — upgrade and merge

**Files:** Create `backend/app/services/guest_account.py`; Test `backend/tests/test_guest_account.py`

**Interfaces:**
- `async def upgrade_guest(db: AsyncSession, guest: User, **identity: str | None) -> User` — sets the given identity fields (`username`, `password_hash`, `name`, `phone`, `google_sub`, `apple_sub`, `email`), `is_guest=False`, `registered_at=now`, flush; logs `guest_upgraded` with `method` (first identity key).
- `@dataclass class MergeResult: rooms: int; apartments: int`
- `async def merge_guest_into(db: AsyncSession, guest_id: UUID, target: User) -> MergeResult | None` — `None` when the guest row is gone, no longer a guest, or equals `target.id`.

Algorithm (one transaction, the caller's session):
1. `select(User).where(User.id == guest_id).with_for_update()`; return `None` unless `is_guest` and `id != target.id`.
2. Count rooms: `select(func.count(Room.id)).join(Apartment).where(Apartment.user_id == guest_id, Room.deleted == False)`.
3. `update(...)` `user_id`/owner → `target.id` for `Apartment`, `DraftRoom`, `FurnitureProject`, `MebelOffcut`, `MediaJob`, `RoomRender`, `Order`, `Lead`, `ShopInquiry`; `Wallpaper.uploaded_by`.
4. `UserModel`: delete guest rows whose `sha256` the target already has, then move the rest.
5. `PriceBook`: if the target has one → delete the guest's; else move.
6. `ContentReport`: delete guest rows colliding on `(target_type, target_id)` with the target's, move the rest.
7. `delete(DeviceToken).where(user_id == guest_id)`; `await db.delete(guest)`; log `guest_merged` with counts.

- [ ] Test with a recording fake session (`execute` records `str(stmt.compile(dialect=postgresql.dialect()))` and returns scripted results):
```python
async def test_merge_moves_apartments_and_counts_rooms():
    res = await merge_guest_into(db, guest.id, target)
    assert res == MergeResult(rooms=3, apartments=2)
    assert any("UPDATE apartments SET user_id" in s for s in db.sql) and db.deleted == [guest]
    assert "FOR UPDATE" in db.sql[0]
async def test_merge_price_book_conflict_keeps_target():  # target price_book exists → "DELETE FROM price_books WHERE price_books.user_id = <guest>", no UPDATE price_books
async def test_merge_user_models_duplicate_sha_dropped():  # "DELETE FROM user_models" with sha256 IN (subquery on target) precedes the UPDATE
async def test_merge_content_reports_conflict_dropped():
async def test_merge_drops_device_tokens():
async def test_merge_noop_when_guest_gone(): assert await merge_guest_into(db_returning_none, gid, target) is None and not db.deleted
async def test_merge_noop_when_already_upgraded():
async def test_merge_into_self_is_noop():
async def test_upgrade_sets_identity_and_registered_at():
    u = await upgrade_guest(db, guest, phone="+998901234567")
    assert (u.is_guest, u.phone) == (False, "+998901234567") and u.registered_at is not None
```
- [ ] Run → `ModuleNotFoundError`. Implement. Run → pass. Commit `feat(auth): guest upgrade and merge service`.

### Task 8: Upgrade/merge in the auth routes

**Files:** Modify `backend/app/routers/auth.py`, `backend/app/schemas/auth.py`; Test `backend/tests/test_guest_upgrade.py`

**Interfaces:**
- `async def get_guest_caller(request: Request, db: AsyncSession = Depends(get_db), bearer: str | None = Depends(_bearer_scheme)) -> User | None` — Bearer first, then cookie `token` (native callers send Bearer; a WebView guest cookie must not override it); returns only a user with `is_active` and `is_guest is True`; never raises.
- `LoginResponse.guest_merged_rooms: int | None = None`.
- `_login_response(user, request, response, merged: MergeResult | None = None)` sets `guest_merged_rooms=merged.rooms if merged else None`.
- Per route (each adds `guest: Annotated[User | None, Depends(get_guest_caller)]`):
  - `register`: guest → `upgrade_guest(username=, password_hash=, name=, language kept)`; 409 leaves the guest untouched; no guest → new user with `registered_at=now`.
  - `verify_otp_endpoint`: phone not found + guest → `upgrade_guest(phone=)`; phone found + guest → `merge_guest_into(guest.id, existing)`; new non-guest user gets `registered_at=now`.
  - `login_with_google` / `login_with_apple`: sub not found + guest → `upgrade_guest(google_sub|apple_sub=, email=, name=)`; found → merge.
  - `login_with_password`: success + guest → merge.
  - Upgrade answers with the same row's new tokens (registered TTL); merge answers with the target's tokens.

- [ ] Test (override `get_guest_caller`; patch `auth_router.upgrade_guest` / `merge_guest_into` with spies returning a user / `MergeResult(rooms=2, apartments=1)`; Google/Apple verifiers stubbed as in `tests/test_auth_google.py`):
```python
def test_register_upgrades_guest(): assert upgrade.await_args.kwargs["username"] == "ali" and r.json()["user"]["id"] == str(guest.id)
def test_register_conflict_leaves_guest(): assert r.status_code == 409 and not upgrade.await_count
def test_otp_new_phone_upgrades(); def test_otp_existing_phone_merges(): assert r.json()["guest_merged_rooms"] == 2 and r.json()["user"]["id"] == str(existing.id)
def test_google_new_sub_upgrades(); def test_google_existing_sub_merges()
def test_apple_new_sub_upgrades(); def test_apple_existing_sub_merges()
def test_password_login_merges()
def test_login_without_guest_token_unchanged():  # no override → get_guest_caller returns None
    assert set(r.json()) == {"user", "access_token", "refresh_token", "token_type", "guest_merged_rooms"}
    assert r.json()["guest_merged_rooms"] is None and not upgrade.await_count and not merge.await_count
def test_non_guest_token_is_ignored():  # real get_guest_caller with a registered user's Bearer → None
def test_get_guest_caller_prefers_bearer_over_cookie()
def test_upgraded_refresh_token_is_30_days()
def test_guest_delete_account_needs_no_password():  # POST /auth/delete-account {} as a guest (password_hash None) → 204, delete_account awaited
```
- [ ] Run → fail. Implement. Run → pass with `tests/test_auth*.py`. Commit `feat(auth): sign-in upgrades or merges a guest`.

### Task 9: Stale guest cleanup (first beat schedule)

**Files:** Create `backend/app/tasks/maintenance.py`; Modify `backend/celery_app.py`; Test `backend/tests/test_guest_cleanup.py`, `backend/tests/test_celery_queues.py`

**Interfaces:**
- `def stale_guests_query(now: datetime) -> Select` — ids where `is_guest` and (`coalesce(last_seen_at, created_at) < now - 14d` and no live room) or `coalesce(...) < now - 100d`, limit 200.
- `async def cleanup_stale_guests_async(now: datetime | None = None) -> dict` → `{"deleted": int}`; for each id, in its own session/transaction: `select(User).where(User.id == id, User.is_guest == True).with_for_update()`; skip if `None`; `await delete_account(db, user)`; commit. Logs `guest_cleaned` with the count only.
- Celery task `cleanup_stale_guests` named `app.tasks.maintenance.cleanup_stale_guests` (queue `default`), `asyncio.run(cleanup_stale_guests_async())`.
- `celery_app.py`: add `"app.tasks.maintenance"` to `include`; `app.conf.beat_schedule = {"cleanup-stale-guests": {"task": "app.tasks.maintenance.cleanup_stale_guests", "schedule": crontab(hour=4, minute=0)}}`.

- [ ] Test:
```python
def test_query_thresholds():
    sql = str(stale_guests_query(NOW).compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "users.is_guest" in sql and "2026-11-06" in sql and "2026-08-12" in sql   # NOW = 2026-11-20 → -14d, -100d
async def test_deletes_through_account_deletion(monkeypatch):  # two ids → delete_account awaited twice; {"deleted": 2}
async def test_cleanup_rechecks_is_guest_before_delete():  # locked re-select returns None for one id → deleted == 1
def test_beat_schedule():
    e = celery_app.app.conf.beat_schedule["cleanup-stale-guests"]
    assert e["task"] == "app.tasks.maintenance.cleanup_stale_guests" and e["schedule"] == crontab(hour=4, minute=0)
```
  Add to `test_celery_queues.py`: the maintenance task routes to a queue that has a production worker.
- [ ] Run → fail. Implement. Run → pass, then the whole suite: `pytest`. Commit `feat(ops): daily cleanup of stale guests`.

---

## Release (after all tasks)

- [ ] Deploy with `GUEST_MODE_ENABLED=false`; run `alembic upgrade head` as the deploy does; confirm the `beat` container is up.
- [ ] Gate: confirm prod `TRUST_PROXY_HEADERS` is OFF (on, it trusts the client-written first `X-Forwarded-For` entry and the per-IP guest/OTP/login limits can be dodged), and that uvicorn's `--proxy-headers --forwarded-allow-ips` (`docker-compose.prod.yml`) gives `_get_client_ip` the real client IP: `/auth/guest` from two networks → two different `guest_ip_rate:*` keys, not the proxy's IP. Otherwise the 30/hour limit is shared by all guests. Only then set `GUEST_MODE_ENABLED=true`.
