"""Haelt die Firefox-Variante der Erweiterung mit der Chrome-/Edge-Variante synchron.

Kopiert alle Dateien aus "znuny-helper-extension/" nach
"znuny-helper-extension-firefox/" - ausgenommen sind:

  * manifest.json       (eigene Firefox-Manifestdatei)
  * README-FIREFOX.md   (gibt es nur in der Firefox-Variante)

Beide Dateien werden also weder ueberschrieben noch geloescht.

Danach folgt ein Parity-Bericht: alle Dateien, die sich inhaltlich (SHA256)
unterscheiden, plus Dateien, die nur in einem der beiden Baeume liegen.

Aufrufe (aus jedem Arbeitsverzeichnis):

    python tools/sync-firefox.py            # abgleichen, dann Bericht
    python tools/sync-firefox.py --check    # nur pruefen, nichts schreiben (CI)
    python tools/sync-firefox.py --quiet    # knappe Ausgabe

Exit-Code 1 bei Abweichung (im Modus --check bzw. wenn nach dem Abgleich noch
Abweichungen bestehen) - geeignet fuer CI.

Es werden nur Python-Bordmittel benutzt (Standardbibliothek).
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

# Repo-Root = Elternverzeichnis des Skriptordners (tools/)
REPO_ROOT = Path(__file__).resolve().parent.parent

BASE_NAME = "znuny-helper-extension"
FIREFOX_NAME = "znuny-helper-extension-firefox"

# Diese Dateien gehoeren nur zur Firefox-Variante und bleiben unangetastet.
EXCLUDED = {"manifest.json", "README-FIREFOX.md"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def collect(folder: Path) -> dict[str, Path]:
    """Alle Dateien unterhalb von folder als {relativer Pfad: Pfad}."""
    found: dict[str, Path] = {}
    if not folder.is_dir():
        return found
    for path in sorted(folder.rglob("*")):
        if path.is_file():
            found[path.relative_to(folder).as_posix()] = path
    return found


def compare(base: Path, firefox: Path) -> tuple[list[str], list[str], list[str]]:
    """Liefert (abweichende, nur_basis, nur_firefox) ohne die Ausnahmen."""
    base_files = collect(base)
    firefox_files = collect(firefox)
    base_names = set(base_files) - EXCLUDED
    firefox_names = set(firefox_files) - EXCLUDED
    common = base_names & firefox_names

    different = sorted(name for name in common if sha256(base_files[name]) != sha256(firefox_files[name]))
    only_base = sorted(base_names - firefox_names)
    only_firefox = sorted(firefox_names - base_names)
    return different, only_base, only_firefox


def sync(base: Path, firefox: Path, quiet: bool) -> list[str]:
    """Kopiert alle Dateien aus base nach firefox und entfernt Verwaiste."""
    base_files = collect(base)
    firefox_files = collect(firefox)
    actions: list[str] = []

    for name in sorted(set(base_files) - EXCLUDED):
        source = base_files[name]
        target = firefox / name
        if target.is_file() and sha256(source) == sha256(target):
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        actions.append(f"kopiert: {name}")

    # Dateien, die es in der Firefox-Variante nicht mehr geben darf, damit
    # beide Baeume (ausser den Ausnahmen) identisch sind.
    for name in sorted(set(firefox_files) - set(base_files) - EXCLUDED):
        (firefox / name).unlink()
        actions.append(f"entfernt: {name}")

    if actions and not quiet:
        print("Abgleich:")
        for action in actions:
            print(f"  {action}")
        print(f"  ({len(actions)} Aenderung(en))")
    elif not actions:
        print("Abgleich: keine Aenderungen noetig.")

    return actions


def report(base: Path, firefox: Path, quiet: bool) -> int:
    """Gibt den Parity-Bericht aus und liefert die Anzahl der Abweichungen."""
    different, only_base, only_firefox = compare(base, firefox)

    if quiet:
        if not (different or only_base or only_firefox):
            print("Parity: Firefox-Variante ist identisch (ohne manifest.json/README-FIREFOX.md).")
            return 0
        print(
            f"Parity: {len(different)} abweichend, {len(only_base)} nur Chrome/Edge, "
            f"{len(only_firefox)} nur Firefox"
        )
        return len(different) + len(only_base) + len(only_firefox)

    print("\nParity-Bericht (ohne manifest.json und README-FIREFOX.md):")
    print(f"  Basisordner:   {base}")
    print(f"  Firefox-Ordner: {firefox}")

    if not (different or only_base or only_firefox):
        print("\n  Keine Unterschiede: beide Baeume sind inhaltsgleich.")
        return 0

    if different:
        print(f"\n  Inhaltlich unterschiedlich ({len(different)}):")
        for name in different:
            print(f"    - {name}")
    if only_base:
        print(f"\n  Nur in {BASE_NAME} ({len(only_base)}):")
        for name in only_base:
            print(f"    - {name}")
    if only_firefox:
        print(f"\n  Nur in {FIREFOX_NAME} ({len(only_firefox)}):")
        for name in only_firefox:
            print(f"    - {name}")
    return len(different) + len(only_base) + len(only_firefox)


def main(argv: list[str]) -> int:
    check = "--check" in argv
    quiet = "--quiet" in argv

    unknown = [arg for arg in argv if arg not in {"--check", "--quiet"}]
    if unknown:
        print(f"FEHLER: unbekannte Option(en): {' '.join(unknown)}")
        print("Erlaubt sind: --check, --quiet")
        return 2

    base = REPO_ROOT / BASE_NAME
    firefox = REPO_ROOT / FIREFOX_NAME

    if not base.is_dir():
        print(f"FEHLER: Quellordner fehlt: {base}")
        return 1
    if not firefox.is_dir():
        print(f"FEHLER: Firefox-Ordner fehlt: {firefox}")
        return 1

    if not quiet:
        print(f"Repo-Root: {REPO_ROOT}")

    if check:
        if not quiet:
            print("Modus: --check (es wird nichts geschrieben)")
        deviations = report(base, firefox, quiet)
        if deviations:
            print("\nERGEBNIS: Abweichungen gefunden.")
            return 1
        print("\nERGEBNIS: keine Abweichungen.")
        return 0

    sync(base, firefox, quiet)
    deviations = report(base, firefox, quiet)
    if deviations:
        print("\nERGEBNIS: Abweichungen bestehen weiterhin.")
        return 1
    print("\nERGEBNIS: Firefox-Variante ist synchron.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
