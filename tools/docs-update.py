# -*- coding: utf-8 -*-
"""Doku auf Stand 1.8.x bringen: Version, Tabelle, Minispiele, Saison, Master-Schalter."""
import io, re

REPO = r"C:\Users\TKO\Music\znuny-helper"
DATEIEN = ["README.md", "NETWIKI-Znuny-Helper.md", "NETWIKI-Znuny-Helper-dokuwiki.txt"]

MINISPIELE_NEU = """## Minispiele

Sind die Minispiele erlaubt (Popup, Standard **an**), gibt es drei kleine Spiele. Der Schalter ist der einzige Ort, an dem sie hängen: aus heißt, an keiner der drei Stellen passiert etwas.

| Spiel | Start | Anmerkung |
| --- | --- | --- |
| HSRW-Pinball | dreimal auf den Weihnachtsbaum unten rechts klicken | Vier Levelkarten (Y-Kreuz, Stern, Zickzack, Tannenbaum), pro Durchlauf gemischt |
| Pac-Man | **einmal auf den Adventskranz** oben rechts klicken | Labyrinth mit Punkten, vier Kraftpunkten und vier Geistern; Steuerung mit Pfeiltasten oder WASD |
| Logo Pong | drei Sekunden mit der Maus über das eigene Profilbild oben links | Das Profilbild darf dabei nicht verlassen werden |

Der Kranz hängt nur in der Saison (1. November bis 25. Dezember). Außerhalb der Saison startet Pac-Man über einen Dreifachklick auf das Profilbild.

Alle Spiele laufen nur im Vordergrund, lesen nichts aus dem Ticketsystem und schreiben nichts. **Esc** beendet sie.
"""

SAISON_ZUSATZ = (" Die **gesamte** Deko hängt an der Saison: vom 1. November bis zum 25. Dezember ist sie da, "
                 "ab dem 26. Dezember wird alles abgeräumt – Schnee, Girlande, Kranz, Baum und Schlitten. "
                 "Der Schalter im Popup bleibt, greift aber nur innerhalb der Saison.")

MASTER = """### Alle Funktionen auf einmal

Oben im Popup sitzt der Schalter **Alle Funktionen**:

- **Alle aus** schaltet jede Ein/Aus-Funktion ab und **merkt sich den Stand**.
- Der Knopf heißt danach **Stand zurückholen** und stellt genau den vorherigen Zustand wieder her – Funktionen, die vorher aus waren, bleiben aus.
- Der gemerkte Stand liegt im lokalen Speicher und übersteht das Schließen des Popups.

Zahlenwerte (etwa die Tage der Warten-Schnellauswahl oder die Auswahl des Tons) bleiben dabei unangetastet.
"""

for name in DATEIEN:
    p = REPO + "\\" + name
    with io.open(p, "r", encoding="utf-8", newline="") as f:
        d = f.read()
    vorher = d

    # 1) Versionszeile
    d = re.sub(r"\| Aktuelle Version \| [0-9.]+ \(Stand: [^)]+\) \|",
               "| Aktuelle Version | 1.8.1 (Stand: 16.11.2026) |", d)

    # 2) Tabellenzeile Saison
    d = d.replace(
        "| Saison | Weihnachtsmodus | Schnee, Girlande, Adventskranz, Tannenbaum, Glitzer \u2013 und alle 15 Minuten fliegt der Weihnachtsmann vorbei |",
        "| Saison | Weihnachtsmodus | Schnee, Girlande, Adventskranz, Tannenbaum, Glitzer \u2013 nur vom 1. November bis 25. Dezember; alle 30 Minuten fliegt der Weihnachtsmann vorbei |")
    d = d.replace(
        "| Saison | Weihnachtsmodus | Schnee, Girlande, Adventskranz, Tannenbaum, Glitzer \u2013 und alle 15 Minuten fliegt der Weihnachtsmann vorbei |",
        "| Saison | Weihnachtsmodus | Schnee, Girlande, Adventskranz, Tannenbaum, Glitzer \u2013 nur vom 1. November bis 25. Dezember; alle 30 Minuten fliegt der Weihnachtsmann vorbei |")

    # 3) Neue Tabellenzeilen
    if "| Saison | Minispiele |" not in d:
        d = d.replace(
            "| Hilfe | Diagnose |",
            "| Saison | Minispiele | Pinball (Baum), Pac-Man (Adventskranz), Logo Pong (Profilbild) \u2013 einzeln abschaltbar |\n| Einstellungen | Alle Funktionen | Ein Knopf schaltet alles aus und holt den vorherigen Stand zur\u00fcck |\n| Hilfe | Diagnose |")

    # 4) Minispiele-Abschnitt ersetzen
    d = re.sub(r"## Minispiele\n.*?(?=\n## )", MINISPIELE_NEU + "\n", d, flags=re.S)

    # 5) Saison-Zusatz im Weihnachtsmodus
    if "ab dem 26. Dezember wird alles abger\u00e4umt" not in d:
        d = d.replace("Schnee und Schlitten bleiben dar\u00fcber.",
                      "Schnee und Schlitten bleiben dar\u00fcber." + SAISON_ZUSATZ)

    # 6) Master-Schalter unter "Deaktivieren einzelner Funktionen"
    if "### Alle Funktionen auf einmal" not in d and "## Deaktivieren einzelner Funktionen" in d:
        d = d.replace("## Deaktivieren einzelner Funktionen\n\n",
                      "## Deaktivieren einzelner Funktionen\n\n" + MASTER + "\n", 1)

    if d != vorher:
        with io.open(p, "w", encoding="utf-8", newline="") as f:
            f.write(d)
        print(name, "aktualisiert")
    else:
        print(name, "keine Aenderung")
