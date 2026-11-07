"""The optimizer hands back a compressed GLB only when it really is one.

`gltf-transform` itself is not run here (it is checked against a real model in
the server image); a stand-in writes whatever output each case needs.
"""
import subprocess
from pathlib import Path

import pytest

from app.services import glb_optimizer
from app.services.glb_optimizer import Outcome, optimize_glb, optimize_glb_bytes

ORIGINAL = b"glTF" + b"\0" * 996  # 1000 bytes


def _fake_cli(monkeypatch, *, out: bytes | None = None, code: int = 0, raises: Exception | None = None):
    calls: list[list[str]] = []

    def run(argv, **kwargs):
        calls.append(list(argv))
        if raises:
            raise raises
        if out is not None:
            Path(argv[3]).write_bytes(out)
        return subprocess.CompletedProcess(argv, code, stdout=b"", stderr=b"boom" if code else b"")

    monkeypatch.setattr(glb_optimizer.subprocess, "run", run)
    return calls


def test_smaller_output_is_returned(monkeypatch):
    _fake_cli(monkeypatch, out=b"x" * 400)
    assert optimize_glb_bytes(ORIGINAL) == b"x" * 400


@pytest.mark.parametrize("size", [1000, 1500])
def test_bigger_or_equal_output_is_rejected(monkeypatch, size):
    _fake_cli(monkeypatch, out=b"x" * size)
    assert optimize_glb_bytes(ORIGINAL) is None


def test_empty_output_is_rejected(monkeypatch):
    _fake_cli(monkeypatch, out=b"")
    assert optimize_glb_bytes(ORIGINAL) is None


def test_nonzero_exit_returns_none(monkeypatch):
    _fake_cli(monkeypatch, out=b"x" * 10, code=1)
    assert optimize_glb_bytes(ORIGINAL) is None


def test_timeout_returns_none(monkeypatch):
    _fake_cli(monkeypatch, raises=subprocess.TimeoutExpired(cmd="gltf-transform", timeout=300))
    assert optimize_glb_bytes(ORIGINAL) is None


def test_missing_cli_returns_none(monkeypatch):
    _fake_cli(monkeypatch, raises=FileNotFoundError("gltf-transform"))
    assert optimize_glb_bytes(ORIGINAL) is None


# What gltf-transform 4.1.1 prints when sharp cannot load: on STDOUT, after its progress
# lines, with nothing on stderr (checked in the server image with sharp's binary removed).
SHARP_ERROR = (
    "❯ resample\n✔ resample\n❯ textureCompress\n\n"
    'error: Could not load the "sharp" module using the linux-x64 runtime\n'
    "       ERR_DLOPEN_FAILED: libvips-cpp.so.42: cannot open shared object file\n"
    "       Possible solutions:\n" + "       - hint\n" * 200 + "           npm install --os=linux --cpu=x64 sharp\n"
).encode()


class TestOutcome:
    """A tool that does not work is `failed`, never mistaken for `not_smaller`."""

    def test_smaller_is_ok(self, monkeypatch):
        _fake_cli(monkeypatch, out=b"x" * 400)
        assert optimize_glb(ORIGINAL) == Outcome("ok", data=b"x" * 400)

    def test_bigger_is_not_smaller(self, monkeypatch):
        _fake_cli(monkeypatch, out=b"x" * 1000)
        assert optimize_glb(ORIGINAL) == Outcome("not_smaller")

    def test_nonzero_exit_is_failed_with_the_cause(self, monkeypatch):
        def run(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 1, stdout=SHARP_ERROR, stderr=b"")

        monkeypatch.setattr(glb_optimizer.subprocess, "run", run)
        got = optimize_glb(ORIGINAL)
        assert (got.status, got.reason, got.data) == ("failed", "exit", None)
        assert got.message.startswith('exit 1: error: Could not load the "sharp" module')  # progress lines dropped
        assert "ERR_DLOPEN_FAILED" in got.message  # the cause, not just the install hints
        assert got.message.endswith("--cpu=x64 sharp")
        assert len(got.message) < 1400

    def test_a_node_crash_on_stderr_is_kept(self, monkeypatch):
        def run(argv, **kwargs):
            return subprocess.CompletedProcess(argv, 134, stdout=b"", stderr=b"FATAL ERROR: heap out of memory")

        monkeypatch.setattr(glb_optimizer.subprocess, "run", run)
        assert optimize_glb(ORIGINAL).message == "exit 134: FATAL ERROR: heap out of memory"

    def test_timeout_is_failed(self, monkeypatch):
        _fake_cli(monkeypatch, raises=subprocess.TimeoutExpired(cmd="gltf-transform", timeout=300))
        got = optimize_glb(ORIGINAL)
        assert (got.status, got.reason) == ("failed", "timeout")

    def test_missing_cli_is_failed(self, monkeypatch):
        _fake_cli(monkeypatch, raises=FileNotFoundError("gltf-transform"))
        got = optimize_glb(ORIGINAL)
        assert (got.status, got.reason) == ("failed", "cli_missing")


def test_command_is_exactly_the_spec(monkeypatch):
    calls = _fake_cli(monkeypatch, out=b"x")
    optimize_glb_bytes(ORIGINAL)
    argv = calls[0]
    assert argv[0] == "gltf-transform"
    assert argv[1] == "optimize"
    assert argv[2].endswith("in.glb") and argv[3].endswith("out.glb")
    assert argv[4:] == [
        "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "2048", "--simplify", "false",
    ]


def test_the_input_reaches_the_cli_unchanged(monkeypatch):
    seen = {}

    def run(argv, **kwargs):
        seen["in"] = Path(argv[2]).read_bytes()
        seen["timeout"] = kwargs.get("timeout")
        Path(argv[3]).write_bytes(b"x")
        return subprocess.CompletedProcess(argv, 0, stdout=b"", stderr=b"")

    monkeypatch.setattr(glb_optimizer.subprocess, "run", run)
    optimize_glb_bytes(ORIGINAL)
    assert seen == {"in": ORIGINAL, "timeout": 300.0}
