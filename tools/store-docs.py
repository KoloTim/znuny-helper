# -*- coding: utf-8 -*-
"""Store-Doku: Screenshot-Liste aktualisieren."""
import io

REPO = r"C:\Users\TKO\Music\znuny-helper"

LISTE = """## Screenshots (1280 × 800)

| Datei | Motiv |
| --- | --- |
| `popup-oben.png` | Popup-Kopf mit Schalter „Alle Funktionen" und den ersten Rubriken |
| `popup-unten.png` | unteres Ende des Popups: Benachrichtigung, Saison, Hilfe, Minispiele |
| `agent-uebersicht.png` | Übersicht mit Weihnachtsdeko (Saison) |
| `agent-ticket-zoom.png` | Ticketansicht mit Anhang-Vorschau und Suche im Ticket |
| `agent-suche.png` | Suchseite mit Suchverlauf unter den Feldern |

Alle Bilder werden aus **Testdaten** erzeugt (`tools/store-screenshots.js`, `tools/store-popup-shot.js`, `tools/store-compose.py`) – es sind keine echten Tickets zu sehen.
"""

P = REPO + r"\store\checkliste.md"
with io.open(P, "r", encoding="utf-8", newline="") as f:
    d = f.read()

d = d.replace("- [ ] Screenshots aus `screenshots/` (1280 × 800)",
              "- [ ] Screenshots aus `screenshots/` (1280 × 800) \u2013 siehe Liste unten")
d = d.replace("- [ ] Screenshots (1280 × 800)", "- [ ] Screenshots (1280 × 800) \u2013 siehe Liste unten")

if "## Screenshots (1280 × 800)" not in d:
    d = d.rstrip() + "\n\n" + LISTE

with io.open(P, "w", encoding="utf-8", newline="") as f:
    f.write(d)
print("checkliste.md aktualisiert")

R = REPO + r"\store\README.md"
with io.open(R, "r", encoding="utf-8", newline="") as f:
    r = f.read()
r = r.replace("| `screenshots/` | Bilder 1280 × 800 für die Store-Seite |",
              "| `screenshots/` | fünf Bilder in 1280 × 800 (Popup oben/unten, Übersicht, Ticket, Suche) |")
with io.open(R, "w", encoding="utf-8", newline="") as f:
    f.write(r)
print("README.md aktualisiert")
