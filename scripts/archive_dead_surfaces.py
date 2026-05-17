#!/usr/bin/env python3
"""archive_dead_surfaces.py — collapse duplicated public surfaces.

Surface reduction per the facelift plan. Moves the following to Archive/:
  - Stale AstroWind builds inside zombie760.github.io/
  - The botwave-site/ Astro source tree
  - BOTWAVE_MEDIA/showcase/ (duplicate of zombie760.github.io)

Idempotent — checks existence before moving, never overwrites.
"""
from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path("/var/home/gringo/Botwave-Master")
ARCHIVE = ROOT / "Archive" / f"facelift_2026-05-16"

# Stale AstroWind builds living inside zombie760.github.io that aren't hand-maintained
ASTRO_BUILDS_TO_KILL = [
    "zombie760.github.io/services",
    "zombie760.github.io/about",
    "zombie760.github.io/pricing",
    "zombie760.github.io/registry",
    "zombie760.github.io/contact",
    "zombie760.github.io/terms",
    "zombie760.github.io/privacy",
    "zombie760.github.io/landing",
    "zombie760.github.io/homes",
    "zombie760.github.io/decapcms",
    "zombie760.github.io/_astro",
]

# Parallel projects that overlap zombie760.github.io
DUPLICATE_SURFACES = [
    "botwave-site",
    "BOTWAVE_MEDIA/showcase",
]


def archive_path(rel: str) -> Path:
    """Where this surface goes in the Archive."""
    return ARCHIVE / rel


def move(rel: str) -> str:
    src = ROOT / rel
    if not src.exists():
        return f"SKIP {rel} (not present)"
    dst = archive_path(rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return f"SKIP {rel} (archive target already exists at {dst})"
    shutil.move(str(src), str(dst))
    return f"MOVED {rel} -> Archive/facelift_2026-05-16/{rel}"


def main() -> int:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    print(f"=== Surface reduction — {datetime.now().isoformat()}\n")
    print(f"Archive root: {ARCHIVE}\n")

    print("Stale AstroWind builds inside zombie760.github.io/:")
    for rel in ASTRO_BUILDS_TO_KILL:
        print("  " + move(rel))

    print("\nDuplicate surfaces:")
    for rel in DUPLICATE_SURFACES:
        print("  " + move(rel))

    print("\nDone. Verify with:")
    print(f"  ls -la {ARCHIVE}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
