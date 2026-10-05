# Znuny Helper – Firefox-Variante

Diese Variante ist inhaltlich identisch mit der Chrome-/Edge-Version. Der Unterschied
liegt ausschließlich in `manifest.json`.

## Lokal testen

1. Firefox öffnen.
2. `about:debugging#/runtime/this-firefox` aufrufen.
3. **Temporäres Add-on laden…** anklicken.
4. Die Datei `manifest.json` aus diesem Ordner auswählen.
5. Den Znuny-Tab danach neu laden – das Neuladen der Erweiterung allein aktualisiert
   bereits geöffnete Tabs nicht.

Temporär geladene Erweiterungen verschwinden beim Neustart von Firefox und müssen dann
erneut geladen werden; für den Dauerbetrieb wird die signierte Store-Version benötigt.

## Unterschiede zur Chrome-/Edge-Version

- `background.scripts` statt `background.service_worker` (Firefox führt
  Hintergrundskripte als Skriptliste aus).
- `browser_specific_settings.gecko` mit eigener Add-on-ID und `strict_min_version` 140.0.
- `data_collection_permissions.required` ist auf `none` gesetzt.

## Besonders testen

- Popups als Tabs
- Suchergebnisse im neuen Tab
- Tab nach dem Übermitteln schließen und Ursprungstab neu laden
- Anhang-Vorschau für PDF, Bilder, TXT, LOG, EML, DOCX und XLSX
- Ticketinhalt-Suche
- Schnellantwort (Fenster verschieben, Größe ändern, Vollbild, Esc)

## Abgleich mit der Chrome-/Edge-Version

Alle gemeinsamen Dateien werden aus `znuny-helper-extension/` übernommen:

```bash
python tools/sync-firefox.py          # kopiert und prüft die Gleichheit
python tools/sync-firefox.py --check  # prüft nur (für CI)
```

`manifest.json` und diese Datei bleiben dabei unangetastet.
