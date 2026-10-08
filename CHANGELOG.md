# Changelog

Alle nennenswerten Änderungen am Znuny Helper werden hier festgehalten. Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.0.0/).

## [1.6.0] – 2026-10-02

### Added
- **Schnellantwort-Fenster frei anpassbar und gemerkt:** Das Fenster lässt sich am Kopfbereich mit der Maus verschieben und **an allen vier Rändern und Ecken** in der Größe ändern; ein Doppelklick auf den Kopfbereich schaltet zwischen gemerkter Größe und Vollbild um. Größe und Position werden gespeichert und beim nächsten Öffnen wiederhergestellt; **Ansicht zurücksetzen** stellt die Standardansicht wieder her. **Esc** schließt das Fenster (nicht, während gerade in einem Textfeld getippt wird).
- **Fenster minimieren statt schließen:** Über **–** im Kopfbereich bleibt das Fenster als schmale Leiste stehen; der eingebettete Formularinhalt bleibt dabei vollständig erhalten und lässt sich mit demselben Knopf wieder öffnen.
- **Antwort-Entwürfe überleben das Schließen:** Eine angefangene Antwort geht beim Schließen nicht mehr verloren. Der Text wird als Entwurf gespeichert und beim nächsten Öffnen derselben Aktion für dasselbe Ticket wieder eingesetzt – mit Hinweis „Entwurf wiederhergestellt (Uhrzeit)" und dem Knopf **Entwurf verwerfen**. Nach dem Übermitteln und bei Znunys **Abbrechen und Schließen** wird der Entwurf gelöscht. Gespeichert wird reiner Text (ohne Formatierung), maximal zehn Entwürfe, die ältesten fallen heraus.
- **Antworten/Weiterleiten ohne Vorlagenklick:** Znuny verlangt für „Antworten" und „Weiterleiten" je Artikel die Auswahl einer Vorlage, auch wenn es nur eine gibt („leere Antwort" bzw. „Weiterleitung") – man musste erst in das leere Suchfeld klicken und dann den einzigen Eintrag wählen. Gibt es genau **eine** Vorlage, wird sie jetzt vorausgewählt und das leere Suchfeld ausgeblendet; ein Klick auf die Aktion genügt. Die Aktion läuft dabei weiterhin über Znunys eigene Popup-Schicht, sodass **Popups als Tabs**, die **Schnellantwort** und echte Znuny-Popups unverändert funktionieren. Bei mehreren Vorlagen ändert das Addon nichts (abschaltbar im Popup unter „Im geöffneten Ticket").
- **Weiterleiten in der Schnellantwort:** „Weiterleiten" öffnet bei aktivierter Schnellantwort ebenfalls als eingebettetes Fenster direkt über dem Ticket (Überschrift „Weiterleiten") – mit Prioritäts-Vorlagen, Warten-Schnellauswahl und Strg+Enter wie auf der normalen Seite.
- **Oranger Hover-Balken in der Artikelleiste:** Znuny zeigt beim Überfahren der Artikel-Aktionen („Teilen", „Weiterleiten", …) eine orange Leiste unter dem Text. Die sichtbare Beschriftung von „Antworten" und „Weiterleiten" ist technisch keine Verlinkung des Artikels, sondern das Etikett des früheren Vorlagen-Suchfelds, und bekam diesen Balken deshalb nicht. Er wird jetzt für genau diese beiden Beschriftungen ergänzt – im selben Orange (`#ff9900`), als Pseudoelement ohne Layoutverschiebung und auch bei Tastaturfokus. Beim Abschalten von „Antworten/Weiterleiten ohne Vorlagenklick" verschwindet die Markierung wieder.
- **Suchverlauf in der globalen Suche:** Unter den Suchfeldern steht jetzt ein Block **Suchverlauf** mit den zuletzt ausgeführten Suchen – neueste zuerst, bis zu acht sichtbar von maximal fünfzehn gemerkten. Jeder Eintrag zeigt Suchbegriff, Ticketnummer, den verwendeten Zeitraum (z. B. „Letzter Monat") und die Uhrzeit („gerade eben", „vor 5 Min.", „gestern 16:40", sonst Datum und Uhrzeit). Ein Klick übernimmt Suchbegriff, Ticketnummer **und** den damaligen Zeitraum zurück in die Felder; **×** entfernt einen Eintrag, **Verlauf leeren** die ganze Liste. Der Zeitraum wird nur mitgespeichert, wenn er wirklich gesetzt wurde, damit die Standardwerte der Datums-Dropdowns nicht in jedem Eintrag auftauchen. Bisher gab es nur kleine Vorschlags-Knöpfe unter den einzelnen Feldern (die weiterhin bestehen, ohne Zeitraum und ohne Zeitangabe); eine Historie aus einer älteren Version wird automatisch übernommen.
- **Standard-Wartezeit einstellbar:** Im Popup unter „Antworten und Warten" lässt sich jetzt getrennt festlegen, welche Wartezeit beim Erscheinen eines Wartedatums automatisch vorbelegt wird (bisher war das fest der erste Wert der Schnellknöpfe). Voreinstellung: **7 Tage**; der zugehörige Schnellknopf trägt den Zusatz „(Standard)".

