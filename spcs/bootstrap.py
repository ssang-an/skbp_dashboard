"""Prepare the persistent app directory on the SPCS block volume before uvicorn starts.

Layout inside the container:
  /opt/skbp/image   read-only copy of the repository baked into the image
  /app-state        block storage volume (survives restarts, suspend/resume, upgrades)
  /app-state/app    directory the FastAPI app actually runs from (main.py ROOT)

Rules:
  * Code files are synced from the image on every start, so a new image version takes effect.
  * Data paths are copied from the image exactly once (first seed). After the seed marker
    exists they are never overwritten; a data path that is missing on the volume is copied
    in only if it does not exist yet.
  * The seed is staged and only marked complete after every data path is in place, so a
    crash in the middle is retried on the next container start.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import time
from pathlib import Path

IMAGE_DIR = Path(os.environ.get("SKBP_IMAGE_DIR", "/opt/skbp/image"))
STATE_DIR = Path(os.environ.get("SKBP_STATE_DIR", "/app-state"))
APP_DIR = STATE_DIR / "app"
SEED_MARKER = STATE_DIR / ".seed_complete.json"
SEED_STAGING = STATE_DIR / ".seed-staging"
CODE_MANIFEST = STATE_DIR / ".code_manifest.json"

# Every path the running app (or the export scripts it launches) writes to.
DATA_PATHS = (
    "json/pipeline-records.json",
    "json/candidate-queue.json",
    "json/shortlisting-projects.json",
    "data",
    "attachments",
    "skbp_pipeline_wiki",
    "obsidian",
    "config/instruction_warnings.json",
)
SKIP_TOP_LEVEL = {"spcs", "snowflake"}
SKIP_PARTS = {"__pycache__"}


def log(message: str) -> None:
    print(f"[skbp-bootstrap] {message}", flush=True)


def is_data_path(rel: str) -> bool:
    return any(rel == p or rel.startswith(p + "/") for p in DATA_PATHS)


def copy_file_atomic(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(f".{dst.name}.skbp-tmp")
    shutil.copy2(src, tmp)
    with open(tmp, "rb") as fh:
        os.fsync(fh.fileno())
    os.replace(tmp, dst)


def copy_tree(src: Path, dst: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dst, dirs_exist_ok=True)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def write_json_atomic(path: Path, payload: object) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(tmp, "rb") as fh:
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def sync_code() -> None:
    """Make every non-data file in APP_DIR match the image; drop code files the image no longer has."""
    current: list[str] = []
    for src in IMAGE_DIR.rglob("*"):
        if not src.is_file():
            continue
        rel = src.relative_to(IMAGE_DIR).as_posix()
        parts = rel.split("/")
        if parts[0] in SKIP_TOP_LEVEL or SKIP_PARTS.intersection(parts) or is_data_path(rel):
            continue
        current.append(rel)
        dst = APP_DIR / rel
        if dst.is_file():
            s, d = src.stat(), dst.stat()
            if s.st_size == d.st_size and int(s.st_mtime) == int(d.st_mtime):
                continue
        copy_file_atomic(src, dst)

    previous: list[str] = []
    if CODE_MANIFEST.is_file():
        previous = json.loads(CODE_MANIFEST.read_text(encoding="utf-8"))
    for rel in set(previous) - set(current):
        stale = APP_DIR / rel
        if not is_data_path(rel) and stale.is_file():
            stale.unlink()
            log(f"removed code file no longer in image: {rel}")
    write_json_atomic(CODE_MANIFEST, sorted(current))
    log(f"code synced ({len(current)} files)")


def seed_data() -> None:
    if SEED_MARKER.is_file():
        # Already seeded: never overwrite. Only fill in data paths that do not exist yet.
        for rel in DATA_PATHS:
            src, dst = IMAGE_DIR / rel, APP_DIR / rel
            if src.exists() and not dst.exists():
                copy_tree(src, dst)
                log(f"added missing data path from image: {rel}")
        log("data already seeded; existing data left untouched")
        return

    log("first start: seeding data from image (retried automatically if interrupted)")
    if SEED_STAGING.exists():
        shutil.rmtree(SEED_STAGING)
    SEED_STAGING.mkdir(parents=True)
    present = [rel for rel in DATA_PATHS if (IMAGE_DIR / rel).exists()]
    for rel in present:
        copy_tree(IMAGE_DIR / rel, SEED_STAGING / rel)
    os.sync()
    # The app has never run against this volume yet (no marker), so replacing is safe.
    for rel in present:
        target = APP_DIR / rel
        if target.exists() or target.is_symlink():
            remove(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        os.replace(SEED_STAGING / rel, target)
    os.sync()
    shutil.rmtree(SEED_STAGING, ignore_errors=True)
    write_json_atomic(SEED_MARKER, {
        "seeded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "paths": present,
        "image_tag": os.environ.get("SKBP_IMAGE_TAG", ""),
    })
    log(f"seed complete ({len(present)} data paths)")


def main() -> int:
    if not IMAGE_DIR.is_dir():
        log(f"image directory missing: {IMAGE_DIR}")
        return 1
    if not STATE_DIR.is_dir():
        log(f"state volume not mounted at {STATE_DIR}")
        return 1
    APP_DIR.mkdir(parents=True, exist_ok=True)
    sync_code()
    seed_data()
    return 0


if __name__ == "__main__":
    sys.exit(main())
