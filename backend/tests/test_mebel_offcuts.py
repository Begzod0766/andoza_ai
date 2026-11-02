"""
Mebel offcut stock: the caller's offcuts, and "Kesildi" moving the offcuts a
job used out and the ones it leaves in, all or nothing. The DB session is
stubbed, as in test_mebel.py.
"""
import uuid
from datetime import datetime, timezone

from app.models.furniture_project import FurnitureProject
from app.models.mebel_offcut import MebelOffcut
from tests.test_mebel import _Result, _as, _data, _db, _project, _user, client  # noqa: F401


def _offcut(user_id, **kw):
    values = dict(id=uuid.uuid4(), user_id=user_id, material="board", material_id=None, thickness=18, length=800, width=600,
                  source_project_id=None, created_at=datetime.now(timezone.utc))
    values.update(kw)
    return MebelOffcut(**values)


def _body(**kw):
    body = {"material": "board", "materialId": None, "thickness": 18, "length": 800, "width": 600}
    body.update(kw)
    return body


def test_list_and_add_offcuts_are_the_callers(client):
    user = _user()
    mine = _offcut(user.id)
    _as(user, _db(_Result(many=[mine])))
    r = client.get("/api/v1/mebel/offcuts")
    assert r.status_code == 200
    assert r.json()[0]["length"] == 800 and r.json()[0]["materialId"] is None

    db = _db(_Result(one=3))
    _as(user, db)
    r = client.post("/api/v1/mebel/offcuts", json=_body(materialId="m1"))
    assert r.status_code == 201, r.text
    added = db.add.call_args.args[0]
    assert added.user_id == user.id and added.material_id == "m1" and added.source_project_id is None


def test_offcut_limits(client):
    user = _user()
    for bad in [_body(length=199), _body(width=5001), _body(thickness=0), _body(material="glass")]:
        _as(user, _db(_Result(one=0)))
        assert client.post("/api/v1/mebel/offcuts", json=bad).status_code == 422
    _as(user, _db(_Result(one=500)))
    assert client.post("/api/v1/mebel/offcuts", json=_body()).status_code == 422


def test_delete_foreign_offcut_is_404(client):
    _as(_user(), _db(_Result(one=None)))
    assert client.delete(f"/api/v1/mebel/offcuts/{uuid.uuid4()}").status_code == 404


def test_cut_moves_used_out_and_produced_in(client):
    user = _user()
    project = _project(user.id)
    used = _offcut(user.id)
    db = _db(_Result(one=project), _Result(many=[used]))
    _as(user, db)
    r = client.post(f"/api/v1/mebel/projects/{project.id}/cut",
                    json={"used": [str(used.id)], "produced": [_body(length=1200, width=400), _body(material="back", thickness=4)]})
    assert r.status_code == 200, r.text
    db.delete.assert_awaited_once_with(used)
    made = [c.args[0] for c in db.add.call_args_list]
    assert [(m.material, m.length) for m in made] == [("board", 1200), ("back", 800)]
    assert all(m.source_project_id == project.id and m.user_id == user.id for m in made)
    assert project.cut_at is not None and r.json()["cut_at"]


def test_cut_with_a_missing_offcut_is_409_and_changes_nothing(client):
    user = _user()
    project = _project(user.id)
    db = _db(_Result(one=project), _Result(many=[]))
    _as(user, db)
    r = client.post(f"/api/v1/mebel/projects/{project.id}/cut", json={"used": [str(uuid.uuid4())], "produced": [_body()]})
    assert r.status_code == 409
    db.delete.assert_not_awaited()
    db.add.assert_not_called()
    assert project.cut_at is None


def test_cut_twice_is_409(client):
    user = _user()
    project = _project(user.id, cut_at=datetime.now(timezone.utc))
    _as(user, _db(_Result(one=project)))
    assert client.post(f"/api/v1/mebel/projects/{project.id}/cut", json={"used": [], "produced": []}).status_code == 409


def test_offcuts_survive_their_project():
    fk = next(iter(MebelOffcut.__table__.c.source_project_id.foreign_keys))
    assert fk.ondelete == "SET NULL"
    assert "cut_at" in FurnitureProject.__table__.c
