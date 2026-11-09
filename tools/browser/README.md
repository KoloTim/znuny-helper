# Browser-Werkzeuge

Chrome/Edge über das DevTools-Protokoll (CDP) ansteuern – **ohne Zusatzpakete**.
Node bringt den WebSocket-Client mit, deshalb genügt ein installiertes Chrome oder Edge.

## Wozu

Alles, was am echten DOM hängt, lässt sich mit Attrappen nicht belastbar prüfen:
Tabellenerkennung, Znuny-Widgets, Artikel-Aktionen, Popup-Schicht. Diese Werkzeuge
schließen die Lücke zwischen „Tests laufen grün" und „im echten System passiert das
Richtige".

## Die vier Aufrufe

Wenn Node im PATH liegt:

```bash
node tools/browser/smoke.js              # Fixtures prüfen (braucht kein Znuny)
node tools/browser/clicks.js             # Klick-Tests, nur lesend
node tools/browser/smoke.js --sichtbar   # dasselbe im Fenster, langsam, zum Zusehen
node tools/browser/capture.js --login    # einmalig im Profil anmelden
node tools/browser/capture.js            # echte Seiten aufnehmen
node tools/browser/testserver.js 8099    # lokaler Server für den Aufnahme-Weg
```

### Wenn Node nicht im PATH liegt

Auf dem Arbeitsrechner ist kein Node installiert – es gibt nur die Laufzeit, die das
DeepSeek Harness mitbringt. Dafür liegt im Repo-Wurzelverzeichnis ein Aufrufer, der
eine passende Node-Installation selbst sucht (PATH, übliche Installationsorte, dann
die Harness-Laufzeit) und die Skripte damit startet:

```powershell
.\browser.cmd              Überblick
.\browser.cmd smoke        Rauchtest ohne Fenster
.\browser.cmd clicks       Klick-Tests, nur lesend
.\browser.cmd show         Rauchtest im Fenster, mit Pausen
.\browser.cmd record       sichtbarer Lauf mit Aufzeichnung
.\browser.cmd login        einmalig im Znuny anmelden
.\browser.cmd capture      echte Seiten aufnehmen
```

Zusatzschalter werden durchgereicht, z. B. `.\browser.cmd show --nur=agent-suche`.
Ein bestimmtes Node lässt sich erzwingen: `$env:ZH_NODE = 'C:\Pfad\zu\node.exe'`.
Die npm-Scripts setzen dagegen ein Node im PATH voraus.

### Zusehen

Der Rauchtest lässt sich sichtbar machen – im Fenster und im Terminal:

```bash
node tools/browser/smoke.js --sichtbar
```

Das öffnet ein echtes Chrome-Fenster, geht die Seiten der Reihe nach durch und
gönnt jeder Seite eine Pause (`--settle` 2500 ms laden, `--langsam` 2200 ms
ansehen). Im Terminal steht vor jedem Schritt, was gerade passiert:

```
[1/4] agent-uebersicht - Gesperrte Tickets (Ticketliste) inkl. Nachladen
        oeffne https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketLockedView
        Seite geladen - lese DOM und Erweiterungsoberflaeche
        aufgezeichnet: 4 Bilder

ok      agent-uebersicht  (Gesperrte Tickets (Ticketliste) inkl. Nachladen)
        Meldung: Znuny Helper 1.6.5 aktiv Object | zh-Elemente: 32 | Dokumente bedient: 3
        fest        ok  .zh-cat-ui (5)
```

Mit `--bleiben` bleibt das Fenster am Ende stehen, bis Enter gedrückt wird.

### Aufzeichnen und abspielen

```bash
node tools/browser/smoke.js --sichtbar --aufzeichnen=tools/browser/output/lauf
```

Chrome schickt während des Laufs Einzelbilder des Tabs (`Page.startScreencast`).
Daraus entsteht je Seite ein Ordner mit Bildern und eine Abspielseite
`index.html`: Abspielen/Pause, Schritt zurück/vor, Tempo-Regler, Pfeiltasten und
Leertaste. Kein Videoprogramm nötig – es ist eine Bilderfolge mit etwas JavaScript.
Das scharfe Schlussbild jeder Seite wird zusätzlich übernommen, weil die
Aufzeichnung selbst nur bei sichtbaren Änderungen zeichnet.

| Schalter | Wirkung |
| --- | --- |
| `--sichtbar` | Fenster zeigen, längere Pausen, Erzählung im Terminal |
| `--headful` | Fenster zeigen, ohne Pausen (schnell) |
| `--langsam=<ms>` | Pause je Seite (Standard bei `--sichtbar`: 2200) |
| `--bleiben` | Fenster am Ende offen lassen (Enter beendet) |
| `--aufzeichnen=<dir>` | Bilderfolge + `index.html` in dieses Verzeichnis |
| `--nur=<name>` | nur diese Seite prüfen |
| `--settle=<ms>` | länger warten, bis die Seite „ruhig" ist (Standard 1500) |
| `--chrome=<pfad>` | anderes Chrome/Edge (sonst `ZH_CHROME`) |

