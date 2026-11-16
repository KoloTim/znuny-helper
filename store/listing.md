# Store-Eintrag – Texte zum Kopieren

## Name

```
Znuny Helper
```

## Kurzbeschreibung (max. 132 Zeichen)

```
Mehr Komfort im Znuny der HSRW: Anhänge ansehen, im Ticket suchen, Vorlagen, Kategorien und Sounds.
```

## Kategorie

Produktivität (Chrome) · „Sonstiges“ als Ausweichkategorie bei AMO, falls Produktivität fehlt.

## Sprache

Deutsch

## Ausführliche Beschreibung

```
Der Znuny Helper ergänzt das Ticketsystem der Hochschule Rhein-Waal um Funktionen, die im
Alltag Zeit sparen – jede einzeln im Popup schaltbar, jede sofort wirksam.

WICHTIG: Die Erweiterung läuft ausschließlich auf https://otrs.staff.hsrw. Auf anderen
Znuny-Instanzen tut sie nichts.

IM GEÖFFNETEN TICKET
• Anhänge und Bilder ansehen: PDF, Bilder, E-Mails, Word- und Excel-Dateien direkt im Ticket öffnen, ohne Download. Erkannte Bilder lassen sich per Klick vergrößern.
• Im Ticket suchen: Suchfeld oben im Ticket, springt durch alle Artikel und markiert die Treffer.
• Case-/Ticketnummer kopieren: ein Klick auf die Nummer in der Überschrift kopiert sie in die Zwischenablage.
• Antworten und Weiterleiten ohne Vorlagenklick: bei nur einer Vorlage wird sie vorausgewählt.
• Schnellantwort: Antworten, Weiterleiten, Besitzer ändern, Priorisieren, Notiz, Schließen und Verknüpfen in einem Fenster.

IN LISTS UND SUCHEN
• Endlos-Scrollen in Ticketlisten, mit Ladeanzeige und automatischem Nachladen.
• Kategorien setzen und verwalten: Kategorie direkt in der Liste zuweisen, eigene Kategorien pflegen.
• Suchverlauf: die letzten Suchbegriffe stehen unter dem jeweiligen Feld und lassen sich mit einem Klick einsetzen.

HILFEN
• Prioritäts-Vorlagen: vorbefüllte Schnellbuttons auf Prioritäts-, Besitzer- und Telefon-Ticket-Seiten.
• Wartezeit-Schnellbuttons (3/7/14 Tage) und Standardwert.
• Tastenkürzel und Popup-Tabs.
• Ton bei neuem Ticket: meldet neue gesperrte Tickets mit einem Sound; Standardton ist „Neues Ticket“, zehn weitere Töne und eigene Dateien sind wählbar.

SAISONALES
In der Adventszeit (1. November bis 25. Dezember) liegt eine dezente Weihnachtsdeko über der Seite: Schnee, Girlande, Adventskranz mit Kerzen nach Datum, Tannenbaum. Ohne Saison ist alles weg. Wer keine Lust darauf hat, schaltet sie mit einem Klick ab.

MINISPIELE (abschaltbar)
• Pinball: dreimal auf den Weihnachtsbaum klicken.
• Pac-Man: einmal auf den Adventskranz klicken.
• Logo Pong: drei Sekunden mit der Maus über das eigene Profilbild.

DATENSPARSAM
Keine Übertragung an Dritte, keine Auswertung, keine Konten. Alle Einstellungen liegen lokal im Browser. Die Anmeldung läuft über die bestehende Kerberos-/SSO-Sitzung des Browsers.
```

## Berechtigungen – Begründung für die Prüfung

| Berechtigung | Warum |
| --- | --- |
| `storage` | Einstellungen, Suchverlauf, Kategorien und eigene Sounds lokal speichern |
| `tabs` | Tabs schließen nach dem Absenden („Popups als Tabs“) und die aktuelle Seite für die Vorschau nutzen |
| `host_permissions` auf `otrs.staff.hsrw` | Die Erweiterung verändert ausschließlich Oberflächen dieser Instanz; ohne Zugriff auf die Seiten könnte sie nichts tun |
| `web_accessible_resources` (`sounds/*`) | Die eingebauten Töne müssen im Seitenkontext abspielbar sein |

## Support

Kontakt: siehe Repository (https://github.com/KoloTim/znuny-helper)

## Versionshinweise („What's new“)

```
1.8.0
• Weihnachtsdeko nur noch in der Saison (1. November bis 25. Dezember)
• Pac-Man steckt jetzt im Adventskranz: einmal darauf klicken
• Eigene Icons, aufgeräumte Store-Texte
```