### Changed
- **Suchverlauf kompakter:** In den Einträgen steht nur noch der Suchbegriff bzw. die Ticketnummer (kein „Volltext …"-Vorsatz mehr). Sichtbar sind die letzten **fünf** Suchen; über **Alle n anzeigen** klappt die Liste auf bis zu fünfzehn Einträge auf (**Weniger anzeigen** schließt sie wieder). Mehr als fünfzehn werden weiterhin nicht gespeichert.
- **Standard-Wartezeit ist jetzt 7 Tage** (vorher 3) – im Popup änderbar; der zugehörige Schnellknopf ist mit „(Standard)" gekennzeichnet.
- **„Suchverlauf" sitzt auf der Feldspalte:** Überschrift, Einträge und der Hinweis für den leeren Verlauf stehen jetzt in derselben Spalte wie die Suchfelder und die Überschrift „Suchen" – vorher war die Überschrift deutlich weiter links als die übrigen Abschnitte.
- **Zeitraum-Schnellknöpfe in einer Reihe:** Die Knöpfe für den Suchzeitraum („Letzte Woche", „Letzter Monat", „Letztes Quartal") passen jetzt in eine Zeile, statt untereinander umzubrechen. Der Knopf **Letztes Jahr** ist entfallen; der automatische Standardzeitraum (letztes Jahr bis heute) bleibt unverändert bestehen.
- **Popup aufgeräumt:** Die Einstellungen liegen jetzt in abgerundeten Karten je Bereich statt in einer langen Liste einzelner Kästen. Zusammengehörige Optionen bilden eine Einheit: Die **Warten-Schnellauswahl** enthält direkt darunter ihre beiden Felder (Tage der Schnellknöpfe, Standard-Wartezeit) und wird bei ausgeschaltetem Schalter gedimmt und gesperrt. Neu sind außerdem die Versionsanzeige im Kopf des Popups und Beispielwerte als kleine Chips in den Hinweistexten.
- **Einstellungen wirken ohne Neuladen:** Änderungen im Popup werden auf bereits geöffneten Znuny-Seiten sofort angewendet – die Standard-Wartezeit eingeschlossen. Nur ein Tab, der schon vor der Installation der Erweiterung geöffnet war, muss einmal neu geladen werden; das Popup weist darauf hin.
- **Tab-Schließen nach dem Übermitteln nur noch für Aktions-Tabs:** Bisher genügte ein gesetztes `window.opener` – das ist aber auch bei gewöhnlichen `target="_blank"`-Links der Fall. Jetzt markiert das Addon die Tabs, die es selbst für eine Aktionsseite öffnet (eindeutiger Fenstername), und **nur diese** schließen sich nach erfolgreichem Übermitteln. Das Ticket selbst, von Hand geöffnete Tabs und die **Schnellantwort** – bei der die Aktion eingebettet im Ticket läuft – bleiben immer offen.
- **Vorlagen-Editor speichert sofort:** Änderungen an Vorlagen (Farbe, Titel, Felder, Gruppe, Reihenfolge, Löschen) und **Standard wiederherstellen** werden unmittelbar gespeichert. Das Schließen über das × oder den Hintergrund verwirft nichts mehr – vorher gingen alle Bearbeitungen verloren, wenn nicht ausdrücklich „Speichern" gedrückt wurde. Für die Kategorienverwaltung gilt dasselbe (Feldänderungen, Anlegen, Löschen, Sortieren, Zurücksetzen).
- **Warten-Schnellauswahl überschreibt kein gewähltes Datum mehr:** Der Standardwert wird nur gesetzt, solange die Datumsfelder unverändert sind.
- **Strg+Enter** bevorzugt das Formular, in dem gerade gearbeitet wird, statt des ersten sichtbaren „Übermitteln"-Knopfes der Seite.
- **Sternchen-Erkennung in Ticketlisten präzisiert:** Eine Spalte, die nur das Wort „priority" enthält, markiert keine Zeilen mehr als wichtig.
- **Suchhistorie liegt jetzt im Addon-Speicher** statt im `localStorage` der Znuny-Seite (dort war sie für Seitenskripte lesbar und ging beim Löschen der Websitedaten verloren). Eine vorhandene Historie wird beim ersten Laden einmalig übernommen.
- **Doppelte Logik entfernt:** Die „Suchergebnisse im neuen Tab"-Behandlung existiert nur noch einmal (in `page-bridge.js`); der wirkungslose `alert`-Patch im Content-Script ist entfallen. Eine über Znunys Validierung ausgelöste Ticketnummer-Suche landet jetzt ebenfalls in der Suchhistorie.
- Der Standardwert für **Suchergebnisse in neuem Tab** ist im Seiten-Bridge jetzt ebenfalls `false` (er war dort fälschlich `true`).

### Fixed
- **Firefox: „Antworten/Weiterleiten ohne Vorlagenklick" tat gar nichts:** Der Auftrag an die Seitenbrücke enthielt das Ziel als Objekt in `detail`. Firefox-Content-Scripts laufen in einer eigenen Welt, in der die Seite ein solches Objekt nicht lesen kann – die Adresse kam leer an, der Klick war aber schon abgefangen, also passierte schlicht nichts. Die Adresse wird jetzt zusätzlich als Zeichenkette und als DOM-Attribut übergeben, und schlägt Znunys Popup-Schicht fehl, öffnet das Addon die Aktion direkt (`window.open`), statt den Klick wirkungslos zu verpuffen. Dieselbe Absicherung gilt für die Einstellungs-Übergabe an die Seitenbrücke.
- **Firefox: Entwurfstext wurde zusammengepresst:** Firefox-Editoren liefern Zeilenumbrüche als `\r\n`. Das überflüssige `\r` ließ den Editor die Zeilen beim Wiedereinsetzen zusammenziehen. Zeilenenden werden jetzt für jeden Entwurf normalisiert, und ein Entwurf wird als echte Absätze (`<p>`, innerhalb eines Absatzes `<br>`) zurückgegeben statt als lose Textknoten mit `<br>` – so bleibt die Struktur erhalten und der Editor formatiert nichts um. Beim Speichern wird außerdem der erste **nicht leere** Editorinhalt gelesen: vorher konnte ein leerer Editorbereich den echten Text verdecken.
- **Der Suchverlauf blieb in anderen Fenstern leer:** Der Suchdialog öffnet auf dieser Znuny-Version ein **eigenes Fenster**. Ergänzt wurde der Verlauf nur in dem Dokument, in dem gesucht wurde – das Fenster mit der Anzeige blieb auf seinem alten Stand (und sah deshalb aus, als würde gar nichts gespeichert). Jedes Znuny-Fenster folgt jetzt den Speicheränderungen und aktualisiert seine Liste. Zusätzlich wird eine Suche auch **ohne Klick** erkannt: Eine Suchseite wird nur durch eine ausgeführte Suche erreicht, und die dort vorbelegten Werte werden übernommen; der automatische Standardzeitraum bleibt dabei außen vor. Die Erkennung hängt jetzt an `window` **und** `document`, an mehreren Mausereignissen und an Enter im Suchfeld, und sie wird verdrahtet, bevor das Formular kosmetisch umgebaut wird – ein Fehler dort kann die Aufzeichnung nicht mehr verhindern.
- **Der Suchverlauf speicherte nichts:** Gemerkt wurde nur am `submit`-Ereignis des Suchformulars – Znunys Suchdialog löst dieses Ereignis nicht aus, also blieb der Verlauf leer. Jetzt wird die Suche schon beim Klick auf **Suche starten** festgehalten, unabhängig davon, wie Znuny danach navigiert. Mehrfach ausgelöste Klick-Ereignisse (`pointerdown`, `mousedown`, `click`) zählen nur einmal, und wird direkt nach dem Seitenaufbau gesucht, liest das Addon den gespeicherten Verlauf zuerst, statt ihn zu überschreiben. Jede gemerkte Suche wird in der Browser-Konsole protokolliert.
- **Antwort-Entwürfe wurden nicht gespeichert:** Gelesen wurde zuerst das versteckte Editor-Textfeld, das CKEditor erst beim Absenden aktualisiert – dadurch war der Entwurf fast immer leer. Jetzt ist der sichtbare Editor maßgeblich. Zusätzlich wird der Entwurf auch beim Schließen des Tabs gesichert, und die Browser-Konsole protokolliert, ob und warum ein Entwurf gespeichert oder wiederhergestellt wurde.
- **Entwürfe enthielten Editor-Quelltext:** Wurde ein Entwurf von einer früheren Version (oder aus der Quellcode-Ansicht des Editors) gespeichert, landeten `<br />`, `<p>` und `&nbsp;` als sichtbarer Text in der Antwort. Solche Inhalte werden jetzt beim Speichern **und** beim Wiederherstellen in lesbaren Text umgewandelt (Zeilenumbrüche bleiben erhalten); bereits gespeicherte Entwürfe werden dabei repariert.
- **Antwort-Tab schließt sich nach dem Übermitteln zuverlässig:** Die Markierung hing allein an `window.name`, das Znuny auf Popup-Seiten selbst benutzt. Der Tab wird jetzt zusätzlich über ein URL-Fragment markiert (das er sich merkt), an der Herkunft erkannt (die zuvor in diesem Tab geladene Aktionsseite) und meldet sich beim Übermitteln dem Hintergrundprozess. Der schließt ihn, sobald Znuny die Aktionsseite verlassen hat, und lädt danach den Ursprungstab neu. Doppelte Anfragen werden zusammengefasst, damit der Ursprungstab nur einmal neu lädt.
- **Geänderte Standard-Wartezeit wirkt sofort:** Eine im Popup geänderte Wartezeit wird auf bereits geöffneten Warten-Seiten direkt gesetzt, ohne dass die Seite neu geladen werden muss.
- **Anhang-Vorschau gibt ihren Speicher wieder frei:** Die Blob-URL der Vorschau wird beim Schließen freigegeben (vorher blieb die komplette Datei bis zum Seitenwechsel im Speicher), und der Ladehinweis bleibt nicht mehr neben einer Fehlermeldung stehen.
- **Artikel-Suche:** Findet sich ein Suchbegriff nur im geöffneten Artikel und in keiner Zeile der Artikelübersicht, wird er dort jetzt markiert und angesprungen, statt nur die Statuszeile zu aktualisieren.
- **EB Helper** öffnet die EB-Seite mit `noopener`, sodass sie nicht auf das Ticketfenster zugreifen kann; der Knopf heißt korrekt „Empfangsbestätigung erstellen".
- **Fehler beim Start** werden als Fehler protokolliert statt nur als Warnung.
- Kleinere Korrekturen: Die Beispiel-Ticketnummer im Suchfilter wird generisch erkannt (statt fest verdrahtet), und sichtbare Beschriftungen nutzen wieder Umlaute („Schließen", „Kategorie hinzufügen", „Hardwaretext einfügen").

## [1.5.2] – 2026-10-02

### Added
- **Versionsanzeige in der Browser-Konsole:** Beim Laden schreibt das Addon `Znuny Helper <Version> aktiv` samt Angabe, ob die aktuelle Seite als Ticketliste behandelt wird (`ticketliste: true/false`). Das macht bei einer Meldung sofort prüfbar, welcher Stand läuft und wie die Seite eingestuft wird – sichtbar nur bei geöffneten Entwicklerwerkzeugen.
- **Schnellantwort deckt jetzt auch die Priorisierung ab:** „Priorisierung" (Znuny-Aktion `AgentTicketPriority`) öffnet bei aktivierter Schnellantwort als eingebettetes Fenster direkt über dem Ticket und trägt die Überschrift „Priorisierung". Es ist dieselbe Aktionsseite, die auch die Prioritäts-Vorlagen verwenden, daher funktionieren Vorlagen und Warten-Schnellauswahl dort wie auf der normalen Seite. Damit sind „Antworten", „Allen antworten", „Besitzer", „Priorisierung", „Notiz", „Schließen", „Verknüpfen" und „Zusammenfassen" abgedeckt.

### Fixed
- **Infinite Scroll lief auf Ticketseiten und schrieb fremde Zeilen in Widget-Tabellen:** Die Prüfung „ist das eine Ticketliste?" war rein inhaltlich (`Boolean(findTicketTable())`) und hielt auf einer geöffneten Ticketseite auch die **Artikelübersicht** und das Widget **„Verknüpft"** für eine Ticketliste. Dadurch konnte das Nachladen Zeilen aus einem anderen Zusammenhang in diese Tabellen einfügen – sichtbar als einzelne fremde Nummer im Artikelbereich und als Eintrag im Widget „Verknüpft", der auf das Ticket selbst verweist. Die Prüfung ist jetzt **aktionsbasiert** (nur echte Listenansichten: Queue-, Sperr-, Besitzer-, Verantwortlicher-, Beobachter-, Status- und Suchansicht). Zusätzlich werden Widget-Tabellen strukturell ausgeschlossen (Artikelübersicht, „Verknüpft", Ticket-/Kundeninformation, Ähnliche Tickets, Historie, Anhang, Sidebar), und eine Tabelle muss mindestens zwei Zeilen haben, um als Liste zu gelten.
- **Beim Nachladen wird jetzt geprüft, dass es wirklich dieselbe Liste ist:** Der Abruf ist auf Ticketlisten-Aktionen beschränkt, Pager-Links außerhalb eines echten Seitenzahl-Bereichs müssen dieselbe Aktion und einen echten Seiten-/Offset-Parameter (`Page=`/`StartHit=`) tragen, und die geladene Seite muss dieselbe Spaltensignatur sowie dieselbe Zellenzahl wie die angezeigte Liste haben. Zeilen mit abweichender Spaltenzahl werden übersprungen. Fremde Inhalte können damit nicht mehr in eine bestehende Tabelle gelangen.
- **„Ton bei neuem Ticket" aktualisierte auch geöffnete Tickets:** Weil die Listen-Erkennung auch auf Ticketseiten zuschlug, ersetzte die automatische Aktualisierung dort den Inhalt der gefundenen Tabelle, obwohl laut Dokumentation nur Übersichtsseiten aktualisiert werden und ein geöffnetes Ticket unangetastet bleibt. Die Aktualisierung nutzt jetzt dieselbe aktionsbasierte Seitenkennung und vergleicht zusätzlich die Spaltensignatur von angezeigter und geladener Tabelle, bevor sie Zeilen ersetzt.
- **Infinite Scroll blieb nach Aus- und wieder Einschalten hängen:** Beim Abschalten blieben der Zustand „fertig" und die gemerkte URL erhalten, sodass ein erneutes Einschalten ohne Neuladen der Seite nichts mehr nachlud. Der komplette Ladezustand wird jetzt beim Abschalten zurückgesetzt.

## [1.5.1] – 2026-09-17

### Added
- **Prioritäts-Vorlagen mit Priorität und Auswirkung:** Zusätzlich zu Typ, Queue, Service, Besitzer, Kategorie, Betreff und Text lassen sich je Vorlage jetzt auch **Priorität** und **Auswirkung** vorgeben. Beim Anlegen einer Vorlage aus dem aktuellen Formular werden beide Felder mit übernommen. Die Priorität wird nach der Auswirkung gesetzt, damit sie bei Setups mit automatischer Prioritätsberechnung gewinnt.
- **Dropdowns im Vorlagen-Editor:** Typ, Service, Priorität und Auswirkung sind jetzt Auswahlfelder statt Freitext. Typ: Incident, Problem, ServiceRequest, Unclassified. Service: Gruppen, Person, Standort/Organisation. Priorität: high, critical, low, normal. Auswirkung: Arbeit eingeschränkt, Arbeit uneingeschränkt, Arbeit unmöglich. Bereits vorhandene, abweichende Werte bleiben erhalten und auswählbar.

### Changed
- **Prioritäts-Vorlagen sind jetzt standardmäßig aktiv.** Wer sie nicht möchte, schaltet sie im Popup unter „Vorlagen und ServiceDesk" ab.
- **Infinite Scroll lässt die Seitenzahlen wieder sichtbar** (kein Ausblenden mehr) und lädt beim Scrollen weiter zusätzliche Seiten nach. So bleibt die normale Paginierung als zuverlässiger Fallback nutzbar.

### Fixed
- **DOCX- und XLSX-Vorschau in Firefox:** Beide Vorschauen brachen ab – DOCX mit „Can't read the data of 'the loaded zip file'", XLSX mit „Permission denied to access property 'constructor'". Ursache: In Firefox-Content-Scripts stammt der `ArrayBuffer` aus `blob.arrayBuffer()` aus der Seiten-Realm; JSZip (in Mammoth) scheitert dann an seiner `instanceof`-Prüfung und SheetJS beim Zugriff auf `constructor`. Die Bytes werden jetzt realm-sicher über einen Content-Script-`FileReader` gelesen (Fallback: Kopie in einen frisch angelegten `ArrayBuffer`); bei DOCX wird notfalls das Blob selbst übergeben.
- **Infinite Scroll lud nach der zweiten Seite nicht weiter bzw. übersprang Seiten:** Die Folgeseite wurde aus dem Pager der geladenen Seite abgeleitet; schlug das fehl (oder wurde „Seite: 1 2 3 4 5" ab Seite 1 fehlinterpretiert), stoppte oder sprang der Ladevorgang. Jetzt wird ab der ersten Seite **fortlaufend über die `Page`-Nummer der zuletzt geladenen Seite** geblättert; ein Pager-Link wird nur genutzt, wenn er exakt auf diese nächste Seite zeigt. Gestoppt wird erst, wenn eine Seite keine neuen Tickets mehr enthält (Ende erreicht).
- **Infinite Scroll unterstützt jetzt auch `StartHit`-Paginierung (Queue-Ansicht):** Die Queue-Ansicht paginiert nicht über `Page`, sondern über einen Offset (`…;StartHit=36`, `…;StartHit=71`, Schrittweite = Seitengröße, z. B. 35). Beim Folgen der echten Pager-Links wird die Seite jetzt logisch mitgezählt statt aus der URL gelesen; fehlen die Links (JavaScript-Pager), wird `StartHit` anhand der erkannten Schrittweite selbst weitergezählt. Getestet bis 700 Tickets / 20 Seiten und suchübergreifend bis 2000 Treffer.
- **Infinite Scroll auf der Suchseite:** Die Ergebnis-Tabelle hat teils andere Spaltennamen (z. B. „Ticket"/„Betreff"/„Von"), wodurch keine Zeilen angehängt wurden. Die Tabellenerkennung läuft jetzt zusätzlich **strukturell über die Ticket-Links** (unabhängig von den Spaltennamen), die Ticketnummer wird notfalls aus dem `AgentTicketZoom`-Link gelesen, und die Folgeseite wird bevorzugt aus dem echten Pager-Link übernommen (auch bei JavaScript-Pagern über `onclick`). Ein Abruf bricht nach 20 s ab (kein dauerhaftes „wird geladen…").
- **Infinite Scroll hängte in manchen Ansichten endlos Tickets an:** Es wurden auch Zeilen ohne erkennbare Ticketnummer angehängt; da solche Zeilen nicht zuverlässig dedupliziert werden können (u. a. weil die Kategorie-Markierung den Zeilentext verändert), wiederholten sich die Einträge. Jetzt werden **nur Zeilen mit eindeutiger Ticket-ID** angehängt, bereits geladene IDs werden sitzungsweit gemerkt, identische Seiten werden anhand eines Fingerabdrucks und der Seitenzahl erkannt, und es gibt harte Limits (max. 800 Seiten / 20 000 Zeilen). Eine Endlosschleife ist damit ausgeschlossen.
- **Neuer Tab nach dem Absenden wird geschlossen:** Das automatische Schließen griff nur beim Klick auf „Übermitteln" und nur wenn „Popups als Tabs" aktiv war – bei Enter/Strg+Enter blieb der Tab offen. Jetzt wird zusätzlich auf das Formular-`submit` gelauscht, und es greift für alle Aktionsseiten (Antworten, Besitzer, Notiz, Schließen, Telefon-Ticket …), die in einem eigenen Tab geöffnet wurden (`window.opener`). Bei einem Validierungsfehler (weiterhin auf der Aktionsseite) wird **nicht** geschlossen; nach erfolgreichem Absenden kehrt der Fokus zum vorherigen Tab zurück.

## [1.5.0] – 2026-09-14

### Added
- **Warten-Schnellauswahl konfigurierbar:** Die Tage der Schnellknöpfe (bisher fest +3/+7/+14) lassen sich im Popup unter „Antworten und Warten → Tage der Schnellknöpfe" frei einstellen (kommagetrennt, z. B. `1, 3, 7, 14`, maximal acht Werte). Der erste Wert wird beim Erscheinen des Datumsfelds automatisch gesetzt; die Knöpfe werden bei geänderter Einstellung sofort neu aufgebaut.
- **Zwei zusätzliche Benachrichtigungstöne:** Für „Ton bei neuem Ticket" stehen jetzt zwei weitere Sounds zur Auswahl – **Dezenter Ping** und **Neue Nachricht**. Damit sind zehn Sounds eingebaut (drei dezente Standardtöne, die zwei neuen Benachrichtigungstöne sowie ICQ, iPhone, Minecraft Huhn 1, Minecraft Huhn 2 und WhatsApp).

### Changed
- **Popup übersichtlicher und verständlicher:** Die Funktionsbeschreibungen wurden überarbeitet und die Optionen in klarer benannte Gruppen sortiert (Im geöffneten Ticket, Antworten und Warten, Navigation und Listen, Suche, Ticketlisten, Vorlagen und ServiceDesk, Bedienung, Benachrichtigung).
- **Infinite Scroll blendet die Seitenzahlen aus:** Solange Infinite Scroll aktiv ist, werden die überflüssigen Seitenzahlen oben rechts in der Ticketliste ausgeblendet (rein per CSS, die Paginierung bleibt im DOM erhalten); beim Abschalten erscheinen sie wieder.

### Removed
- **Anhang-Erinnerung entfernt:** Der Hinweis „Anhang vergessen?" auf der Antwortseite wurde samt zugehöriger Einstellung und Code entfernt.

## [1.4.0] – 2026-09-14

### Added
- **Case-/Ticketnummer kopieren:** Im geöffneten Ticket (AgentTicketZoom) wird die Nummer oben links in der Überschrift jetzt anklickbar. Ein Klick kopiert die Nummer in die Zwischenablage und bestätigt kurz grün mit „Kopiert!". Die Funktion ist im Popup unter „Suchen" abschaltbar (Standard: an). Erkannt wird die erste Ziffernfolge der Überschrift, sodass sowohl die reine Ticketnummer als auch eine „Case …"-Schreibweise erfasst wird.

## [1.3.2] – 2026-09-14

### Fixed
- **Excel-/Tabellen-Vorschau in Firefox:** Die Vorschau brach mit „Vorschau konnte nicht geladen werden: e.replace is not a function" ab. Ursache: In Firefox-Content-Scripts kann das `ArrayBuffer` aus `blob.arrayBuffer()` aus einer anderen Herkunft (Realm) stammen, wodurch die interne Typprüfung von SheetJS fehlschlug und die Bytes fälschlich als Base64-String verarbeitet wurden. Die Bytes werden jetzt als `Uint8Array` mit explizitem `type: "array"` übergeben.
- **„Abbrechen und Schließen" in per „Popups als Tabs" geöffneten Aktionen war ohne Funktion:** Znuny bindet diesen Knopf nur, wenn das Fenster als echtes Znuny-Popup erkannt wird (Fenstername `OTRSPopup_…`); in einem normalen Tab blieb er daher wirkungslos. Das Addon bindet den Knopf in solchen Aktions-Tabs jetzt selbst und schließt den Tab. In der Schnellantwort schließt derselbe Knopf nun das eingebettete Fenster, statt nichts zu tun.
- **Schnellantwort: automatische Warten-Vorbelegung (+3 Tage) griff nicht zuverlässig:** Das eingebettete Formular wird jetzt – wie die normale Ticketseite – während der offenen Aktion periodisch geprüft, nicht mehr nur beim Laden und bei Änderungen. Dadurch werden spät nachgeladene Datumsfelder (z. B. in der Schließen-Aktion) erfasst und mit +3 Tagen vorbelegt.
- **Kein Scroll-Sprung beim Anwenden einer Vorlage:** Beim Setzen der Felder wird kein Feld mehr fokussiert (das zog die Seite nach unten zum Textfeld), und die Scroll-Position wird nach dem Znuny-Nachladen der abhängigen Felder wiederhergestellt – es sei denn, man scrollt selbst.
- **„Artikel hinzufügen" ist jetzt standardmäßig aufgeklappt:** Das Artikel-Widget wird auf allen Aktionsseiten (inkl. Schnellantwort) beim Laden automatisch aufgeklappt und das „Artikel anlegen"-Häkchen gesetzt.
- **Überlappung von Feldern mit der Vorlagen-Leiste behoben:** In der zweispaltigen Ansicht (Priorität/Besitzer/Schnellantwort) wird die Feldspalte jetzt begrenzt und horizontal beschnitten, sodass breite Felder wie „Neuer Besitzer" nicht mehr unter die Vorlagen-Leiste laufen.

### Changed
- **Prioritäts-/Personen-Vorlagen: Gruppen, Drag & Drop, stabile Oberfläche:** Jede Vorlage hat jetzt eine optionale „Gruppe". Die Schnellbuttons sind nach Gruppen sortiert (Reihenfolge frei anpassbar, „Ohne Gruppe" zuletzt) und als klar getrennte Abschnitte mit eigener Überschrift dargestellt; „Bearbeiten" und „Als Vorlage speichern" liegen in eigenen Bereichen. Die Leiste sitzt in allen Kontexten – normale Prioritäts-/Besitzer-Seite **und** Schnellantwort – rechts im „Ticket-Einstellungen"-Bereich als echte zweite Spalte (CSS-Grid), ohne die Felder zu überlagern oder nach unten zu drücken. Die Leiste wird nur noch bei echten Vorlagen-Änderungen neu aufgebaut statt bei jedem Seiten-Scan; beim Anwenden einer Vorlage wird die Scroll-Position gehalten. Außerdem werden die Felder nach dem Znuny-Nachladen der abhängigen Felder erneut gesetzt, sodass auch freie Felder (Betreff/Text) schon beim ersten Klick gefüllt werden. Der Bearbeiten-Dialog wurde überarbeitet: kleine Kacheln je Vorlage, nach Gruppen sortiert (mit Überschrift und Anzahl), Filterfeld, ausklappbare Feldbearbeitung, **Drag & Drop** zum Sortieren von Vorlagen (innerhalb/zwischen Gruppen) und Gruppen, ein echtes Gruppen-Auswahlfeld inkl. „Neue Gruppe…" sowie Entfernen direkt an der Kachel.
- **Kategorien-Bearbeitungsseite kompakter:** Jede Kategorie belegt nur noch eine Zeile mit den Kurzfeldern und einer automatisch mitwachsenden Keyword-Box; die separate Kopfzeile entfällt.
- **Kein öffentlicher Bug-Melde-Link mehr:** Der Link „Bug/Vorschlag melden" wurde aus dem Popup und der Willkommensseite entfernt, da das Addon über die Store-Direktlinks weltweit installierbar ist und eine interne Support-Adresse sonst öffentlich erreichbar wäre.

## [1.3.1] – 2026-09-07

### Fixed
- **Prioritäts-Vorlagen und Warten-Schnellauswahl fehlten in der Schnellantwort für "Besitzer" und "Notiz":** Beide Funktionen wurden bisher nur auf der äußeren Ticketseite gesucht statt im eingebetteten Formular. Die komplette Prioritäts-Vorlagen-Funktion (Werkzeugleiste, Felder befüllen, "Als Vorlage speichern") ist jetzt konsequent auf das jeweilige Dokument bezogen und funktioniert dadurch identisch in der Schnellantwort wie auf der normalen Seite. Die "Vorlagen bearbeiten"-Verwaltung bleibt bewusst ein normales Overlay über der Ticketseite. Warten-Schnellauswahl war technisch bereits vorbereitet; falls sie in einem konkreten Fall dennoch fehlt, liegt es daran, dass dort schlicht kein Warten-Status-Feld vorhanden ist.

### Added
- **Schnellantwort deckt jetzt zusätzlich "Schließen", "Verknüpfen" und "Zusammenfassen" ab.** Die zugrunde liegenden Znuny-Aktionsnamen für Schließen/Verknüpfen/Zusammenfassen sind unsere beste Einschätzung und an dieser Installation ungeprüft – trifft ein Name nicht zu, öffnet der jeweilige Link einfach weiterhin wie gewohnt in Tab oder Popup, ohne Fehler.

## [1.3.0] – 2026-09-07

### Added
- **Schnellantwort deckt jetzt auch "Besitzer" (Personen → Besitzer) und "Notiz" (Kommunikation → Notiz) ab**, nicht mehr nur Antworten/Allen-antworten. Beide öffnen bei aktivierter Schnellantwort ebenfalls als eingebettetes Fenster direkt im Ticket statt in einem neuen Tab, inklusive Ctrl+Enter, Warten-Schnellauswahl und automatischem Schließen/Aktualisieren nach dem Übermitteln. Das Fenster zeigt dabei die passende Überschrift ("Besitzer ändern" / "Notiz hinzufügen" / "Schnellantwort").

## [1.2.7] – 2026-09-03

### Security
- **Verbleibende Lücke im PDF-Vorschau-Fallback geschlossen:** Der übliche Vorschauweg (Fetch + erzwungener `application/pdf`-Blob) war bereits sicher, unabhängig vom `sandbox`-Attribut. Der seltenere Fallback – wenn der Fetch fehlschlägt oder der Server den Anhang selbst als HTML statt PDF meldet – hat den Anhang bisher trotzdem direkt und automatisch in einem ungesicherten, gleichen-Ursprungs-iframe geöffnet. Da eine Sandbox hier den PDF-Betrachter komplett lahmlegt (siehe 1.2.6), zeigt das Addon in diesem Fall jetzt stattdessen einen Hinweis mit einem normalen Download-Link – der Anhang wird nur noch nach einem bewussten Klick geöffnet, genau wie beim direkten Klick auf den ursprünglichen Znuny-Anhang-Link, statt automatisch als Vorschau.

## [1.2.6] – 2026-09-03

### Fixed
- **PDF-Vorschau in Chrome/Edge weiterhin kaputt:** Der 1.2.5-Fix (`allow-same-origin` ergänzt) hat nur das Laden der `blob:`-Quelle repariert, nicht aber ein zweites, unabhängiges Problem: Der eingebaute PDF-Betrachter von Chrome/Edge aktiviert sich grundsätzlich nicht innerhalb eines sandboxed iframes, unabhängig davon, welche Rechte diesem per `sandbox`-Attribut erteilt werden – ein bekanntes, dokumentiertes Chromium-Verhalten. Das `sandbox`-Attribut wurde daher für die PDF-Vorschau wieder vollständig entfernt (Zustand vor 1.2.2). Der PDF-Betrachter läuft ohnehin bereits isoliert auf Browser-Prozess-Ebene, wodurch die HTML-Sandbox dort keinen zusätzlichen Schutz bietet, aber die Darstellung verhindert hätte. DOCX- und Tabellen-Vorschau (die kein PDF-Plugin nutzen) bleiben weiterhin sandboxed.

## [1.2.5] – 2026-09-03

### Fixed
- **PDF-Vorschau war seit 1.2.2 kaputt:** Das in 1.2.2 ergänzte leere `sandbox`-Attribut hat verhindert, dass der Browser die per `blob:`-URL geladene PDF-Datei überhaupt öffnen konnte – `blob:`-URLs sind nur aus der Herkunft abrufbar, die sie erzeugt hat, und ein leeres `sandbox`-Attribut versetzt den Rahmen in eine fremde, anonyme Herkunft. Das `sandbox`-Attribut der PDF-Vorschau setzt jetzt zusätzlich `allow-same-origin`, wodurch das Laden wieder funktioniert; Skriptausführung bleibt weiterhin vollständig unterbunden (kein `allow-scripts`), die Absicherung aus 1.2.2 bleibt also erhalten.

## [1.2.4] – 2026-09-03

### Fixed
- **Sichtbarkeitsprüfung über Frame-Grenzen hinweg:** `isVisibleFormControl` (u. a. von der Warten-Schnellauswahl genutzt) rief `getComputedStyle` bisher immer über das äußere Fenster auf, auch für Felder innerhalb des Schnellantwort-iframes. Das ist der wahrscheinlichste Grund, warum die Warten-Schnellauswahl dort trotz des 1.2.3-Fixes weiterhin nicht erschien. Die Sichtbarkeitsprüfung verwendet jetzt immer das Fenster des jeweiligen Elements.

## [1.2.3] – 2026-09-03

### Fixed
- **Schnellantwort:** Die Warten-Schnellauswahl (Schnellknöpfe für das Wartedatum) erschien innerhalb des Schnellantwort-Fensters nicht, aus demselben Grund wie zuvor bei Strg+Enter – die Funktion suchte bisher nur auf der äußeren Ticketseite nach den Datumsfeldern statt im eingebetteten Antwortformular. Läuft jetzt zusätzlich direkt im Antwortformular und reagiert auch, wenn der Status erst nachträglich auf einen Warten-Status umgestellt wird.

## [1.2.2] – 2026-09-03

### Security
- **PDF-Vorschau in der Anhang-Vorschau abgesichert:** Das Vorschau-Fenster für PDFs bekommt jetzt wie die DOCX- und Tabellen-Vorschau ein leeres `sandbox`-Attribut (kein `allow-scripts`, kein `allow-same-origin`). Bisher fehlte das dort. Betroffen ist vor allem der Fallback-Pfad, der die Anhang-URL direkt lädt: Falls eine Datei entgegen ihrer Endung tatsächlich HTML/JS statt eines echten PDFs ist und Znuny sie mit einem entsprechenden Content-Type ausliefert, verhindert das Sandbox-Attribut jetzt, dass darin enthaltenes Skript in der Znuny-Herkunft (mit Zugriff auf die eigene Sitzung) ausgeführt wird. Die eigentliche PDF-Darstellung läuft ohnehin über den eingebauten PDF-Betrachter des Browsers und ist davon nicht betroffen.

## [1.2.1] – 2026-09-03

### Fixed
- **Schnellantwort:** Strg+Enter zum Senden funktionierte innerhalb des Schnellantwort-Fensters nicht, da die Tastenkombination bisher nur auf der äußeren Ticketseite gebunden wurde statt im eingebetteten Antwortformular selbst. Wird jetzt direkt im Antwortformular (inklusive Editor) gebunden.
- **Schnellantwort:** Nach dem Absenden blieb die Ticketseite unverändert stehen, was so aussah, als sei nichts abgeschickt worden. Die Erkennung des erfolgreichen Absendens reagierte bisher nur auf ein wiederholtes Abfragen der Fenster-Adresse, das durch einen kurzen Ladezustand ("about:blank") vor dem eigentlichen Laden des Formulars fehlgeleitet werden konnte. Sie reagiert jetzt zusätzlich direkt auf das Laden der Folgeseite und lädt die Ticketseite danach zuverlässig neu.

### Changed
- **Schnellantwort** trägt nicht mehr den Zusatz "(Beta)" – die Funktion hat sich bewährt und bleibt weiterhin standardmäßig deaktiviert, da sie das gewohnte Antwortverhalten grundlegend ändert.

## [1.2.0] – 2026-09-03

### Added
- **Schnellantwort:** "Antworten" und "Allen antworten" öffnen jetzt wahlweise nicht mehr in einem neuen Tab, sondern als kleines Fenster direkt über dem Ticket – ganz ohne Tabwechsel. Es ist weiterhin die echte Znuny-Antwortseite (inkl. Editor, Signatur, Pflichtfeldern), nur eingebettet statt in einem eigenen Tab. Nach dem Absenden schliesst sich das Fenster automatisch und das Ticket wird aktualisiert; über den "Schliessen"-Knopf lässt es sich jederzeit ohne Senden verwerfen. Standardmässig deaktiviert, da es das gewohnte Antwortverhalten grundlegend ändert – Einschalten im Popup unter "Schnellantwort".

## [1.1.1] – 2026-09-03

### Fixed
- **Prioritäts-Vorlagen funktionierten nicht beim "Neues Telefon-Ticket"-Formular:** Die Vorlagen-Werkzeugleiste erschien dort bisher gar nicht, und selbst mit Erweiterung hätten Queue- und Besitzer-Feld nicht gefunden werden können, weil dieses Formular andere Feld-IDs verwendet als die Besitzer-/Prioritäts-Aktionsseiten (z. B. `Dest` statt `NewQueueID`). Die Felderkennung sucht jetzt mehrere bekannte ID-Varianten und fällt zusätzlich auf eine Suche über die sichtbare Feldbeschriftung zurück, sodass Vorlagen jetzt auch beim Telefon-Ticket zuverlässig greifen.

## [1.1.0] – 2026-09-02

### Added
- **Bilder in Ticketartikeln sind jetzt anklickbar und vergrößerbar:** Bereits im Ticket angezeigte Bilder (z. B. eingebettete Bilder aus HTML-Mails) bekommen beim Hover einen Rahmen und öffnen per Klick eine Großansicht (schließbar per Klick daneben, Escape oder Schließen-Button). Läuft über den bestehenden "Anhang-Vorschau"-Schalter, kein neuer Schalter nötig. Sehr kleine Bilder (unter 24×24 px, typischerweise Spacer/Tracking-Pixel) bleiben bewusst ausgenommen.
- **Drei neue, dezente Benachrichtigungstöne** für "Ton bei neuem Ticket": Sanfter Ping, Zwei-Ton-Chime, Weicher Klick – synthetisch erzeugte, kurze Glockentöne statt der bisherigen Sounds. Sanfter Ping ist jetzt der Standard-Sound.

### Changed
- **Prioritäts-Vorlagen** und **Ton bei neuem Ticket** sind jetzt standardmäßig deaktiviert (vorher aktiv). Wer sie nutzen möchte, schaltet sie im Popup ein; bereits gespeicherte eigene Einstellungen bleiben unangetastet.

### Fixed
- **Tab-Schließen nach dem Übermitteln war unzuverlässig** (blieb manchmal offen, schloss manchmal gar nicht automatisch). Ursache: Der Schließen-Befehl wurde bisher im `submit`-Event der Seite gesendet – genau in dem Moment, in dem die Seite durch die eigentliche Formularübermittlung bereits zu entladen beginnt, wodurch die Nachricht an den Hintergrundprozess gelegentlich verloren ging, bevor sie überhaupt verschickt werden konnte. Jetzt wird die Absicht schon beim Klick auf "Übermitteln" (bevor die Seite zu entladen beginnt) über `sessionStorage` vermerkt und erst auf der danach geladenen Folgeseite zuverlässig ausgeführt. Die beiden getrennten, leicht unterschiedlichen Mechanismen für normale Aktionen und E-Mail-Antworten wurden dabei zu einem gemeinsamen, einfacheren Mechanismus zusammengeführt.
- **"Ton bei neuem Ticket" fand die eigene "Gesperrte Tickets"-Liste nicht zuverlässig:** Die Erkennung hat bisher nach einem entsprechenden Link in der aktuellen Seite gesucht – auf Seiten ohne volle Werkzeugleiste (z. B. per "Popups als Tabs" geöffnete Aktions-Tabs) wurde dieser Link nie gefunden, wodurch die minütliche Prüfung dort stillschweigend nichts tat. Die Ziel-URL wird jetzt direkt aus der aktuellen Znuny-Adresse gebildet, unabhängig von der sichtbaren Werkzeugleiste.
- **Mehrfache Benachrichtigungen bei mehreren offenen Znuny-Tabs:** Sind gleichzeitig mehrere Znuny-Tabs offen, prüfen alle unabhängig voneinander im Minutentakt. Ohne Abstimmung konnten mehrere Tabs denselben neuen Ticket-Eingang gleichzeitig entdecken und den Sound mehrfach abspielen. Die Prüfung läuft jetzt (wo vom Browser unterstützt) über die Web-Locks-API serialisiert, sodass ein neues Ticket nur einmal gemeldet wird.

## [1.0.0] – 2026-08-31

Erstes Release, das gleichzeitig für Chrome, Edge und Firefox veröffentlicht wird. Fasst die 0.1.45–0.1.54-Arbeit (Firefox-Freigabe, Ton bei neuem Ticket, Infinite-Scroll- und Prioritäts-Vorlagen-Fixes, Projektaufräumung) als stabilen Meilenstein zusammen; siehe die Einträge darunter für die Einzelheiten.

## [0.1.54] – 2026-08-31

### Added
- **Ton bei neuem Ticket** aktualisiert jetzt zusätzlich die gerade sichtbare Ticketliste, sobald ein neues Ticket erkannt wird, statt nur den Sound abzuspielen. Dadurch taucht das neue Ticket sofort in der Übersicht auf, unabhängig von Znunys eigenem Aktualisierungsintervall der Übersichten.

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
