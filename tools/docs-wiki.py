# -*- coding: utf-8 -*-
"""Doku-Wiki-Datei: Minispiele-Abschnitt auf aktuellen Stand."""
import io, re

P = r"C:\Users\TKO\Music\znuny-helper\NETWIKI-Znuny-Helper-dokuwiki.txt"
with io.open(P, "r", encoding="utf-8", newline="") as f:
    d = f.read()

neu = """===== Minispiele =====

Sind die Minispiele erlaubt (Popup, Standard **an**), gibt es drei kleine Spiele. Der Schalter ist der einzige Ort, an dem sie hängen: aus heißt, an keiner der drei Stellen passiert etwas.

^ Spiel ^ Start ^ Anmerkung ^
| HSRW-Pinball | dreimal auf den Weihnachtsbaum unten rechts klicken | Vier Levelkarten (Y-Kreuz, Stern, Zickzack, Tannenbaum), pro Durchlauf gemischt |
| Pac-Man | **einmal auf den Adventskranz** oben rechts klicken | Labyrinth mit Punkten, vier Kraftpunkten und vier Geistern; Steuerung mit Pfeiltasten oder WASD |
| Logo Pong | drei Sekunden mit der Maus über das eigene Profilbild oben links | Das Profilbild darf dabei nicht verlassen werden |

Der Kranz hängt nur in der Saison (1. November bis 25. Dezember). Außerhalb der Saison startet Pac-Man über einen Dreifachklick auf das Profilbild.

Alle Spiele laufen nur im Vordergrund, lesen nichts aus dem Ticketsystem und schreiben nichts. **Esc** beendet sie.

"""

muster = re.compile(r"===== Minispiele =====\n.*?(?===== |\Z)", re.S)
d, n = muster.subn(neu, d, count=1)
print("Minispiele ersetzt:", n)

# Master-Schalter-Absatz
if "Alle Funktionen auf einmal" not in d:
    anker = "===== Deaktivieren einzelner Funktionen ====="
    zusatz = """===== Deaktivieren einzelner Funktionen =====

Oben im Popup sitzt der Schalter **Alle Funktionen**:
  * **Alle aus** schaltet jede Ein/Aus-Funktion ab und merkt sich den Stand.
  * Danach heißt der Knopf **Stand zurückholen** und stellt genau den vorherigen Zustand wieder her - Funktionen, die vorher aus waren, bleiben aus.
  * Zahlenwerte (etwa die Tage der Warten-Schnellauswahl) bleiben unangetastet.

"""
    d = d.replace(anker + "\n\n", zusatz, 1)

with io.open(P, "w", encoding="utf-8", newline="") as f:
    f.write(d)
print("Doku-Wiki aktualisiert")
