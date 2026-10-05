"""Baut die Store-Archive des Znuny Helper neu.

Verfahren wie im README dokumentiert: manifest.json direkt im Archiv-Root,
Pfadtrenner "/", Eintraege sortiert. Gepackt werden nur die beiden
Erweiterungsordner; die Archive selbst liegen im Repo-Root und damit
ausserhalb der gepackten Ordner.

Das Repo-Root ist das Elternverzeichnis des Skriptordners (tools/), damit das
Skript aus jedem Arbeitsverzeichnis heraus laeuft:

    python tools/build-release-zips.py

Es werden nur Node-/Python-Bordmittel benutzt (Python-Standardbibliothek).
"""

from __future__ import annotations

import json
import os
import sys
import zipfile
from pathlib import Path

# Repo-Root = Elternverzeichnis des Skriptordners (tools/)
REPO_ROOT = Path(__file__).resolve().parent.parent

# (Quellordner, Zieldatei) - die XPI ist inhaltlich identisch mit dem
# Firefox-ZIP, es wird bewusst dieselbe Vorlage verwendet.
ARCHIVES = [
    ("znuny-helper-extension", "znuny-helper-extension.zip"),
    ("znuny-helper-extension-firefox", "znuny-helper-extension-firefox.zip"),
    ("znuny-helper-extension-firefox", "znuny-helper-extension-firefox.xpi"),
]


def collect_files(folder: Path) -> list[tuple[str, Path]]:
    """Sammelt alle Dateien unterhalb von folder als (Archivname, Pfad)."""
    files: list[tuple[str, Path]] = []
    for root, dirs, names in os.walk(folder):
        dirs.sort()
        for name in sorted(names):
            full = Path(root) / name
            rel = full.relative_to(folder).as_posix()
            files.append((rel, full))
    files.sort(key=lambda entry: entry[0])
    return files


def read_version(folder: Path) -> str:
    """Liest die Version aus manifest.json des Quellordners."""
    manifest = folder / "manifest.json"
    try:
        with manifest.open(encoding="utf-8") as handle:
            return str(json.load(handle).get("version", "?"))
    except (OSError, ValueError):
        return "?"


def build(folder: Path, target: Path) -> None:
    """Schreibt ein Archiv und gibt Dateiname, Anzahl Eintraege und Groesse aus."""
    files = collect_files(folder)

    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for rel, full in files:
            archive.write(full, rel)

    size = target.stat().st_size
    print(
        f"{target.name}: {len(files)} Eintraege, Version {read_version(folder)}, "
        f"{size} Bytes ({size / 1024:.1f} KiB)"
    )


def main() -> int:
    if not (REPO_ROOT / "znuny-helper-extension").is_dir():
        print(f"FEHLER: Quellordner nicht gefunden unter {REPO_ROOT}")
        return 1

    print(f"Repo-Root: {REPO_ROOT}")
    for folder_name, archive_name in ARCHIVES:
        folder = REPO_ROOT / folder_name
        if not folder.is_dir():
            print(f"FEHLER: Quellordner fehlt: {folder}")
            return 1
        build(folder, REPO_ROOT / archive_name)

    print("\nFertig: 3 Archive gebaut.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