### smoke.js

Startet Chrome ohne Fenster, lädt die Erweiterung über `Extensions.loadUnpacked`
(der Startschalter `--load-extension` wird ab Chrome 137 ignoriert) und beantwortet
alle Anfragen an `https://otrs.staff.hsrw/...` aus `tools/fixtures/`. Je Seite:

1. Meldet sich der Content-Script („Znuny Helper *Version* aktiv")?
2. Wurde eine Exception geworfen?
3. Sind die unter `fest` hinterlegten Elemente vorhanden?
4. Was ist bei `beobachtet` herausgekommen (nur Bericht)?

Screenshot je Seite nach `tools/browser/output/`. Rückgabewert 1, sobald eine feste
Erwartung verletzt ist – damit taugt es als Prüfschritt. Alle Schalter stehen in
der Tabelle oben.

### clicks.js – Klick-Tests ohne Schreibzugriff

Der Rauchtest prüft nur, dass etwas da ist. Klick-Tests bedienen die Erweiterung
wirklich: Mausklick an der Elementposition (`Input.dispatchMouseEvent`), Tippen
(`Input.insertText`), Tasten samt Modifikatoren, Auswahlfelder. Die Szenarien
stehen in `tools/fixtures/clicks.js` und lesen sich wie ein Bedienprotokoll:

```js
{
  name: "kategorie-setzen",
  seite: "agent-uebersicht",
  schritte: async (w) => {
    await w.waehle(".zh-category-select", "hardware");
    await w.pruefe("Badge zeigt die Kategorie", await w.warteAuf(
      `(document.querySelector('.zh-badge') || {}).textContent.includes('Hardware')`
    ));
  }
}
```

**Der Wächter (`guard.js`) macht die Zusage technisch wahr**, statt sie nur zu
versprechen – drei Sperren, alle im Bericht sichtbar:

1. **Schreibende Anfragen.** Jede Anfrage an das Znuny wird abgefangen. `GET`/`HEAD`
   werden aus den Fixtures beantwortet, alles andere (`POST`, `PUT`, `PATCH`,
   `DELETE`) wird mit `Aborted` abgewiesen und protokolliert.
2. **Formulare.** Ein Skript läuft vor jedem Seitenaufbau und fängt das
   `submit`-Ereignis ab (`preventDefault`), ebenso `HTMLFormElement.submit` und
   `requestSubmit`. Es zählt mit – ein Test kann also prüfen, dass das Addon
   senden *wollte*, ohne dass etwas hinausgeht.
3. **Neue Tabs.** `window.open` wird ersetzt und zählt nur mit. Entsteht trotzdem
   ein Tab, wird er nach dem Szenario geschlossen und im Bericht mit Adresse
   genannt. So existiert keine Seite, die vom Wächter nichts weiß.

   Warum das nicht wasserdicht ist: Das Erweiterungs-Skript läuft in derselben Welt
   wie der Wächter, und die Reihenfolge beim Seitenaufbau lässt sich nicht
   erzwingen. Greift das Addon eine Referenz auf das ursprüngliche `window.open`
   ab, bevor der Wächter ersetzt hat, kann doch ein Tab entstehen. Er wird sofort
   geschlossen und gemeldet; ein Schreibzugriff ist trotzdem ausgeschlossen, weil
   dieser Tab nie bedient wird – er öffnet eine Seite (GET) und wird vor jeder
   Eingabe wieder geschlossen. Auf der geprüften Seite selbst blockiert der
   Wächter alle schreibenden Anfragen.

Deshalb dürfen Szenarien gefahrlos bis zum Absenden gehen: `senden-wird-abgefangen`
klickt wirklich auf „Suche starten", `strg-enter-abgefangen` drückt wirklich
Strg+Enter – und beide prüfen anschließend, dass die Seite nicht verlassen wurde.

```bash
node tools/browser/clicks.js                     # alle Szenarien
node tools/browser/clicks.js --sichtbar          # zusehen
node tools/browser/clicks.js --nur=kategorie-setzen
node tools/browser/clicks.js --aufzeichnen=<dir> # Bilderfolge + Abspielseite
node tools/browser/clicks.js --max=120000        # Notbremse (Standard 180 s)
```

Screenshot je Szenario nach `tools/browser/output/klick-<name>.png`.

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
- Das Harness arbeitet **nur lesend**: navigieren, klicken, tippen, DOM lesen,
  Screenshot. Schreibende Anfragen sind technisch abgewiesen (siehe Wächter),
  nicht nur unerwünscht. Es gibt absichtlich keine Funktion, die ein Ticket
  absendet oder verändert – auch keinen Schalter dafür.
- Die Fixtures sind Platzhalter, solange keine echte Aufnahme vorliegt. Weicht
  eine Erwartung ab, ist deshalb **zuerst zu prüfen, ob das Fixture das echte
  Znuny abbildet** (Beispiel: die Artikeltabelle braucht die echten Spalten
  `Nr. / Sender / Betreff / Erstellt`, sonst findet die Artikelsuche nichts).
