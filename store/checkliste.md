# Checkliste vor dem Hochladen

## Immer

- [ ] `python tools/sync-firefox.py --check` → „synchron“
- [ ] `node tools/run-node-test.js` → alle Tests grün
- [ ] `node tools/browser/smoke.js` → 4/4
- [ ] `node tools/browser/clicks.js` → 6/6
- [ ] `python tools/build-release-zips.py` und `verify-release-zips.py` → Archive stimmen
- [ ] Version in beiden Manifesten und `package.json` gleich
- [ ] `CHANGELOG.md` hat einen Abschnitt für die Version
- [ ] Tag `vX.Y.Z` gesetzt und gepusht, CI grün

## Chrome Web Store

- [ ] `znuny-helper-extension.zip` hochladen
- [ ] Name, Kurzbeschreibung (132 Zeichen), ausführliche Beschreibung aus `listing.md`
- [ ] Kategorie „Produktivität“, Sprache Deutsch
- [ ] Screenshots aus `screenshots/` (1280 × 800)
- [ ] Icon: kommt aus dem Manifest (`icons/icon-128.png`)
- [ ] Berechtigungen begründen (Tabelle in `listing.md`)
- [ ] Datenschutz: „Es werden keine personenbezogenen Daten erhoben“ + Link/Text aus `datenschutz.md`
- [ ] Sichtbarkeit: eingeschränkt (nur Hochschule) oder öffentlich – bewusst entscheiden
- [ ] Trader-Status / Kontaktadresse hinterlegen

## Firefox Add-ons (AMO)

- [ ] `znuny-helper-extension-firefox.zip` hochladen (die `.xpi` ist identisch)
- [ ] Version 1.8.0, Kategorie, Beschreibung aus `listing.md`
- [ ] Datenerhebung: „none“ ist im Manifest gesetzt (`data_collection_permissions`)
- [ ] Screenshots (1280 × 800)
- [ ] Signierung beantragen (nötig für die Installation außerhalb des Entwicklermodus)

## Vor dem Klick auf „Veröffentlichen“

- [ ] Auf einer frischen Installation gegenprüfen: Popup öffnen, alle Schalter sichtbar
- [ ] Auf der echten Znuny-Seite: keine Konsolenfehler (Rauchtest deckt das ab)
- [ ] Deko-Saison prüfen: außerhalb 1. November – 25. Dezember erscheint keine Weihnachtsdeko
- [ ] Minispiele abschaltbar (Schalter „Minispiele erlauben“)
