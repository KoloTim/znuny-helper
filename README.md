# Znuny Helper

## Kurzbeschreibung

Der **Znuny Helper** ist eine Browser-Erweiterung für unser Znuny-/OTRS-Ticketsystem. Das Addon fasst mehrere bisher einzeln genutzte Tampermonkey-Hilfsfunktionen in einer zentral verwaltbaren Erweiterung zusammen.

Ziel ist es, die tägliche Arbeit im Ticketsystem schneller und übersichtlicher zu machen. Anhänge können direkt als Vorschau geöffnet werden, Suchfunktionen werden erweitert, Ticketlisten können lokal kategorisiert werden und ServiceDesk-Prozesse wie Empfangsbestätigungen werden unterstützt.

Die Erweiterung steht für Google Chrome, Microsoft Edge und Firefox (ab Version 140) zur Verfügung.

## Zielgruppe

Das Addon richtet sich an Mitarbeitende, die regelmäßig im Znuny-Ticketsystem arbeiten, insbesondere:

- ServiceDesk
- 1st- und 2nd-Level-Support
- Mitarbeitende mit vielen Ticketlisten und Ticketrecherchen
- Personen, die Empfangsbestätigungen für Hardwareübergaben vorbereiten

## Technische Grundlage

| Punkt | Beschreibung |
| --- | --- |
| Aktuelle Version | 1.5.1 (Stand: 17.09.2026) |
| Typ | Browser-Erweiterung / WebExtension (Manifest V3) |
| Unterstützte Browser | Google Chrome, Microsoft Edge, Firefox (ab Version 140) |
| Zielsystem | `https://otrs.staff.hsrw/otrs/index.pl*` |
| Speicherung | Browserspeicher der Erweiterung |
| Externe Server | Nur für EB Helper: lokale EB-Seite `https://digi-eb.staff.hsrw/new` |
| Tampermonkey nötig | Nein |

## Installation

### Installation über den Browser-Store (empfohlen)

Über den offiziellen Store installierte Erweiterungen aktualisieren sich automatisch, sobald eine neue Version veröffentlicht wird.

