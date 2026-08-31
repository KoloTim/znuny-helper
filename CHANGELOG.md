# Changelog

Alle nennenswerten Änderungen am Znuny Helper werden hier festgehalten. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [0.1.53] – 2026-08-31

### Added
- Zweiter Minecraft-Huhn-Sound für "Ton bei neuem Ticket" ergänzt. Zur Auswahl stehen jetzt fünf eingebaute Sounds: ICQ, iPhone, Minecraft Huhn 1, Minecraft Huhn 2, WhatsApp.

### Changed
- Die interne ID des ursprünglichen Minecraft-Huhn-Sounds wurde von `minecraft-chicken` auf `minecraft-chicken-1` umbenannt, um Platz für die Nummerierung zu schaffen. Wer diesen Sound bereits ausgewählt hatte, bekommt beim nächsten Laden automatisch wieder den Standard-Sound (ICQ) vorausgewählt und muss ihn einmalig neu setzen.
- Projektaufräumung: Die ursprünglichen, mittlerweile vollständig durch das Addon ersetzten Tampermonkey-Einzelskripte (`Znuny EB Helper`, `Znuny Modal-Suche Ticketnummer`, `Znuny-OTRS Attachment Preview Overlay`, `Znuny-OTRS Popups als Tabs öffnen`, `Znuny-OTRS Ticket Kategorien Ultra Fixed`) sowie alte Planungs-/Prompt-Notizen wurden aus dem Projekt entfernt.
- Die rohen Sound-Quelldateien liegen jetzt gesammelt in einem eigenen `audio/`-Ordner im Projektwurzelverzeichnis statt lose im Hauptordner; die tatsächlich ausgelieferten Kopien liegen weiterhin in `sounds/` innerhalb der beiden Erweiterungsordner.

## [0.1.48] – 2026-08-31

### Added
- **Ton bei neuem Ticket:** Spielt einen Sound ab, sobald ein neues Ticket bei dir gesperrt wird. Erkennung läuft rein lokal per periodischem Abgleich der eigenen "Gesperrte Tickets"-Ansicht (kein Server-Push nötig, keine Fremddaten beteiligt). Der Sound ist im Addon-Popup unter "Benachrichtigung" wählbar; vier Sounds sind bereits eingebaut (ICQ, iPhone, Minecraft Huhn, WhatsApp), eigene Sounds lassen sich per Datei-Upload hinzufügen und wieder entfernen. Beim allerersten Start wird nur der aktuelle Stand gemerkt, es wird nicht rückwirkend für bereits gesperrte Tickets abgespielt.

## [0.1.47] – 2026-08-26

Ergänzende Fixes nach einer gezielten Code-Review von 0.1.46 (mehrere unabhängige Review-Durchgänge über `content.js`).

### Fixed
- **"Als Vorlage speichern" nachgeschärft:** Der 0.1.46-Fix hat die Sichtbarkeitsprüfung beim Auslesen von Typ/Queue/Service/Besitzer/Kategorie komplett entfernt, um Znunys versteckte `<select>`-Felder hinter dem Tag-Widget zu erfassen. Das war zu grob: Ist ein Feld tatsächlich inaktiv (z. B. Service für den aktuell gewählten Typ nicht zutreffend), hätte ein dort stehen gebliebener Altwert jetzt mit in die Vorlage übernommen werden können. Die Prüfung erkennt jetzt gezielt, *warum* ein Feld versteckt ist: Ist es durch Znunys InputField-Widget kosmetisch verdeckt (sichtbares Tag-Widget vorhanden), wird der Wert gelesen; ist die ganze Zeile tatsächlich inaktiv, bleibt das Feld leer wie zuvor.
- **Infinite Scroll: Wiederanschalten mitten in der Sitzung konnte dauerhaft hängen bleiben.** Wurde die Funktion im Popup deaktiviert, nachdem bereits mindestens eine Zusatzseite geladen wurde, und danach wieder aktiviert (ohne Seitenneuladung), blieb sie endgültig auf "fertig" stehen – ohne Fehlermeldung. Grund: der interne Fortschrittszähler wurde beim Deaktivieren nicht zurückgesetzt, wodurch die Wiederherstellungslogik dachte, es sei bereits alles geladen. Jetzt wird der komplette Ladezustand beim Deaktivieren zurückgesetzt.
- **Infinite Scroll: Retry nach Fehlern lief ins Leere.** Der in 0.1.46 eingeführte Backoff (4 Sekunden Wartezeit nach einem fehlgeschlagenen Ladeversuch) setzte zwar einen Zeitpunkt für den nächsten Versuch, aber nichts hat nach Ablauf dieser Zeit tatsächlich erneut geprüft – nur Scrollen/Resize hätte einen neuen Versuch ausgelöst. Stand der Nutzer bereits ganz unten in einer bereits fertig gescrollten Liste, blieb die Meldung "wird erneut versucht …" dauerhaft stehen, ohne dass je erneut versucht wurde. Jetzt wird der nächste Prüfzeitpunkt aktiv eingeplant.

### Changed (intern, ohne Funktionsänderung)
- `setPriorityRichText`: doppelt vorhandene Einfüge-Logik für das contenteditable-Feld und das iframe-basierte Textfeld auf eine gemeinsame Hilfsfunktion zusammengeführt.
- Status-Anzeige unter der Ticketliste nutzt jetzt die beim Nachladen ohnehin schon vorliegende Tabellen-Referenz, statt bei jeder Statusänderung erneut die komplette Seite nach der Ticket-Tabelle zu durchsuchen.
- Redundante, doppelt geprüfte Wartezeit-Bedingung entfernt (wurde unmittelbar vorher schon an der einzigen Aufrufstelle geprüft).
- Interner Lade-Seitenzähler von einer Zahl auf ein einfaches Ja/Nein-Flag vereinfacht, da er ohnehin nie als Zahl verwendet wurde.

