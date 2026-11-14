"""Admin prices API (spec 2026-11-15): list the three norm files' numbers, set one, put it back."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.norm_override import NormOverride, NormOverrideLog
from app.services import norm_overrides as no
from app.services.plumbing import load_plumbing_norms

from tests.test_admin_catalog import _Result, _as, _db, _user  # noqa: F401

URL = "/api/v1/admin/norms"


@pytest.fixture
def client():
    no.set_overrides({})
    yield TestClient(app)
    app.dependency_overrides.clear()
    no.set_overrides({})


def _row(file="plumbing", path="part_uzs.trap_pol", value=380000):
    r = NormOverride(file=file, path=path, value=Decimal(value))
    r.id = uuid.uuid4()
    r.updated_at = datetime(2026, 11, 15, tzinfo=timezone.utc)
    return r


def test_not_for_a_non_admin(client):
    _as(_user(is_admin=False), _db())
    assert client.get(URL).status_code == 403
    assert client.put(f"{URL}/plumbing/part_uzs.trap_pol", json={"value": 1}).status_code == 403


def test_the_list_has_every_number_with_its_name_default_and_override(client):
    _as(_user(is_admin=True), _db(_Result(many=[_row()])))
    body = client.get(URL).json()
    by = {(e["file"], e["path"]): e for e in body["entries"]}
    trap = by[("plumbing", "part_uzs.trap_pol")]
    assert trap == {**trap, "label": "Pol trapi", "unit": "so'm/dona", "group": "Santexnika: qismlar",
                    "default": 450000, "value": 380000, "overridden": True}
    kran = by[("plumbing", "part_uzs.kran_kir")]
    assert (kran["value"], kran["overridden"]) == (60000, False)
    assert ("tile", "grout_kg_m2") in by and ("bathroom_extras", "fan_uzs_by_size.125") in by
    assert ("bathroom_extras", "fan_uzs") not in by


def test_setting_a_price_saves_it_logs_it_and_the_estimate_uses_it(client):
    db = _db(_Result(one=None))
    _as(_user(is_admin=True), db)
    r = client.put(f"{URL}/plumbing/part_uzs.trap_pol", json={"value": 390000})
    assert r.status_code == 200, r.text
    assert (r.json()["value"], r.json()["overridden"]) == (390000, True)
    added = [c.args[0] for c in db.add.call_args_list]
    assert any(isinstance(a, NormOverride) and a.path == "part_uzs.trap_pol" and a.value == 390000 for a in added)
    log = next(a for a in added if isinstance(a, NormOverrideLog))
    assert (log.old_value, log.new_value) == (None, 390000)
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 390000


def test_changing_a_set_price_updates_its_row(client):
    row = _row(value=380000)
    db = _db(_Result(one=row))
    _as(_user(is_admin=True), db)
    assert client.put(f"{URL}/plumbing/part_uzs.trap_pol", json={"value": 400000}).status_code == 200
    assert row.value == 400000
    log = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], NormOverrideLog))
    assert (log.old_value, log.new_value) == (380000, 400000)


@pytest.mark.parametrize(("value", "words"), [(0, "0 dan katta"), (1.5, "butun son"), (10**9, "juda katta")])
def test_a_bad_value_is_refused_in_uzbek(client, value, words):
    _as(_user(is_admin=True), _db(_Result(one=None)))
    r = client.put(f"{URL}/plumbing/part_uzs.trap_pol", json={"value": value})
    assert r.status_code == 422 and words in r.json()["detail"]


def test_an_unknown_price_is_404(client):
    _as(_user(is_admin=True), _db(_Result(one=None)))
    assert client.put(f"{URL}/plumbing/nope", json={"value": 5}).status_code == 404
    assert client.put(f"{URL}/nope/x", json={"value": 5}).status_code == 404


def test_back_to_default_deletes_the_row_and_logs_it(client):
    no.set_overrides({"plumbing": {"part_uzs.trap_pol": 380000}})
    row = _row()
    db = _db(_Result(one=row))
    _as(_user(is_admin=True), db)
    r = client.delete(f"{URL}/plumbing/part_uzs.trap_pol")
    assert r.status_code == 200 and (r.json()["value"], r.json()["overridden"]) == (450000, False)
    db.delete.assert_awaited_once_with(row)
    log = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], NormOverrideLog))
    assert (log.old_value, log.new_value) == (380000, None)
    assert load_plumbing_norms()["part_uzs"]["trap_pol"] == 450000


def test_the_log_lists_changes_with_names(client):
    entry = NormOverrideLog(file="plumbing", path="part_uzs.trap_pol", old_value=None, new_value=Decimal(390000))
    entry.id = uuid.uuid4()
    entry.created_at = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
    _as(_user(is_admin=True), _db(_Result(many=[entry])))
    got = client.get(f"{URL}/log").json()["items"]
    assert got[0]["label"] == "Pol trapi" and got[0]["old_value"] is None and got[0]["new_value"] == 390000