- **Edge:** [Znuny Helper im Edge Add-ons Store](https://microsoftedge.microsoft.com/addons/detail/znuny-helper/hklflemenkhibeeljjdnimmcefdldhl)
- **Chrome:** [Znuny Helper im Chrome Web Store](https://chromewebstore.google.com/detail/znuny-helper/minjlaeigjamojdmolnadadpmiempcnd)
- **Firefox:** [Znuny Helper auf addons.mozilla.org](https://addons.mozilla.org/de/firefox/addon/znuny-helper/)

Alle drei Einträge sind als **nicht gelistet** eingestellt: kein Auftauchen in der Store-Suche, Installation nur über den direkten Link.

### Manuelle Installation (Entwickler-/Testmodus)

**Chrome oder Edge:**

1. Addon-Ordner lokal bereitstellen (`znuny-helper-extension`).
2. Browser öffnen.
3. Erweiterungsseite öffnen:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Entwicklermodus aktivieren.
5. **Entpackte Erweiterung laden** auswählen.
6. Den Ordner `znuny-helper-extension` auswählen.
7. Znuny-Seite neu laden.

Nach Änderungen am Addon muss die Erweiterung auf der Erweiterungsseite neu geladen werden. Danach sollte auch der Znuny-Tab aktualisiert werden.

**Firefox:**

1. Addon-Ordner lokal bereitstellen (`znuny-helper-extension-firefox`).
2. `about:debugging#/runtime/this-firefox` aufrufen.
3. **Temporäres Add-on laden…** anklicken.
4. Die Datei `manifest.json` aus dem Ordner `znuny-helper-extension-firefox` auswählen.
5. Znuny-Seite neu laden.

> Temporär geladene Firefox-Erweiterungen verschwinden beim Neustart des Browsers und müssen dann erneut geladen werden. Für eine dauerhafte Installation ist eine von Mozilla signierte Version aus dem addons.mozilla.org-Store nötig.

## Bedienung

Nach der Installation erscheint in der Browserleiste das Addon-Symbol **Znuny Helper**. Über das Popup können einzelne Funktionen aktiviert oder deaktiviert werden.

Die Einstellungen werden im Browser gespeichert. Änderungen im Popup gelten direkt nach dem Speichern bzw. nach erneutem Laden der betroffenen Znuny-Seite.

Bis auf **EB Helper**, **Suchergebnisse im neuen Tab**, **Ton bei neuem Ticket** und **Schnellantwort** sind nach der Installation alle Funktionen standardmäßig aktiv. Diese Funktionen ändern das gewohnte Verhalten deutlich genug, dass sie erst bewusst im Popup eingeschaltet werden müssen.

## Funktionen im Überblick

| Bereich | Funktion | Zweck |
| --- | --- | --- |
| Navigation | Anhang-Vorschau | PDF, Bilder, Text/Log, E-Mails, DOCX und Tabellen direkt im Ticket anzeigen |
| Navigation | Popups als Tabs | Znuny-Aktionen übersichtlicher in Tabs öffnen |
| Navigation | Schnellantwort | Antworten, Besitzer ändern, Notiz, Schließen, Verknüpfen und Zusammenfassen direkt als kleines Fenster über dem Ticket statt in einem neuen Tab |
| Navigation | Suchergebnisse im neuen Tab | Suchergebnis-Seiten optional in neuem Tab öffnen |
| Suchen | Ticketnummer-Suche | Globale Suche um ein direktes Ticketnummer-Feld erweitern |
| Suchen | Ticketinhalt-Suche | Innerhalb eines geöffneten Tickets suchen |
| Suchen | Case-Nummer kopieren | Die Case-/Ticketnummer oben links im geöffneten Ticket per Klick kopieren |
| Ticketlisten | Ticket-Kategorien | Tickets lokal gruppieren, markieren und notieren |
| Ticketlisten | Infinite Scroll | Weitere Ticketlistenseiten beim Scrollen automatisch laden (die Seitenzahlen bleiben als Fallback sichtbar) |
| ServiceDesk | EB Helper | Empfangsbestätigungen aus Hardware-Tickets vorbereiten |
| ServiceDesk | Prioritäts-Vorlagen | Prioritäts-, Besitzer- und Neues-Telefon-Ticket-Seiten mit anpassbaren Schnellbuttons vorbefüllen (inkl. Priorität und Auswirkung) |
| Antwort | Warten-Schnellauswahl | Schnellknöpfe für das Wartedatum bei "Warten"-Status (Tage im Popup einstellbar) |
| Tastenkürzel | Strg+Enter zum Senden | Aktuelles Formular übermitteln, Tab schließt danach automatisch |
| Benachrichtigung | Ton bei neuem Ticket | Sound abspielen, sobald ein neues Ticket bei einem selbst gesperrt wird |

## Anhang-Vorschau

Die Anhang-Vorschau ergänzt erkannte Anhänge im Ticket um einen Button **Vorschau**. Damit lassen sich viele gängige Dateitypen direkt als Overlay im Browser ansehen, ohne sie herunterzuladen oder die Ticketansicht zu verlassen.

Unterstützt werden:

- **PDF-Dateien** – Anzeige im eingebetteten PDF-Viewer des Browsers.
- **Bilder** (PNG, JPG/JPEG, GIF, WebP, BMP, SVG, AVIF).
- **Textdateien** (TXT, LOG) – als reiner Text, bei sehr großen Dateien wird nur der Anfang angezeigt.
- **E-Mails** (EML) – Absender, Empfänger, Betreff und Datum werden aufbereitet dargestellt, darunter der E-Mail-Text.
- **Word-Dokumente** (DOCX) – Inhalt wird in lesbares HTML umgewandelt; Hinweise der Konvertierung (z. B. nicht unterstützte Formatierungen) werden bei Bedarf eingeblendet.
- **Tabellen** (XLSX, XLSM, XLSB, XLS, ODS) – Anzeige als statische Tabelle (begrenzt auf die ersten 1000 Zeilen und 80 Spalten je Tabellenblatt).

> Alte DOC-Dateien (Word 97–2003) werden nicht direkt unterstützt; hier bleibt nur der normale Download-Link. Für alle anderen, nicht erkannten Dateitypen gilt dasselbe.

Alle Vorschauen laufen vollständig lokal im Browser (u. a. über die eingebundenen Bibliotheken Mammoth.js für DOCX und SheetJS für Tabellen) – die Anhänge werden dabei an keinen externen Server außer Znuny selbst übertragen.

Die Vorschau-Fenster für DOCX und Tabellen laufen in einem abgesicherten ("sandboxed") Rahmen ohne Skriptausführung. Die PDF-Vorschau nutzt bewusst keine solche Rahmen-Sandbox, da der eingebaute PDF-Betrachter von Chrome und Edge sich innerhalb eines sandboxed Rahmens grundsätzlich nicht aktiviert – die PDF-Darstellung übernimmt stattdessen direkt der eingebaute PDF-Betrachter des Browsers, der bereits eigenständig und getrennt vom übrigen Seiteninhalt läuft. Der übliche Vorschauweg erzwingt dabei zusätzlich den PDF-Dateityp, unabhängig davon, was der Server angibt. Nur im selteneren Fall, dass ein Anhang nicht sicher als PDF bestätigt werden kann, zeigt das Addon statt einer automatischen Vorschau lediglich einen Download-Link an.

Zusätzlich werden Bilder, die bereits direkt im Ticketartikel angezeigt werden (z. B. eingebettete Bilder aus HTML-Mails), anklickbar: beim Überfahren mit der Maus erscheint ein Rahmen, ein Klick öffnet das Bild vergrößert. Sehr kleine Bilder (unter 24×24 Pixel, meist Spacer oder Tracking-Pixel) bleiben davon ausgenommen.

## Popups als Tabs

Einige Znuny-Aktionen öffnen standardmäßig kleine Popup-Fenster. Die Funktion **Popups als Tabs** sorgt dafür, dass solche Aktionen stattdessen in normalen Browser-Tabs geöffnet werden.

Vorteile:

- bessere Übersicht
- einfacheres Wechseln zwischen Ticket und Aktion
- weniger Probleme mit blockierten oder verdeckten Popup-Fenstern

## Schnellantwort

Standardmäßig öffnen "Antworten" und "Allen antworten" (Artikel), "Besitzer" (Personen), "Notiz" (Kommunikation) sowie "Schließen", "Verknüpfen" und "Zusammenfassen" die echte Znuny-Seite der jeweiligen Aktion (inklusive Editor, Signatur und aller Pflichtfelder) – je nach Einstellung **Popups als Tabs** entweder als Popup-Fenster oder als neuer Tab.

Ist **Schnellantwort** aktiviert, öffnet sich diese Seite stattdessen als kleines Fenster direkt über dem aktuellen Ticket, ganz ohne Tab- oder Fensterwechsel. Es handelt sich weiterhin um die echte Znuny-Seite, nur eingebettet statt in einem eigenen Tab oder Popup – alle Felder, der Editor und die Validierung funktionieren wie gewohnt, einschließlich Prioritäts-Vorlagen und Warten-Schnellauswahl, sofern die jeweilige Seite entsprechende Felder anzeigt. Das Fenster zeigt dabei je nach Aktion die passende Überschrift (z. B. "Schnellantwort", "Besitzer ändern", "Notiz hinzufügen", "Ticket schließen").

Nach dem Absenden schließt sich das Fenster automatisch und das Ticket wird aktualisiert, damit die Änderung sofort sichtbar ist. Über den Knopf **Schließen** oben rechts im Fenster lässt sich das jederzeit verwerfen, ohne etwas zu übermitteln.

> **Wichtig:** Die Funktion ist standardmäßig deaktiviert, weil sie das gewohnte Verhalten grundlegend ändert. Sie betrifft "Antworten", "Allen antworten", "Besitzer", "Notiz", "Schließen", "Verknüpfen" und "Zusammenfassen"; Weiterleiten, Umleiten und andere Aktionen öffnen weiterhin wie bisher. Die zugrunde liegenden Znuny-Aktionsnamen für Schließen/Verknüpfen/Zusammenfassen sind unsere beste Einschätzung der Standard-Bezeichnungen – trifft eine davon an dieser Installation nicht zu, öffnet der jeweilige Link einfach weiterhin wie gewohnt.

## Suchergebnisse im neuen Tab

Wenn diese Option aktiv ist, werden Suchergebnisse in einem neuen Tab geöffnet. Dadurch bleibt die aktuelle Znuny-Seite erhalten.

Wenn die Option deaktiviert ist, sollte die Suche wieder im aktuellen Tab laufen.

## Ticketnummer-Suche

Die globale Znuny-Suche wird um ein gut sichtbares Feld **Ticketnummer** ergänzt. Damit kann direkt nach Ticketnummern gesucht werden, ohne dass der passende Znuny-Zusatzfilter manuell gesetzt werden muss.

Zusätzlich setzt das Addon automatisch einen Zeitraumfilter:

- Attribut: **Letzte Ticket-Änderungszeit (zwischen)**
- Zeitraum: **letztes Jahr bis heute**

Beispiel: Am `02.07.2026` wird automatisch von `02.07.2025` bis `02.07.2026` gesucht.

Das verhindert sehr große Suchläufe und sorgt trotzdem dafür, dass aktuelle und ältere Tickets innerhalb eines sinnvollen Zeitraums gefunden werden.

Außerdem merkt sich das Addon lokal die letzten Suchbegriffe und Ticketnummern als kleine Suchhistorie.

Zusätzlich gibt es Schnellknöpfe, um den Zeitraum mit einem Klick umzustellen:

- Letzte Woche
- Letzter Monat
- Letztes Quartal
- Letztes Jahr (Standard)

Ein Klick setzt nur den Zeitraum neu; die Suche muss danach wie gewohnt gestartet werden.

## Ticketinhalt-Suche

In geöffneten Tickets ergänzt das Addon oben im Ticket ein Suchfeld. Damit kann innerhalb der Ticketansicht gesucht werden.

Durchsucht werden:

- Artikelübersicht
- Betreffzeilen
- sichtbare Artikeltexte
- bereits geladene Ticketartikel

Die Suche ist nicht auf Groß-/Kleinschreibung festgelegt. Treffer werden markiert, und bei mehreren Treffern kann durch die Treffer navigiert werden.

> Ticketinhalte, die Znuny noch nicht geladen hat, müssen ggf. erst geöffnet oder nachgeladen werden.

## Case-Nummer kopieren

Im geöffneten Ticket wird die Case-/Ticketnummer oben links in der Überschrift anklickbar. Ein Klick kopiert die Nummer in die Zwischenablage und bestätigt dies kurz (grüne Hervorhebung, Tooltip „Kopiert!"). Erkannt wird die erste Ziffernfolge der Überschrift, sodass sowohl die reine Ticketnummer als auch eine „Case …"-Schreibweise erfasst wird. Die Funktion lässt sich im Popup unter **Suche** abschalten.

## Ticket-Kategorien

Die Funktion **Ticket-Kategorien** erweitert bestimmte Ticketlisten um eine lokale Kategorisierung.

Standardkategorien sind sechs Themen-Kategorien plus "Ohne Kategorie":

- Ohne Kategorie
- Dringend / Störung (pastellrot)
- Externe Zuständigkeit (pastelllila)
- Software / Zugang (pastellblau)
- Hardware / Abholung (pastellorange)
- Studis (pastellgrün)
- Warten / Rückmeldung (pastellgelb)

Tickets können dadurch übersichtlicher gruppiert und schneller wiedergefunden werden. Die Zuordnung verändert keine offiziellen Znuny-Daten und bleibt ausschließlich lokal im Browser gespeichert.

### Automatische Erkennung

Ist eine Kategorie noch nicht manuell gesetzt, schlägt das Addon anhand von Stichwörtern in Case, Titel, Absender, Status und Kundennummer automatisch eine Kategorie vor.

**Wichtig – der Vorschlag ist keine Bestätigung:** automatisch erkannte Kategorien sind immer sichtbar als Vorschlag markiert (kursive Schrift, gestrichelter Rahmen, Zusatz "(Vorschlag)" im Badge und "Auto (Vorschlag)" in der Auswahlliste). Erst eine manuelle Auswahl im Kategorie-Feld gilt als bestätigt und bleibt dauerhaft gespeichert, auch wenn sich der Ticketinhalt später ändert.

Passt der Ticketinhalt auf mehrere Kategorien gleichzeitig, gewinnt die Kategorie, die in der Liste weiter oben steht. Die Standardreihenfolge (= Prüfreihenfolge) ist bewusst so gewählt:

1. **Dringend / Störung** – muss zuerst auffallen, auch wenn der Text sonst nach Software oder Hardware aussieht.
2. **Externe Zuständigkeit** – Tickets, die eigentlich an eine andere Stelle gehören, sollen nicht erst als IT-Thema einsortiert werden.
3. **Software / Zugang** – die häufigsten, meist schnell lösbaren Anfragen.
4. **Hardware / Abholung** – planbare Aufgaben (Abholung, Reparatur, Beschaffung).
5. **Studis** – Themen rund um Studierende, die nicht bereits als dringend/extern/Software/Hardware erkannt wurden.
6. **Warten / Rückmeldung** – niedrigste Priorität, da es eher ein Status als ein Thema ist.

Über **Auto (Vorschlag)** im Kategorie-Feld lässt sich eine manuelle Auswahl jederzeit wieder auf automatische Erkennung zurückstellen.

### Bearbeitung der Kategorien

Über **Kategorien bearbeiten** können Nutzerinnen und Nutzer das Kategoriesystem anpassen:

- Kategorien anlegen
- Kategorien umbenennen
- Kurzbezeichnungen ändern
- Farben anpassen
- Reihenfolge ändern (bestimmt zugleich die Priorität bei der automatischen Erkennung)
- Keywords für die automatische Erkennung pflegen
- Standard wiederherstellen
- Kategorien als Datei exportieren, um sie mit Kolleginnen und Kollegen zu teilen
- Kategorien aus einer Datei importieren

Manuelle Anpassungen bleiben lokal gespeichert.

### Grenzen der automatischen Erkennung

- Die Erkennung liest nur die in der Ticketliste sichtbaren Spalten (Case, Titel, Absender, Status, Kundennummer) – keine E-Mail-Header, keine Anhänge, keine Artikeltexte.
- Es handelt sich um reinen Stichwortabgleich, keine Absenderprüfung und keine echte Domänen-/Identitätsprüfung.
- Das Addon vergibt, versendet, schließt oder eskaliert nichts automatisch – jede Aktion bleibt bei der Person, die das Ticket bearbeitet.

### Lokale Notizen

Zu Tickets können lokale Notizen ergänzt werden. Diese Notizen werden im Browser gespeichert und sind nicht Teil des offiziellen Tickets.

> Wichtig: Lokale Notizen sind nicht für andere Personen sichtbar und ersetzen keine interne Notiz im Znuny-Ticket.

## Infinite Scroll

Wenn **Infinite Scroll** aktiv ist, lädt das Addon in Ticketlisten automatisch weitere Ergebnisse nach, sobald man nach unten scrollt.

Das spart Klicks auf weitere Seiten und macht längere Listen flüssiger nutzbar. Die Seitenzahlen bleiben dabei sichtbar, sodass man bei Bedarf auch manuell weiterblättern kann.

Hinweis: Da automatisch weitere Znuny-Seiten abgerufen werden, kann die Funktion bei sehr großen Listen etwas mehr Browser- und Netzwerklast erzeugen.

## Prioritäts-Vorlagen

Die Funktion **Prioritäts-Vorlagen** ist standardmäßig aktiv und ergänzt Prioritäts- und Besitzer-Aktionsseiten sowie das Formular **Neues Telefon-Ticket** um anpassbare Schnellbuttons. Ein Klick füllt Felder wie Typ, Queue, Service, Besitzer, Priorität, Auswirkung, Kategorie, Betreff oder Text automatisch mit einer hinterlegten Vorlage.

Über den Knopf **Als Vorlage speichern** lässt sich der aktuell ausgefüllte Zustand der Seite (Typ, Queue, Service, Besitzer, Priorität, Auswirkung, Kategorie, Betreff, Text) direkt als neue Vorlage übernehmen, ohne die Felder von Hand in die Vorlagenverwaltung abtippen zu müssen.

Über die Vorlagenverwaltung können Nutzerinnen und Nutzer außerdem:

- Vorlagen anlegen, umbenennen und löschen
- Feldwerte je Vorlage anpassen
- Vorlagen einer **Gruppe** zuordnen; die Schnellbuttons werden dann nach diesen Gruppen sortiert angeordnet (Gruppen alphabetisch, Vorlagen ohne Gruppe zuletzt)
- die Reihenfolge der Schnellbuttons mit **Hoch/Runter** ändern
- Vorlagen als Datei exportieren, um sie mit Kolleginnen und Kollegen zu teilen
- Vorlagen aus einer Datei importieren

Zusätzlich zeigt das Addon auf Prioritätsseiten einen Warnhinweis an, wenn ein Ticket einer erkennbar externen Kundenadresse zugeordnet ist oder im Titel als extern markiert wurde. Das soll daran erinnern, die Ticketdaten vor dem Übermitteln zu prüfen.

## Warten-Schnellauswahl

Wo immer beim Setzen eines "Warten"-Status ein Datum verlangt wird, ergänzt das Addon Schnellknöpfe für das Wartedatum:

- +3 Tage (Standard, wird beim Erscheinen des Datumsfelds automatisch vorbelegt)
- +7 Tage
- +14 Tage

Die Tage lassen sich im Popup unter **Antworten und Warten → Tage der Schnellknöpfe** frei einstellen (kommagetrennt, z. B. `1, 3, 7, 14`). Der erste Wert wird beim Erscheinen des Datumsfelds automatisch gesetzt.

Ein Klick auf einen anderen Knopf überschreibt die Vorbelegung jederzeit.

## Tastenkürzel

**Strg+Enter** übermittelt das aktuell offene Formular (Antwort, Notiz, Schließen, Priorität, ...), egal ob der Cursor gerade im normalen Formular oder im Text-Editor steht. Danach greift wie gewohnt die Funktion **Popups als Tabs**: Der Tab schließt automatisch und die Ursprungsseite wird aktualisiert.

Das Kürzel funktioniert nur, wenn auf der aktuellen Seite ein passender "Übermitteln"-Knopf sichtbar ist; sonst passiert nichts.

## Ton bei neuem Ticket

Ist diese Funktion aktiv, spielt das Addon einen kurzen Sound ab, sobald ein neues Ticket bei einem selbst gesperrt wird, und aktualisiert dabei automatisch die gerade sichtbare Ticketliste – das neue Ticket erscheint sofort, ohne dass Znunys eigenes Aktualisierungsintervall der Übersichten abgewartet werden muss. Dazu gleicht das Addon im Hintergrund regelmäßig (etwa einmal pro Minute) die eigene Ansicht "Gesperrte Tickets" ab und merkt sich lokal, welche Ticketnummern schon bekannt sind.

> Die automatische Aktualisierung betrifft nur Ticketlisten-/Übersichtsseiten. Ist gerade ein Ticket, eine Antwort oder ein anderes Formular geöffnet, wird ausschließlich der Sound abgespielt – die Seite bleibt unangetastet.

Im Addon-Popup lässt sich unter **Benachrichtigung**:

- der gewünschte Sound aus einer Liste auswählen und per Knopf vorab anhören,
- ein eigener Sound per Datei-Upload hinzufügen,
- ein selbst hinzugefügter Sound wieder entfernen.

Zehn Sounds sind bereits eingebaut: drei dezente Standardtöne (Sanfter Ping, Zwei-Ton-Chime, Weicher Klick – Sanfter Ping ist voreingestellt), zwei dezente Benachrichtigungstöne (Dezenter Ping, Neue Nachricht) sowie ICQ, iPhone, Minecraft Huhn 1, Minecraft Huhn 2 und WhatsApp.

> Direkt nach der Installation bzw. dem ersten Aktivieren merkt sich das Addon nur den aktuellen Stand der gesperrten Tickets. Für bereits vorher gesperrte Tickets wird noch kein Ton abgespielt, erst für neu hinzukommende.

## EB Helper

Der **EB Helper** unterstützt beim Erstellen von Empfangsbestätigungen aus passenden Hardware-Tickets.

In geeigneten Tickets erscheint ein Button **Empfangsbestätigung erstellen**. Das Addon versucht, relevante Hardwareinformationen aus dem Ticket zu erkennen und an die lokale EB-Seite zu übergeben:

`https://digi-eb.staff.hsrw/new`

Erkannt werden z. B.:

- Gerätebezeichnungen
- Inventarnummern
- Seriennummern
- einfache Hardwarelisten

Falls der Text nicht automatisch erkannt wird, kann ein Hardwaretext manuell eingefügt werden.

Die endgültige Prüfung und Korrektur der Gerätezeilen erfolgt auf der EB-Seite.

## Fehlermeldungen und Verbesserungsvorschläge

Das Addon hat bewusst **keinen öffentlichen Meldeweg** im Popup: Da es über die Store-Direktlinks von überall installiert werden kann, würde ein offen sichtbarer Bug-Link (z. B. eine interne Mailadresse) auch Meldungen von außerhalb der Hochschule anziehen. Rückmeldungen laufen daher über die üblichen internen Wege.

Für eine hilfreiche Fehlermeldung bitte notieren:

- verwendeter Browser
- betroffene Znuny-Seite
- Ticketnummer, falls sinnvoll
- was erwartet wurde
- was tatsächlich passiert ist

## Datenschutz und Speicherung

Das Addon speichert bestimmte Informationen lokal im Browser:

- aktivierte/deaktivierte Funktionen
- lokale Ticketkategorien
- lokale Ticketnotizen
- Suchhistorie
- Liste der zuletzt bekannten gesperrten Ticketnummern (für "Ton bei neuem Ticket")
- ausgewählter bzw. selbst hochgeladener Benachrichtigungston

Diese Informationen werden nicht automatisch in Znuny geschrieben und nicht automatisch an andere Personen übertragen.

Ausnahme: Beim EB Helper werden erkannte Hardwaredaten an die lokale EB-Seite übergeben, wenn die Empfangsbestätigung erstellt wird.

## Grenzen und bekannte Hinweise

- Das Addon verändert die Znuny-Oberfläche im Browser, nicht das Znuny-System selbst.
- Lokale Kategorien und Notizen sind nur im jeweiligen Browserprofil verfügbar.
- Nach Addon-Updates sollte die Erweiterung neu geladen und die Znuny-Seite aktualisiert werden.
- Wenn Znuny seine HTML-Struktur ändert, können einzelne Funktionen Anpassungen benötigen.
- Manuell geladene Firefox-Erweiterungen sind nur temporär aktiv (siehe Installation); für Dauerbetrieb wird die Store-Version benötigt.
- "Ton bei neuem Ticket" funktioniert nur, solange ein Znuny-Tab in einem Browser mit installierter Erweiterung geöffnet ist; bei komplett geschlossenem Browser gibt es keine Benachrichtigung.

## Deaktivieren einzelner Funktionen

Alle Hauptfunktionen können im Addon-Popup einzeln ein- oder ausgeschaltet werden.

Empfehlung bei Problemen:

1. Betroffene Funktion im Popup deaktivieren.
2. Znuny-Seite neu laden.
3. Prüfen, ob das Problem weiterhin besteht.
4. Problem intern melden.

## Entwicklung

### Projektstruktur

```
znuny-helper-extension/          Chrome-/Edge-Version
znuny-helper-extension-firefox/  Firefox-Version (inhaltlich identisch)
  manifest.json                  Manifest (Version, Berechtigungen, Content-Scripts)
  src/content.js                 Hauptlogik (isoliert)
  src/page-bridge.js             Brücke in den MAIN-World-Kontext
  src/background.js              Hintergrundprozess (Tab-Handling)
  popup/                         Einstellungs-Popup
  welcome/                       Willkommens-/Changelog-Seite
  vendor/                        Mammoth.js (DOCX), SheetJS (Tabellen)
  sounds/                        Ausgelieferte Benachrichtigungstöne
  README.md                      Kurzinfo je Paket
CHANGELOG.md                     Versionshistorie
NETWIKI-Znuny-Helper.md          Ausführliche Dokumentation
NETWIKI-Znuny-Helper-dokuwiki.txt  Dieselbe Doku im DokuWiki-Format
audio/                           Rohe Sound-Quelldateien
```

Die beiden Erweiterungsordner sind bis auf `manifest.json` und `README-FIREFOX.md` byte-identisch. Änderungen werden im Chrome-/Edge-Ordner vorgenommen und anschließend in den Firefox-Ordner kopiert.

### Firefox-Version synchron halten

```bash
for f in src/content.js src/page-bridge.js popup/popup.html popup/popup.js popup/popup.css welcome/welcome.html welcome/welcome.js; do
  cp "znuny-helper-extension/$f" "znuny-helper-extension-firefox/$f"
done
```

### Release-Zips bauen

Die Store-Pakete werden mit `manifest.json` direkt im Archiv-Root und mit `/`-Pfadtrennern gebaut. Beispiel (Python 3):

```python
import os, zipfile

def build(folder, out):
    files = []
    for root, dirs, names in os.walk(folder):
        dirs.sort()
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, folder).replace(os.sep, "/")
            files.append((rel, full))
    files.sort()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for rel, full in files:
            z.write(full, rel)

build("znuny-helper-extension", "znuny-helper-extension.zip")
build("znuny-helper-extension-firefox", "znuny-helper-extension-firefox.zip")
```

### Version aktualisieren

Bei einem Release anzupassen:

- `znuny-helper-extension/manifest.json` (Feld `version`)
- `znuny-helper-extension-firefox/manifest.json` (Feld `version`)
- `CHANGELOG.md` (neuer Abschnitt)
- `znuny-helper-extension/welcome/welcome.js` (Changelog-Array)
- `NETWIKI-Znuny-Helper.md` und `NETWIKI-Znuny-Helper-dokuwiki.txt` (Versionszeile und Funktionen)

## Dokumentation

- [CHANGELOG.md](CHANGELOG.md) – Versionshistorie
- [NETWIKI-Znuny-Helper.md](NETWIKI-Znuny-Helper.md) – vollständige Dokumentation
- [NETWIKI-Znuny-Helper-dokuwiki.txt](NETWIKI-Znuny-Helper-dokuwiki.txt) – dieselbe Doku im DokuWiki-Format

## Zuständigkeit und Pflege

Das Addon ist als Arbeitserleichterung für das Znuny-Ticketsystem gedacht. Fehler, Verbesserungsvorschläge und neue Funktionsideen können intern gemeldet werden.

Vor größeren Änderungen sollte geprüft werden, ob die Änderung für mehrere Nutzerinnen und Nutzer sinnvoll ist und ob sie die normale Znuny-Bedienung nicht beeinträchtigt.

## Belohnung fürs Bis-hierhin-Lesen

Wer die Doku tatsächlich komplett durchgelesen hat, verdient eine kleine Belohnung: Im Znuny halte die Maus für 3 Sekunden über das eigene Profilsymbol oben links (die Kreis-Initialen), ohne zu klicken – dort versteckt sich **Logo Pong**, ein kleines Minispiel mit dem HSRW-Logo als Schläger. Viel Spaß!
