# -*- coding: utf-8 -*-
"""Absatzfassung der NetWiki-Doku aus der DokuWiki-Fassung erzeugen.

Hintergrund: Auf der NetWiki-Seite ueberleben beim Einfuegen nur Absatzgrenzen
(Leerzeilen). Einzelne Zeilenumbrueche innerhalb eines Blocks werden zu
Leerzeichen zusammengezogen; dadurch wurde aus den Tabellen jeweils eine
einzige Tabellenzeile. Die Absatzfassung braucht keine Zeilenumbrueche
innerhalb eines Blocks:

* Tabellen werden zu Absaetzen mit fettem Label.
* mehrzeilige <note>- und <code>-Bloecke werden einzeilig.
* geordnete Listen (DokuWiki "-") werden zu Absaetzen mit echter Nummer,
  weil jede Einzelzeile sonst eine eigene Liste mit der Nummer 1 waere.
* ungeordnete Listen bleiben "* Punkt", aber jeder Punkt als eigener Absatz.
* zwischen allen Zeilen steht eine Leerzeile.

Aufruf:  python tools/make-netwiki-absatzform.py
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "NETWIKI-Znuny-Helper-dokuwiki.txt")
DST = os.path.join(ROOT, "NETWIKI-Znuny-Helper-dokuwiki-absatzform.txt")

text = io.open(SRC, encoding="utf-8", newline="").read()
lines = text.split("\n")
if lines and lines[-1] == "":
    lines.pop()

out = []
i = 0
tables = 0
notes = 0
codes = 0
ordered_counter = 0
prev_kind = "other"

while i < len(lines):
    raw = lines[i]
    stripped = raw.strip()

    # ---- Tabellenblock -> Absaetze mit fettem Label
    if re.match(r"^[|^]", stripped):
        tables += 1
        block = []
        while i < len(lines) and re.match(r"^[|^]", lines[i].strip()):
            block.append(lines[i].strip())
            i += 1
        rows = []
        for row in block:
            cells = [c.strip() for c in re.split(r"[|^]", row)]
            rows.append([c for c in cells if c != ""])
        header = rows[0]
        if len(header) == 2:
            for cells in rows[1:]:
                out.append("**%s:** %s" % (cells[0], cells[1]))
        elif len(header) == 3:
            for cells in rows[1:]:
                out.append("**%s** (%s): %s" % (cells[1], cells[0], cells[2]))
        else:
            raise SystemExit("unerwartete Tabelle mit %d Spalten" % len(header))
        prev_kind = "other"
        ordered_counter = 0
        continue

    # ---- <note ...> ... </note> -> eine Zeile
    if stripped.startswith("<note"):
        notes += 1
        buf = []
        while i < len(lines):
            buf.append(lines[i].strip())
            if "</note>" in lines[i]:
                i += 1
                break
            i += 1
        joined = buf[0]
        for extra in buf[1:]:
            joined += (" " if not joined.endswith(">") else "") + extra
        joined = re.sub(r"^(<note[^>]*>)\s*", r"\1", joined)
        joined = re.sub(r"\s*(</note>)$", r"\1", joined)
        out.append(joined)
        prev_kind = "other"
        ordered_counter = 0
        continue

    # ---- <code> ... </code> -> eine Zeile
    if stripped == "<code>":
        codes += 1
        i += 1
        buf = []
        while i < len(lines) and lines[i].strip() != "</code>":
            buf.append(lines[i].strip())
            i += 1
        i += 1
        out.append("<code>%s</code>" % " ".join(buf))
        prev_kind = "other"
        ordered_counter = 0
        continue

    # ---- geordnete Liste ("- ") -> nummerierte Absaetze
    # Zwischengeschobene Unterpunkte ("* ...") unterbrechen die Nummerierung
    # nicht: die Nummer laeuft weiter, solange kein Absatz dazwischen kommt.
    if re.match(r"^\s*-\s+", raw):
        items = []
        while i < len(lines) and re.match(r"^\s*-\s+", lines[i]):
            items.append(re.sub(r"^\s*-\s+", "", lines[i]).strip())
            i += 1
        for item in items:
            ordered_counter = ordered_counter + 1 if prev_kind in ("ordered", "bullet") else 1
            out.append("%d. %s" % (ordered_counter, item))
            prev_kind = "ordered"
        continue

    # ---- ungeordnete Liste: Einrueckung weg, Marker bleibt
    was_bullet = re.match(r"^\s*\*\s+", raw) is not None
    raw = re.sub(r"^\s*\*\s+", "* ", raw)
    out.append(raw.strip())
    prev_kind = "bullet" if was_bullet else "other"
    if not was_bullet:
        ordered_counter = 0
    i += 1

result = "\n\n".join(line for line in out if line != "") + "\n"
io.open(DST, "w", encoding="utf-8", newline="").write(result)

print("Quelle:          %s" % SRC)
print("Ziel:            %s" % DST)
print("Tabellen:        %d" % tables)
print("Notizbloecke:    %d" % notes)
print("Codebloecke:     %d" % codes)
print("Absaetze:        %d" % len([line for line in out if line != ""]))
