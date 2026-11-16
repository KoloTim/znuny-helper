# -*- coding: utf-8 -*-
"""Manifest fuer den Store vorbereiten: Icons, Kurzname, deutsche Beschreibung."""
import io, json

DATEIEN = [
    r"C:\Users\TKO\Music\znuny-helper\znuny-helper-extension\manifest.json",
    r"C:\Users\TKO\Music\znuny-helper\znuny-helper-extension-firefox\manifest.json",
]

BESCHREIBUNG = (
    "Zusatzfunktionen f\u00fcr Znuny: Anh\u00e4nge ansehen, im Ticket suchen, Vorlagen, "
    "Kategorien, T\u00f6ne \u2013 jede Funktion einzeln schaltbar."
)

ICONS = {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
}

for pfad in DATEIEN:
    with io.open(pfad, "r", encoding="utf-8", newline="") as f:
        daten = json.load(f)

    daten["short_name"] = "Znuny Helper"
    daten["description"] = BESCHREIBUNG
    daten["icons"] = ICONS
    daten.setdefault("action", {})["default_icon"] = ICONS

    with io.open(pfad, "w", encoding="utf-8", newline="") as f:
        json.dump(daten, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("aktualisiert:", pfad, "| Laenge Beschreibung:", len(BESCHREIBUNG))
