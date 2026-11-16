# Datenschutzerklärung – Znuny Helper

Stand: 16. November 2026

## Kurzfassung

Der Znuny Helper erhebt, überträgt und verkauft **keine personenbezogenen Daten**. Es gibt keine Analyse, kein Tracking, keine Werbung und keine Server des Anbieters.

## Welche Daten verarbeitet werden

Die Erweiterung arbeitet ausschließlich im Browser der nutzenden Person und ausschließlich auf der Znuny-Instanz der Hochschule Rhein-Waal (`https://otrs.staff.hsrw`).

Lokal im Browser gespeichert (über die `storage`-Schnittstelle des Browsers, nicht verlassen die Maschine):

- Einstellungen (welche Funktionen an oder aus sind)
- der Suchverlauf der Ticket-Suche (die letzten Suchbegriffe)
- selbst angelegte Kategorien, Prioritäts-Vorlagen und eigene Töne
- der Merker, ob der Santa-Ton schon einmal lief, und die zuletzt gesehenen Ticketnummern für den Ton bei neuen Tickets

## Welche Daten übertragen werden

Keine. Die Erweiterung ruft ausschließlich Seiten der genannten Znuny-Instanz auf – mit der bestehenden Sitzung des Browsers (Kerberos/SSO). Es werden keine Daten an Dritte gesendet, auch nicht an den Anbieter der Erweiterung.

## Schreibzugriffe

Die Erweiterung liest Seiten und Oberflächen der genannten Instanz. Sie schreibt nur dort, wo es die nutzende Person auslöst:

- Kategorie in der Ticketliste setzen
- Prioritäts-Vorlagen ausfüllen (Formularfelder, erst beim Absenden durch die nutzende Person)
- Seiten-URL-Parameter für die Vorschau

Es werden keine Tickets im Hintergrund verändert.

## Löschung

Alle lokal gespeicherten Daten lassen sich jederzeit über die Einstellungen des Browsers löschen (Erweiterung entfernen oder Websitedaten löschen). Ein Löschantrag beim Anbieter ist nicht nötig, weil dort keine Daten liegen.

## Kontakt

Fragen über das Repository: https://github.com/KoloTim/znuny-helper
