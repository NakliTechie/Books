#!/usr/bin/env python3
"""Download and verify the pinned Books public-domain OCR evaluation corpus."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from urllib import request


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "test" / "ocr-public-corpus.json"
USER_AGENT = (
    "NakliTechie-Books-OCR-Evaluation/1.0 "
    "(https://github.com/NakliTechie/Books)"
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verified(path: Path, fixture: dict) -> bool:
    return (
        path.is_file()
        and path.stat().st_size == fixture["byteLength"]
        and sha256(path) == fixture["sha256"]
    )


def download(fixture: dict, destination: Path, force: bool = False):
    target = destination / fixture["filename"]
    if not force and verified(target, fixture):
        return "cached"
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        dir=destination,
        prefix=fixture["filename"] + ".",
        suffix=".partial",
        delete=False,
    ) as temporary:
        temporary_path = Path(temporary.name)
    try:
        incoming = request.Request(fixture["url"], headers={"User-Agent": USER_AGENT})
        with request.urlopen(incoming, timeout=120) as response:
            with temporary_path.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
        if temporary_path.stat().st_size != fixture["byteLength"]:
            raise RuntimeError(
                f"{fixture['id']}: expected {fixture['byteLength']} bytes, "
                f"received {temporary_path.stat().st_size}"
            )
        actual = sha256(temporary_path)
        if actual != fixture["sha256"]:
            raise RuntimeError(
                f"{fixture['id']}: expected sha256 {fixture['sha256']}, "
                f"received {actual}"
            )
        temporary_path.replace(target)
        return "downloaded"
    finally:
        temporary_path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="Directory to create or verify")
    parser.add_argument(
        "--manifest",
        default=str(DEFAULT_MANIFEST),
        help="Corpus manifest (default: test/ocr-public-corpus.json)",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    manifest_path = Path(args.manifest).expanduser().resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    output = Path(args.output).expanduser().resolve()
    states = {"cached": 0, "downloaded": 0}
    for fixture in manifest["fixtures"]:
        state = download(fixture, output, force=args.force)
        states[state] += 1
        print(f"{state:10} {fixture['filename']}")
    shutil.copyfile(manifest_path, output / "manifest.json")
    print(
        f"Verified {len(manifest['fixtures'])} fixtures in {output} "
        f"({states['downloaded']} downloaded, {states['cached']} cached)"
    )


if __name__ == "__main__":
    main()
