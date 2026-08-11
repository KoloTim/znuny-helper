# Znuny Helper Firefox

Diese Variante ist eine separate Testversion fuer Firefox.

## Lokal testen

1. Firefox oeffnen.
2. `about:debugging#/runtime/this-firefox` aufrufen.
3. `Temporaeres Add-on laden...` anklicken.
4. Die Datei `manifest.json` aus diesem Ordner auswaehlen.

## Unterschiede zur Chromium-Version

- `background.scripts` ist zusaetzlich zu `background.service_worker` eingetragen.
- `browser_specific_settings.gecko` enthaelt eine eigene Add-on-ID.
- `data_collection_permissions.required` ist auf `none` gesetzt.

## Besonders testen

- Popups als Tabs
- Suchergebnisse im neuen Tab
- Tab nach `Uebermitteln` schliessen und Ursprungstab neu laden
- Anhang-Vorschau fuer PDF, Bilder, TXT, LOG, EML, DOCX und XLSX
- Ticketinhalt-Suche

Firefox unterstuetzt den `MAIN` Content-Script-World-Eintrag, aber genau die Funktionen, die Znuny-Popup-Code patchen, sollten beim ersten Test besonders genau beobachtet werden.