## [0.1.46] – 2026-08-26

### Fixed
- **Infinite Scroll (Ticketlisten) grundlegend zuverlässiger gemacht:**
  - Die Erkennung der aktuellen Seitenzahl beim Nachladen weiterer Seiten nutzte `innerText` auf einem nicht angehängten, nicht gerenderten Dokument (Ergebnis der nachgeladenen Seite) – das liefert dort browserübergreifend zuverlässig einen leeren String. Dadurch sprang das Nachladen ab der zweiten Zusatzseite regelmäßig auf die falsche Folgeseite zurück (typischerweise wieder auf Seite 1) statt korrekt fortzuschreiten. Behoben durch konsequente Nutzung von `textContent` als Fallback.
  - Eigene DOM-Änderungen (neu eingefügte Ticketzeilen) lösten den vorhandenen Mutation-Observer aus, der die Infinite-Scroll-Logik erneut initialisierte und dabei den Lade-/Fertig-Status anhand des unveränderten, veralteten Original-Paginierung im Live-DOM zurücksetzte – das führte zu wiederholtem Nachladen bereits geladener Seiten. Die Neuableitung aus dem Live-DOM greift jetzt nur noch, bevor überhaupt eine Seite erfolgreich nachgeladen wurde.
  - Fehlgeschlagene Nachlade-Versuche (z. B. Netzwerkfehler, abgelaufene Session) wurden ohne Backoff sofort erneut versucht. Jetzt: Wartezeit zwischen Fehlversuchen, nach drei Fehlversuchen in Folge bricht die Funktion sauber ab statt endlos weiterzuversuchen.
  - Die Status-Anzeige unterhalb der Ticketliste ("Weitere Tickets werden geladen …" / "Alle Tickets geladen." / Fehlermeldung) war totes Coding und zeigte nie einen Text an. Sie funktioniert jetzt und macht sichtbar, was gerade passiert.
- **Prioritäts-Vorlagen – "Als Vorlage speichern" erfasste keine Werte:** Felder wie Typ, Queue, Service, Besitzer und Kategorie werden von Znuny über das "InputField"-Widget als Tag-Auswahl dargestellt; das zugrunde liegende `<select>` ist dabei absichtlich per `display:none` versteckt. Die Erfassungsfunktion hat genau das als "nicht sichtbares Feld" gewertet und immer einen leeren Wert zurückgegeben. Die Anwendung einer Vorlage war davon nicht betroffen. Jetzt werden die Werte unabhängig von der CSS-Sichtbarkeit des `<select>` ausgelesen.

### Security
- `innerHTML`-Zuweisungen mit dynamischen Werten in `content.js` durch sichere DOM-Konstruktion (`createElement`/`createTextNode`/`replaceChildren`) bzw. `DOMParser` ersetzt (Vorbereitung für die addons.mozilla.org-Prüfung; funktional unverändert).

## [0.1.45] – 2026-08-26 (nicht separat veröffentlicht, in 0.1.46 enthalten)
Zwischenversion während der Firefox-Freigabevorbereitung; direkt in 0.1.46 überführt.

## Firefox-Release (August 2026)
- Erste Veröffentlichung als eigenständiges Paket für Firefox (`znuny-helper-extension-firefox/`), inhaltsgleich zur Chrome/Edge-Version bis auf das `manifest.json` (Hintergrund-Skript-Deklaration, `browser_specific_settings.gecko`).
- Add-on-Namen von "Znuny Helper Firefox" auf "Znuny Helper" korrigiert (Markenzeichen-Verstoß bei der AMO-Prüfung: Add-on-Namen dürfen "Firefox"/"Mozilla" nicht enthalten).
- `strict_min_version` auf 140.0 angehoben, damit `browser_specific_settings.gecko.data_collection_permissions` von der deklarierten Mindestversion unterstützt wird.
- Chrome-spezifischen `background.service_worker`-Eintrag aus dem Firefox-Manifest entfernt (wird von Firefox ohnehin ignoriert).
- Release-Pakete (`.zip`) werden seither mit `manifest.json` direkt im Archiv-Root und mit `/`-Pfadtrennern gebaut, statt mit einem umschließenden Ordner und `\`-Pfaden – beides hätte den Import in Chrome Web Store/AMO verhindern können.

## Vor 0.1.44 (Auszug aus der Versionsgeschichte)
- Empfangsbestätigungen aus Hardware-Tickets vorbereiten (EB Helper).
- Anhang-Vorschau für PDF, Bilder u. a. direkt im Ticket.
- Ticketnummer-Suche mit automatischem Zeitraumfilter und Schnellauswahl-Buttons.
- Ticket-Kategorien inkl. Bearbeitung, Im-/Export und optionaler Keyword-basierter Vorschlagserkennung.
- Prioritäts-Vorlagen mit anpassbaren Schnellbuttons, Im-/Export und "Als Vorlage speichern".
- Anhang-Erinnerung und Warten-Schnellauswahl auf der Antwortseite.
- Strg+Enter zum Absenden des aktuellen Formulars.
- Speicherung auf `storage.local` umgestellt (Firefox-Kompatibilität).
- Diverse Fixes: doppelte Prioritäts-Hinweis-Funktionen, PDF-Vorschau bei fehlendem `Content-Type`, Kategorie-Farben gegen Dark-Reader-Neueinfärbung geschützt.
