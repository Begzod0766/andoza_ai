"""Compress a GLB for the studio: meshopt geometry, WebP textures no larger than 2048 px.

Settings are the ones checked by eye on the heaviest production models
(docs/superpowers/specs/2026-10-10-glb-optimization-design.md): the result looked
the same as the original and drew its first frame 2-6x sooner. Simplifying the
mesh is deliberately left off: it spoiled knitted fabric.

Runs the `gltf-transform` CLI (installed in the server image). Blocking: call it
from a worker thread or a Celery task, never on the event loop.
"""
from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import structlog

log = structlog.get_logger(__name__)

OPTIMIZE_ARGS = (
    "--compress", "meshopt",
    "--texture-compress", "webp",
    "--texture-size", "2048",
    "--simplify", "false",
)


@dataclass(frozen=True)
class Outcome:
    """What one run gave: the compressed GLB (status ``ok``), a result that was no
    smaller (``not_smaller``), or a tool that did not work at all (``failed``, with
    ``reason`` cli_missing / timeout / exit and the CLI's error text in ``message``).

    ``failed`` is kept apart from ``not_smaller`` so a broken image (sharp unable to
    load, the CLI missing) shows up as a failure instead of passing for "nothing to gain".
    """

    status: str
    data: bytes | None = None
    reason: str = ""
    message: str = ""


def optimize_glb(data: bytes, *, timeout: float = 300.0, cli: str = "gltf-transform") -> Outcome:
    with tempfile.TemporaryDirectory(prefix="glb-opt-") as tmp:
        src, dst = Path(tmp) / "in.glb", Path(tmp) / "out.glb"
        src.write_bytes(data)
        try:
            done = subprocess.run(
                [cli, "optimize", str(src), str(dst), *OPTIMIZE_ARGS],
                timeout=timeout, capture_output=True,
            )
        except FileNotFoundError:
            log.warning("glb_optimize_failed", reason="cli_missing", cli=cli)
            return Outcome("failed", reason="cli_missing", message=f"{cli} not found")
        except subprocess.TimeoutExpired:
            log.warning("glb_optimize_failed", reason="timeout", seconds=timeout)
            return Outcome("failed", reason="timeout", message=f"no result after {timeout:g}s")
        if done.returncode != 0:
            message = _error_text(done.stdout, done.stderr)
            log.warning("glb_optimize_failed", reason="exit", code=done.returncode, error=message)
            return Outcome("failed", reason="exit", message=f"exit {done.returncode}: {message}")
        out = dst.read_bytes() if dst.exists() else b""
        if not out or len(out) >= len(data):
            log.info("glb_optimize_skipped", reason="not_smaller", before=len(data), after=len(out))
            return Outcome("not_smaller")
        return Outcome("ok", data=out)


def _error_text(stdout: bytes | None, stderr: bytes | None, head: int = 1000, tail: int = 300) -> str:
    """Why the CLI failed. It prints its own errors to STDOUT ("error: Could not load
    the "sharp" module ...", after the progress lines), so stderr alone is usually
    empty; a Node crash goes to stderr. The head is kept, where sharp names the cause
    (its last lines are only install hints), plus the tail."""
    out = (stdout or b"").decode("utf-8", "replace")
    at = out.find("error:")
    parts = [(stderr or b"").decode("utf-8", "replace").strip(), (out[at:] if at >= 0 else out).strip()]
    text = "\n".join(p for p in parts if p)
    if len(text) <= head + tail:
        return text
    return f"{text[:head]} … {text[-tail:]}"


def optimize_glb_bytes(data: bytes, *, timeout: float = 300.0, cli: str = "gltf-transform") -> bytes | None:
    """The compressed GLB, or None when compressing failed or did not make it smaller."""
    return optimize_glb(data, timeout=timeout, cli=cli).data
