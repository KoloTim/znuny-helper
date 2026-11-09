# Browser-Werkzeuge

Chrome/Edge über das DevTools-Protokoll (CDP) ansteuern – **ohne Zusatzpakete**.
Node bringt den WebSocket-Client mit, deshalb genügt ein installiertes Chrome oder Edge.

## Wozu

Alles, was am echten DOM hängt, lässt sich mit Attrappen nicht belastbar prüfen:
Tabellenerkennung, Znuny-Widgets, Artikel-Aktionen, Popup-Schicht. Diese Werkzeuge
schließen die Lücke zwischen „Tests laufen grün" und „im echten System passiert das
Richtige".

## Die vier Aufrufe

```bash
node tools/browser/smoke.js              # Fixtures prüfen (braucht kein Znuny)
node tools/browser/capture.js --login    # einmalig im Profil anmelden
node tools/browser/capture.js            # echte Seiten aufnehmen
node tools/browser/testserver.js 8099    # lokaler Server für den Aufnahme-Weg
```

### smoke.js

Startet Chrome ohne Fenster, lädt die Erweiterung über `Extensions.loadUnpacked`
(der Startschalter `--load-extension` wird ab Chrome 137 ignoriert) und beantwortet
alle Anfragen an `https://otrs.staff.hsrw/...` aus `tools/fixtures/`. Je Seite:

1. Meldet sich der Content-Script („Znuny Helper *Version* aktiv")?
2. Wurde eine Exception geworfen?
3. Sind die unter `fest` hinterlegten Elemente vorhanden?
4. Was ist bei `beobachtet` herausgekommen (nur Bericht)?

Screenshot je Seite nach `tools/browser/output/`. Rückgabewert 1, sobald eine feste
Erwartung verletzt ist – damit taugt es als Prüfschritt.

| Schalter | Wirkung |
| --- | --- |
| `--headful` | Fenster zeigen (zum Zuschauen) |
| `--nur=<name>` | nur diese Seite prüfen |
| `--settle=<ms>` | länger warten, bis die Seite „ruhig" ist (Standard 1500) |
| `--chrome=<pfad>` | anderes Chrome/Edge (sonst `ZH_CHROME`) |

### fixtures.json

```json
{
  "name": "agent-uebersicht",
  "beschreibung": "Gesperrte Tickets (Ticketliste) inkl. Nachladen",
  "url": "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketLockedView",
  "datei": "agent-uebersicht.html",
  "fest": [".zh-cat-ui"],
  "beobachtet": [".zh-infinite-scroll-status"],
  "folgeseiten": {
    "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketLockedView;Page=2": "agent-uebersicht-seite2.html"
  }
}
```

- `fest` – muss zutreffen, sonst schlägt die Seite fehl.
- `beobachtet` – nur Bericht. Sinnvoll, solange unklar ist, welche Oberfläche eine
  Seite tatsächlich bekommt.
- `folgeseiten` – Seiten, die beim Nachladen abgerufen werden. Damit läuft Infinite
  Scroll im Test bis zur Endebedingung.

### capture.js

Nimmt echte Seiten auf und legt sie als Fixture ab. Zwei Dinge sind dabei bewusst so:

- **Aufnahme ohne Erweiterung.** Sonst enthielte das Fixture die eingehängte
  Oberfläche des Helfers, und der Rauchtest würde seine eigene Oberfläche prüfen.
- **Sitzung im Profil statt Zugangsdaten im Skript.** `--login` öffnet ein Fenster,
  die Anmeldung erfolgt von Hand, die Cookies bleiben in `.browser-profile/`.
  Das Addon sieht keine Passwörter.

Ergebnis: `tools/fixtures/aufnahme/` mit HTML, Konsolenprotokoll und Screenshot
(nicht versioniert, weil darin Ticketdaten stehen). `--uebernehmen` kopiert die
Aufnahme über den Platzhalter und vermerkt in `fixtures.json`, dass es eine echte
Aufnahme ist. `--basis=http://127.0.0.1:8099` lenkt die Aufnahme auf einen lokalen
Server um – so lässt sich der Weg ohne Znuny-Zugang prüfen.

### testserver.js

Liefert die Fixtures über HTTP aus. Nur dafür da, `capture.js --basis=...` zu prüfen.

## Grenzen

- Nur Chromium-basiert. Firefox-Aufnahmen gehen damit nicht; für Firefox bleibt
  `about:debugging` bzw. `web-ext`.
- Der Rauchtest prüft die Oberfläche der Erweiterung, nicht die Znuny-eigene
  Funktion. Was Znuny selbst nach einem Klick tut, zeigt erst die Aufnahme im
  echten System.
- Aufgenommene Seiten enthalten Sitzungskennungen und Ticketdaten. Sie gehören
  nicht ins Repository – deshalb `tools/fixtures/aufnahme/` in `.gitignore`.
- Das Harness arbeitet **nur lesend**: navigieren, DOM lesen, Screenshot. Es gibt
  absichtlich keine Funktion, die ein Ticket absendet oder verändert.
