# Handoff: Revision des Znuny Helpers (Stand 1.6.5 → 1.6.6)

**Für einen neuen Chat.** Dieses Dokument ist absichtlich selbsttragend: Es ersetzt
den Verlauf des vorherigen Gesprächs. Zuerst die Guardrails lesen, dann Phase 0.

- **Repository:** `C:\Users\TKO\Music\znuny-helper`
- **Branch:** `main`, Remotes: `origin https://github.com/KoloTim/znuny-helper.git`
- **Stand:** Version **1.6.5**, HEAD `db6fc17`, Tags `v1.6.0` … `v1.6.5`
- **Ziel:** eine Revision – alles gegen echte Seiten prüfen, Fehler beheben,
  Redundanzen auflösen, Features dort anpassen, wo es sinnvoll ist – und als
  **1.6.6** veröffentlichen.

---

## 0. Guardrails (nicht verhandelbar)

1. **Niemals schreibend ins Ticketsystem.** Kein Absenden, Schließen, Priorität
   setzen, Besitzer ändern. Klick-Tests sind ausdrücklich erlaubt, aber nur mit
   dem Wächter (`tools/browser/guard.js`), der `POST`/`PUT`/`PATCH`/`DELETE`
   abweist und Formulare abfängt. Es gibt **keinen** Schalter, der das aufhebt –
   auch nicht „nur einmal zum Testen".
2. **Keine Zugangsdaten.** Die Anmeldung erfolgt einmalig von Hand über
   `.\browser.cmd login`; die Sitzung liegt in `.browser-profile/` (gitignored).
   Passwörter gehören weder in Skripte noch in Commits noch in den Chat.
3. **Domain-Allowlist nicht ändern:** `https://otrs.staff.hsrw/otrs/index.pl*`
   und `…/customer.pl*`. Keine weiteren Hosts.
4. **Speicherschlüssel nicht umbenennen.** `znunyHelperSettings`,
   `…TicketState`, `…SearchHistory`, `…CategoryConfig`,
   `…PriorityTemplateConfig`, `…TicketSoundConfig`, `…SeenLockedTicketIds`,
   `…QuickReplyLayout`, `…QuickReplyDrafts`. Umbenennen löscht Nutzerdaten.
5. **Keine neuen Manifest-Berechtigungen** ohne zwingenden Grund – jede
   Erweiterung braucht eine erneute Store-Prüfung.
6. **Tags nicht mehr verschieben.** Ab 1.6.1 gilt: pro Release ein eigenes Tag.
7. **Nutzerkommunikation auf Deutsch**, knapp, mit überprüften Aussagen. Keine
   Behauptung ohne Prüfung – lieber „ungeprüft" sagen.

---

## 1. Umgebung (wichtig, sonst läuft nichts)

