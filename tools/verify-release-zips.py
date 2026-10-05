"""Prueft die gebauten Release-Archive gegen die Quelldateien auf der Platte.

Fuer jeden Eintrag im Archiv wird der SHA256 mit der Datei im Quellordner
verglichen. Zusaetzlich wird geprueft, dass manifest.json im Archiv-Root liegt,
dass keine Backslash-Pfade enthalten sind und dass weder Dateien fehlen noch
zusaetzliche Dateien im Archiv liegen. Die Version wird aus dem Manifest im
Archiv gelesen und ausgegeben.

Exit-Code 1 bei jeder Abweichung (fuer CI).

Aufruf aus jedem Arbeitsverzeichnis:

    python tools/verify-release-zips.py
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path

# Repo-Root = Elternverzeichnis des Skriptordners (tools/)
REPO_ROOT = Path(__file__).resolve().parent.parent

ARCHIVES = [
    ("znuny-helper-extension.zip", "znuny-helper-extension"),
    ("znuny-helper-extension-firefox.zip", "znuny-helper-extension-firefox"),
    ("znuny-helper-extension-firefox.xpi", "znuny-helper-extension-firefox"),
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def files_on_disk(folder: Path) -> dict[str, Path]:
    """Alle Quelldateien als {Archivname: Pfad}."""
    found: dict[str, Path] = {}
    for root, dirs, names in os.walk(folder):
        dirs.sort()
        for name in sorted(names):
            full = Path(root) / name
            found[full.relative_to(folder).as_posix()] = full
    return found


def check_archive(archive_name: str, folder_name: str) -> tuple[list[str], str]:
    """Prueft ein Archiv und liefert (Probleme, Ausgabezeile)."""
    archive_path = REPO_ROOT / archive_name
    folder = REPO_ROOT / folder_name
    problems: list[str] = []

    if not archive_path.is_file():
        return [f"{archive_name}: Archiv fehlt ({archive_path})"], ""
    if not folder.is_dir():
        return [f"{archive_name}: Quellordner fehlt ({folder})"], ""

    with zipfile.ZipFile(archive_path) as archive:
        names = sorted(archive.namelist())

        # 1) manifest.json muss direkt im Archiv-Root liegen
        if "manifest.json" not in names:
            problems.append(f"{archive_name}: manifest.json nicht im Archiv-Root")
            return problems, ""

        manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
        version = str(manifest.get("version", "?"))

        # 2) Pfadtrenner: nur "/" erlaubt, keine absoluten Pfade
        for name in names:
            if "\\" in name:
                problems.append(f"{archive_name}: Backslash-Pfad im Archiv: {name}")
            if name.startswith("/") or ".." in name.split("/"):
                problems.append(f"{archive_name}: ungueltiger Pfad im Archiv: {name}")

        # 3) Eintraege muessen in Inhalt und Umfang den Quelldateien entsprechen
        on_disk = files_on_disk(folder)
        entry_names = set(names)

        for name in names:
            if name.endswith("/"):
                continue
            source = on_disk.get(name)
            if source is None:
                problems.append(f"{archive_name}: zusaetzliche Datei im Archiv: {name}")
                continue
            if sha256(source.read_bytes()) != sha256(archive.read(name)):
                problems.append(f"{archive_name}: Inhalt abweichend: {name}")

        for name in sorted(set(on_disk) - entry_names):
            problems.append(f"{archive_name}: fehlt im Archiv: {name}")

        if len(entry_names) != len(on_disk):
            problems.append(
                f"{archive_name}: Anzahl Eintraege {len(entry_names)}, "
                f"Quelldateien {len(on_disk)}"
            )

    line = (
        f"{archive_name}: {len(names)} Eintraege, Version {version}, "
        f"{archive_path.stat().st_size} Bytes, SHA256 je Eintrag geprueft"
    )
    return problems, line


def main() -> int:
    problems: list[str] = []

    print(f"Repo-Root: {REPO_ROOT}")
    for archive_name, folder_name in ARCHIVES:
        archive_problems, line = check_archive(archive_name, folder_name)
        problems.extend(archive_problems)
        if line:
            print(line)

    if problems:
        print("\nPROBLEME:")
        for problem in problems:
            print(f"  - {problem}")
        print(f"\n{len(problems)} Abweichung(en) gefunden.")
        return 1

    print("\nAlle Archive stimmen mit den Quelldateien ueberein.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