| Sache | Wert |
| --- | --- |
| **Node** | **nicht im PATH!** Nur die Laufzeit des Harness: `%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`. Immer `.\browser.cmd …` benutzen, das findet Node selbst. |
| Python | `%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` |
| Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` (157.x) |
| PowerShell | 5.1. `Get-Content` liest UTF-8 falsch → `[System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)` benutzen. `cd` wirkt nicht auf .NET-Datei-APIs → absolute Pfade. |
| npm | **nicht vorhanden.** npm-Scripts sind dokumentiert, aber auf diesem Rechner nicht ausführbar. Alles über `.\browser.cmd` bzw. direkte `node`-Aufrufe mit vollem Pfad. |
| Erweiterung laden | Chrome ignoriert seit Version 137 `--load-extension`. Das Harness nutzt `Extensions.loadUnpacked` über CDP. |

**Merke:** `Measure-Object -Line` zählt Leerzeilen nicht – für echte Zeilenzahlen
`[System.IO.File]::ReadAllLines(...).Count`.

---

## 2. Was das Projekt ist

MV3-WebExtension für das HSRW-Znuny (`otrs.staff.hsrw`), **kein Build-Schritt**,
keine Abhängigkeiten außer den vendordierten Bibliotheken (Mammoth für DOCX,
SheetJS für Tabellen). Drei Welten:

| Datei | Welt | Zeilen | Aufgabe |
| --- | --- | --- | --- |
| `src/content.js` | isoliert | 9.664 | praktisch alle Funktionen |
| `src/page-bridge.js` | MAIN (`document_start`) | 482 | `window.open`, Znuny-Popup-Patch, Ereignisbrücke |
| `src/background.js` | Hintergrund | 335 | Tab-Lebenszyklus, Aktions-Tabs schließen |
| `popup/*` | Erweiterungsseite | 287 + 184 | 15 Schalter, Sound-Auswahl |
| `welcome/*` | Erweiterungsseite | – | Changelog-Seite |

**Firefox-Falle, die schon dreimal Zeit gekostet hat:** Content-Scripts laufen in
einer eigenen Welt. Objekte in `CustomEvent.detail`, die das Content-Script
erzeugt, kann die Seite nicht lesen; Eigenschaften auf fremden Dokumenten gehen
verloren. Deshalb: **Strings und DOM-Attribute (`dataset.zh…`) als Transport**,
niemals Objekte. `all_frames` ist **nicht** gesetzt – im Schnellantwort-iframe
läuft kein eigenes Skript; Kürzel werden vom Hauptfenster aus an das Rahmen-Dokument
gebunden.

---

## 3. Die 15 Schalter und ihre Standardwerte

**Standard aus:** `ebHelper`, `searchResultsPopup`, `assignedTicketSound`, `quickReply`.
**Standard an:** alle übrigen – `attachmentPreview`, `ticketArticleSearch`,
`ticketNumberCopy`, `directArticleActions`, `pendingDateButtons`, `popupTabs`,
`ticketListInfiniteScroll`, `ticketNumberSearch`, `ticketCategories`,
`priorityTemplates`, `keyboardShortcuts`.
Dazu: `pendingDateDefaultDays: 7`, Warte-Knöpfe `3, 7, 14`.

Ein Feature gilt als „im Popup vorhanden", wenn es einen dieser Schalter hat. Neue
Funktionen **müssen** einen Schalter bekommen (Nutzererwartung).

---

## 4. Werkzeuge im Repo

### Release-Infrastruktur
```powershell
.\browser.cmd --help                                  # Übersicht des Aufrufers
& $py tools/sync-firefox.py --quiet                   # Firefox-Baum abgleichen
& $node tools/run-node-test.js                        # Syntaxcheck + 255 Regressionstests
& $py tools/build-release-zips.py                     # drei Archive
& $py tools/verify-release-zips.py                    # SHA256 je Eintrag
& $py tools/make-netwiki-absatzform.py                # Absatzfassung der NetWiki-Doku neu bauen
```

### Browser-Harness (der eigentliche Hebel)
```powershell
.\browser.cmd smoke      # Fixtures: injiziert die Erweiterung? Exceptions? Screenshots
.\browser.cmd clicks     # Klick-Tests, nur lesend, mit Wächterbericht
.\browser.cmd show       # sichtbar, mit Pausen und Erzählung
.\browser.cmd record     # sichtbar + Aufzeichnung als Bilderfolge mit Abspielseite
.\browser.cmd login      # einmalig im Znuny anmelden
.\browser.cmd capture    # echte Seiten aufnehmen
```

- `tools/browser/cdp.js` – CDP-Client über Node-WebSocket, **keine Zusatzpakete**.
- `tools/browser/launch.js` – Chrome starten, Erweiterung via `Extensions.loadUnpacked`.
- `tools/browser/fixtures.js` – beantwortet `https://otrs.staff.hsrw/…` aus
  `tools/fixtures/`; unterstützt `folgeseiten` fürs Nachladen.
- `tools/browser/guard.js` – Wächter (siehe Guardrails).
- `tools/browser/smoke.js` – Seitenprüfung + Screenshot.
- `tools/browser/clicks.js` – echte Maus-/Tastaturbedienung, Szenarien in
  `tools/fixtures/clicks.js`.
- `tools/browser/screencast.js` – Aufzeichnung + `index.html`-Abspielseite.
- `tools/browser/capture.js` – Aufnahme echter Seiten (ohne Erweiterung!).
- `tools/browser/browser.ps1` + `browser.cmd` – Aufrufer, der Node findet.

Ausgaben: `tools/browser/output/` (Screenshots, Aufzeichnungen, gitignored),
`tools/fixtures/aufnahme/` (echte Aufnahmen, gitignored wegen Ticketdaten).

---

## 5. Wo die Doku liegt (und wo sie doppelt ist)

| Datei | Rolle |
| --- | --- |
| `README.md` | Nutzerdoku **und** Entwicklerdoku |
| `NETWIKI-Znuny-Helper.md` | fast identische Nutzerdoku (für das NetWiki) |
| `NETWIKI-Znuny-Helper-dokuwiki.txt` | dieselbe Doku in DokuWiki-Syntax |
| `NETWIKI-Znuny-Helper-dokuwiki-absatzform.txt` | **generiert** aus der DokuWiki-Fassung (jede Zeile ein Absatz) |
| `tools/browser/README.md` | Handbuch des Harness |
| `CHANGELOG.md` | Versionshistorie (Keep-a-Changelog-Stil) |

**Bekannte Redundanz:** `README.md` und `NETWIKI-Znuny-Helper.md` sind zu ~90 %
identisch; die Absatzform ist abgeleitet. Beim Ändern von Texten **alle vier**
Fassungen angleichen (Absatzform per Generator). Das ist eine der Aufgaben in
Phase 3.

**NetWiki-Stolperstein (geklärt, nicht wieder aufmachen):** Die Ziel-Wiki-Seite
verliert beim Einfügen Zeilenumbrüche innerhalb eines Blocks; nur Absatzgrenzen
überleben. Deshalb die Absatzform: keine Tabellen, keine mehrzeiligen Listen.
Der Nutzer fügt sie manuell ein – Task ist nicht „automatisieren", sondern die
Datei aktuell halten.

---

## 6. Stand der Prüfung (was schon gilt)

- `npm test`: **255 Prüfungen grün** (Syntaxcheck beider Bäume + Regressionstest).
- Firefox-Parität (`sync-firefox.py --check`): **keine Abweichungen**.
- Rauchtest: **4 von 4 Fixture-Seiten grün** (Übersicht inkl. Nachladen,
  Ticketansicht, Kundenportal, Suchdialog).
- Klick-Tests: **6 von 6 Szenarien grün**, zweimal hintereinander stabil:
  Kategorie setzen/zurück auf Auto, Kategorien-Verwaltung, Artikelsuche tippen,
  Anhang-Vorschau, „Suche starten" abgefangen, Strg+Enter abgefangen.
- Wächterbericht bestätigt: 1 Formular abgefangen, 0 schreibende Anfragen.

**Aber:** Alle Fixtures sind **synthetisch**. Genau das ist die Lücke, die diese
Revision schließen soll.

---

## 7. Offene Befunde und Aufgaben

### 7.1 Bestätigte Befunde (mit Beleg)

| # | Befund | Ort | Aufwand |
| --- | --- | --- | --- |
| B1 | **Kategorien-Dialog schließt nicht mit Escape.** Vorschau-Overlay und Notiz-Dialog können es, die Kategorien-Verwaltung nicht. | `content.js` – `openCategoryManager` (um Zeile 7980); Muster: `handleQuickReplyEscape` (8758), Escape-Handler des Overlays (2186/2319/4716) | klein |
| B2 | **Tab-Riegel des Wächters hat ein Zeitfenster.** Greift das Addon die Original-`window.open`-Referenz ab, bevor der Wächter ersetzt, entsteht ein Tab. Wird geschlossen und gemeldet; kein Schreibzugriff möglich. | `guard.js` | klein, optional |
| B3 | **Fixtures sind erfunden.** Artikeltabelle brauchte echte Spalten `Nr./Sender/Betreff/Erstellt`; die Kundentabelle hat noch `Ticket#/Titel/Alter/Status` (unverifiziert gegen live). | `tools/fixtures/*.html` | Phase 1 |
| B4 | **Keine echten Aufnahmen.** `.browser-profile/` ist nicht angemeldet, `tools/fixtures/aufnahme/` ist leer. | – | Phase 0 |

### 7.2 Noch nicht gebaut (seit Wochen offen, vom Nutzer mehrfach angeboten)

| # | Vorhaben | Warum es sich lohnt |
| --- | --- | --- |
| F1 | **Diagnose-Schalter im Popup** – Version, erkannte Seite/Tabelle, aktive Einstellungen, Speichergrößen, letzte Fehler, Kopierknopf | Nutzer meldet „geht nicht" → ein Klick liefert alles, was zur Diagnose nötig ist. Ersetzt Rückfragen. |
| F2 | **Store-Texte** – Kurzbeschreibung + Release-Notes innerhalb der Grenzen von AMO und Chrome Web Store | Ohne sie kein Store-Update; die drei Einträge sind nicht gelistet, aber vorhanden. |
| F3 | **`web-ext lint`** für Firefox (AMO-Prüfung vor dem Upload) | Findet Manifest-/Berechtigungsprobleme vor dem Store statt danach. |

### 7.3 Redundanzen, die aufgeräumt werden sollten

| # | Redundanz | Vorschlag |
| --- | --- | --- |
| R1 | `README.md` ≈ `NETWIKI-Znuny-Helper.md` (90 % gleich) | Eine Quelle (`NETWIKI-Znuny-Helper.md`) + Generator, der `README.md` und die DokuWiki-Fassung daraus erzeugt. Oder klar trennen: README = Entwicklung, NETWIKI = Anwender. **Entscheidung mit dem Nutzer.** |
| R2 | `tools/tests/infinite-scroll-regression.test.js` (1.553 Zeilen, 255 Prüfungen) heißt nach Infinite Scroll, prüft aber fast alles | Aufteilen nach Bereich (`tickets.test.js`, `search.test.js`, `categories.test.js`, `drafts.test.js`, `quickreply.test.js`) + gemeinsamer Helfer. Vorsicht: der Testhelfer ist empfindlich (siehe 8.3). |
| R3 | Zwei Erweiterungsbäume (Chrome/Firefox) bis auf Manifest byte-identisch | Bleibt so, ist Absicht – nicht „vereinheitlichen". Nur `sync-firefox.py` benutzen. |
| R4 | `fixtures.json` und `clicks.js` müssen bei neuen Seiten beide gepflegt werden | Prüfen, ob ein Szenario seine Seite selbst deklarieren kann. |
| R5 | Release-Schritte stehen in `README.md` und sind teilweise im Commit-Stil wiederholt | Ein `tools/release.md`-Checkliste oder ein Skript, das die Versionsstellen prüft. |

---

## 8. Fallen, die schon zugeschlagen haben

1. **`--load-extension` ist tot** (Chrome ≥ 137). Immer `Extensions.loadUnpacked`.
2. **Eigene Testseite vom Wächter geschlossen** → Lauf hängt stumm. Ursache war
   `Target.setDiscoverTargets` + sofortiges Schließen. Jetzt: `window.open`
   ersetzen + nachträgliches Aufspüren über `findeFremdeTabs`.
3. **Der Testhelfer `extractDeclaration`** (im Regressionstest) schneidet
   Funktionen per Textsuche aus `content.js`. Er scheitert an Klammern in
   Default-Parametern, an Apostrophen/Kommentaren und an Regex-Literalen mit
   Anführungszeichen. Bei Fehlern dort **nicht** die Funktion ändern, sondern den
   Helfer (er überspringt Parameterlisten und Kommentare, hat eine
   Überextraktions-Warnung).
4. **Asynchrone Speicherung:** Nach `change` an einem Kategorie-Feld ist das Badge
   erst einen Moment später aktuell. In Tests `warteAuf(ausdruck)` benutzen, keine
   festen Pausen – sonst flackern die Ergebnisse.
5. **Zwei große Zeitfresser:** `content.js` komplett lesen (9.664 Zeilen) und
   Vermutungen über DOM-Strukturen. Stattdessen: `grep` mit Kontext, und das
   Harness fragen (`smoke`/`clicks` liefern die Wahrheit in einem Aufruf).
6. **Der Nutzer hat wenig Budget.** Siehe Abschnitt 10.

---

## 9. Schlachtplan

Zeitbudget: **ein Arbeitstag**. Reihenfolge so gewählt, dass jeder Schritt auch
allein einen Nutzen hat – bricht etwas ab, ist trotzdem etwas fertig.

### Phase 0 – Anmeldung und echte Seiten (20–30 min)
```powershell
cd C:\Users\TKO\Music\znuny-helper
.\browser.cmd login                 # Nutzer meldet sich von Hand, dann Enter
.\browser.cmd capture               # alle vier Seiten aufnehmen
```
Ergebnis prüfen: `tools/fixtures/aufnahme/*.html` + `.console.txt` + `.png`.
Meldet `capture` „sieht nach Anmeldeseite aus" → Sitzung abgelaufen, `login` erneut.

**Danach sofort:** die Aufnahmen ansehen (Screenshots!) und mit den synthetischen
Fixtures vergleichen. Alles, was abweicht, notieren – das ist die Arbeitsliste
für Phase 1.

### Phase 1 – Verifikation gegen echtes Markup (60–90 min)
1. Aufnahmen übernehmen: `.\browser.cmd capture --uebernehmen`.
2. `.\browser.cmd smoke` und `.\browser.cmd clicks` laufen lassen.
3. **Jeden Fehlschlag klassifizieren** – das ist die Kernarbeit:
   - *Fixture falsch* → Fixture korrigieren (Muster: B3, Artikeltabelle).
   - *Erwartung falsch* → Erwartung korrigieren (Selektor umbenannt).
   - *Produktfehler* → in die Bugliste, Phase 2.
4. Ergebnis: eine priorisierte Liste „echte Fehler" mit Repro über Fixture+Szenario.
5. Zusätzlich je Seite prüfen, was die Erweiterung **nicht** tut, obwohl sie sollte
   (der Smoke-Test meldet `beobachtet`-Selektoren – dort steht oft der Hinweis).

### Phase 2 – Fehler beheben (2–3 h)
Reihenfolge nach Nutzerwirkung, nicht nach Reihenfolge des Fundes:
1. Alles, was eine Kernfunktion lahmlegt (Kategorien, Suche, Schnellantwort,
   Strg+Enter, Infinite Scroll).
2. **B1** (Escape im Kategorien-Dialog) – klein, sofort mit Test.
3. Firefox-spezifische Fehler zuerst absichern: Realm-Regel aus Abschnitt 2.
4. Nach **jedem** Fix: `.\browser.cmd clicks` + `npm test`-Äquivalent
   (`run-node-test.js`). Nicht sammeln – der Wächter deckt Regressionen billig auf.

### Phase 3 – Redundanzen (60 min)
1. **R2** Tests aufteilen (größter Gewinn für künftige Arbeit) – mit gemeinsamer
   Helferdatei, damit `extractDeclaration` nur einmal existiert.
2. **R1** Doku-Quelle festlegen (Entscheidung dem Nutzer vorlegen, zwei Varianten
   mit Aufwand nennen).
3. **R4/R5** nur wenn Zeit bleibt.

### Phase 4 – Features (60 min)
1. **F1 Diagnose-Schalter** – höchster Nutzen, klar umrissen: eigener Abschnitt im
   Popup, sammelt Version (aus Manifest), `location.href`, erkannte Ticketliste
   (ja/nein + Spaltennamen), alle Einstellungen, `chrome.storage`-Größen je
   Schlüssel, die letzten 20 `console.warn/error` der Erweiterung (Ringpuffer im
   Content-Script), Knopf „Kopieren". **Rein lesend**, kein Netz.
2. **B1** falls in Phase 2 nicht erledigt.
3. **F2 Store-Texte** – kurz halten: ≤ 132 Zeichen Kurzbeschreibung (Chrome),
   Release-Notes in Stichpunkten.
4. **F3** `web-ext lint` nur, wenn Node/npm verfügbar gemacht werden kann – sonst
   notieren, nicht erzwingen.

### Phase 5 – Release 1.6.6 (45 min)
Checkliste (aus `README.md`, Abschnitt „Version aktualisieren"):
1. `znuny-helper-extension/manifest.json` **und** `-firefox/manifest.json`
2. `package.json`
3. `CHANGELOG.md` (neuer Abschnitt `## [1.6.6]`)
4. `znuny-helper-extension/welcome/welcome.js` (Release-Array)
5. `NETWIKI-Znuny-Helper.md` + `NETWIKI-Znuny-Helper-dokuwiki.txt`
   (+ Absatzform per Generator!) – Versionszeile und Funktionen
6. `.\browser.cmd smoke` und `.clicks` grün
7. `sync-firefox.py --quiet` → `run-node-test.js` → `build-release-zips.py` →
   `verify-release-zips.py`
8. Commit, `git push origin main`, `git tag -a v1.6.6`, `git push origin v1.6.6`
9. Archive melden: Dateiname, Größe, SHA256 (drei Dateien)

---

## 10. Budget-Strategie (15 % Monatsbudget, ein Tag)

Das ist der knappste Teil. Regeln:

1. **Das Harness statt des Quelltextes fragen.** Ein `clicks`-Lauf beantwortet in
   ~30 s Fragen, für die sonst 3.000 Zeilen `content.js` gelesen werden müssten.
2. **Nie eine 9.664-Zeilen-Datei öffnen.** `grep` mit konkretem Muster, dann
   `read` mit `offset`/`limit` auf 30–60 Zeilen.
3. **Ein Fix, eine Verifikation** – nicht fünf Fixes und dann raten, welcher es
   war. `clicks` kostet Sekunden, ein Fehlschluss kostet den halben Tag.
4. **Subagenten nur für Parallelarbeit mit eigenem Kontext** (z. B. „prüfe alle
   15 Schalter gegen die Doku", „finde doppelte Logik in content.js"). Jeder
   Subagent hat seinen eigenen Kontext – das entlastet den Hauptfaden, kostet aber
   trotzdem Budget. Höchstens 2–3 gleichzeitig, mit eng umrissenem Auftrag.
5. **Keine Vorlese-Runden.** Ergebnisse als knappe Tabelle, nicht als Fließtext.
6. **Phasenende = Zwischenstand sichern.** Nach Phase 1 committen (auch wenn nur
   Fixtures besser sind), nach Phase 2, nach Phase 4. Ein Abbruch soll nichts
   wegwerfen.
7. **Wenn Budget knapp wird:** Phase 4 (Features) opfern, nicht Phase 1/2
   (Verifikation und Fehler). Lieber 1.6.6 mit korrigierten Fehlern als mit
   halbem Diagnose-Schalter.

---

## 11. Definition of Done für 1.6.6

- [ ] Alle vier (oder mehr) Fixtures sind **echte** Aufnahmen oder ausdrücklich als
      synthetisch markiert, mit Begründung im `fixtures.json`.
- [ ] `smoke` und `clicks` grün, ohne Ausnahmen, Wächterbericht ohne abgewiesene
      Schreibanfrage (außer in den Szenarien, die genau das prüfen).
- [ ] `run-node-test.js` grün, Firefox-Parität ohne Abweichung.
- [ ] Jeder behobene Fehler hat eine Prüfung, die ihn künftig fängt.
- [ ] `CHANGELOG.md` beschreibt Ursache und Wirkung, nicht nur die Änderung.
- [ ] Doku in allen Fassungen auf demselben Stand (Versionszeile, Funktionen).
- [ ] Drei Archive gebaut, geprüft, mit SHA256 gemeldet; Tag `v1.6.6` gepusht.
- [ ] Offene Punkte dieses Dokuments sind aktualisiert (was ist erledigt, was
      bleibt) – damit der nächste Chat wieder aufsetzen kann.

---

## 12. Erste Nachricht an den neuen Chat (zum Kopieren)

> Ich arbeite am Znuny Helper (Repo `C:\Users\TKO\Music\znuny-helper`). Im Repo
> liegt `HANDOFF-REVISION.md` – lies zuerst Abschnitt 0 (Guardrails), 1
> (Umgebung) und 9 (Schlachtplan), dann arbeite den Plan ab.
>
> Wichtig: Auf diesem Rechner ist **kein Node im PATH** – alles über
> `.\browser.cmd …`. Und: **niemals schreibend ins Ticketsystem**, Klick-Tests nur
> mit dem Wächter in `tools/browser/guard.js`.
>
> Ich habe einen Tag und wenig Budget: arbeite in der Reihenfolge des Plans,
> sichere nach jeder Phase, und frage mich nur, wenn eine Entscheidung wirklich
> meine Zustimmung braucht (z. B. Doku-Quelle festlegen). Antworte auf Deutsch.

---

## 13. Kurzreferenz: Befehle, die immer funktionieren

```powershell
cd C:\Users\TKO\Music\znuny-helper

# Erweiterung prüfen (kein Znuny nötig)
.\browser.cmd smoke
.\browser.cmd clicks

# sichtbar / mit Aufzeichnung
.\browser.cmd show
.\browser.cmd record

# echte Seiten
.\browser.cmd login
.\browser.cmd capture
.\browser.cmd capture --nur=agent-ticket-zoom --uebernehmen

# Tests und Release (Node/Python mit vollem Pfad, weil nicht im PATH)
$node = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$py   = "$env:USERPROFILE\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
& $node tools/run-node-test.js
& $py tools/sync-firefox.py --check
& $py tools/build-release-zips.py
& $py tools/verify-release-zips.py
& $py tools/make-netwiki-absatzform.py
```
