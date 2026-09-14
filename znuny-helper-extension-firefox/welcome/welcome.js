(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") || "install";
  const previousVersion = params.get("previousVersion") || "";
  const manifest = api.runtime.getManifest();

  const releases = [
    {
      version: "1.5.0",
      items: [
        "Neu: Die Tage der Warten-Schnellauswahl sind jetzt im Popup frei einstellbar (z. B. 1, 3, 7, 14). Der erste Wert wird automatisch vorbelegt.",
        "Das Popup ist übersichtlicher: klarere Beschreibungen und sinnvoll gruppierte Optionen.",
        "Infinite Scroll blendet die überflüssigen Seitenzahlen oben rechts in der Ticketliste aus.",
        "Neu: Zwei zusätzliche Benachrichtigungstöne zur Auswahl (Dezenter Ping, Neue Nachricht) – damit sind zehn Sounds eingebaut.",
        "Die Anhang-Erinnerung wurde entfernt."
      ]
    },
    {
      version: "1.4.0",
      items: [
        "Neu: Die Case-/Ticketnummer oben links im geöffneten Ticket lässt sich per Klick kopieren (mit kurzer Bestätigung). Abschaltbar im Popup unter \"Suchen\"."
      ]
    },
    {
      version: "1.3.2",
      items: [
        "Fix: Excel-/Tabellen-Vorschau in Firefox (\"e.replace is not a function\") – die Datei-Bytes werden jetzt realm-sicher als Uint8Array übergeben.",
        "Fix: \"Abbrechen und Schließen\" in per \"Popups als Tabs\" geöffneten Aktionen funktioniert wieder (schließt den Tab); in der Schnellantwort schließt er das eingebettete Fenster.",
        "Fix: Schnellantwort belegt spät nachgeladene Wartedatum-Felder jetzt zuverlässig mit +3 Tagen vor.",
        "Neu: Prioritäts-/Personen-Vorlagen lassen sich gruppieren. Toolbar und Bearbeiten-Dialog sind neu aufgebaut: Kacheln je Vorlage, nach Gruppen sortiert, mit Filter, ausklappbaren Feldern und Hoch/Runter.",
        "Die Kategorien-Bearbeitungsseite ist kompakter (eine Zeile je Kategorie, mitwachsende Keyword-Box).",
        "Der öffentliche Bug-Melde-Link wurde aus Popup und Willkommensseite entfernt."
      ]
    },
    {
      version: "1.3.1",
      items: [
        "Fix: Prioritäts-Vorlagen fehlten in der Schnellantwort für \"Besitzer\" und \"Notiz\" – funktioniert jetzt dort genauso wie auf der normalen Seite (Werkzeugleiste, Felder befüllen, Als Vorlage speichern).",
        "Neu: Schnellantwort deckt zusätzlich \"Schließen\", \"Verknüpfen\" und \"Zusammenfassen\" ab."
      ]
    },
    {
      version: "1.3.0",
      items: [
        "Neu: Schnellantwort deckt jetzt auch \"Besitzer\" (Personen → Besitzer) und \"Notiz\" (Kommunikation → Notiz) ab, nicht mehr nur Antworten/Allen-antworten. Öffnen bei aktivierter Schnellantwort ebenfalls als eingebettetes Fenster im Ticket, inklusive Ctrl+Enter und Warten-Schnellauswahl."
      ]
    },
    {
      version: "1.2.7",
      items: [
        "Sicherheit: Wenn die PDF-Vorschau nicht sicher als PDF bestätigt werden kann (seltener Fallback-Fall), wird der Anhang nicht mehr automatisch in einem Rahmen geöffnet, sondern nur noch über einen Download-Link nach bewusstem Klick."
      ]
    },
    {
      version: "1.2.6",
      items: [
        "Fix: PDF-Vorschau in Chrome/Edge war weiterhin kaputt. Ursache: Der eingebaute PDF-Betrachter aktiviert sich grundsätzlich nicht innerhalb eines sandboxed iframes (bekanntes Chromium-Verhalten). Sandbox für die PDF-Vorschau entfernt; der Betrachter läuft ohnehin bereits browser-seitig isoliert."
      ]
    },
    {
      version: "1.2.5",
      items: [
        "Fix: Die PDF-Vorschau war seit der letzten Version kaputt (leere/blockierte Vorschau). Die dort ergänzte Absicherung liess PDFs nicht mehr laden; jetzt behoben, ohne die Absicherung selbst zurückzunehmen."
      ]
    },
    {
      version: "1.2.4",
      items: [
        "Fix: Die Sichtbarkeitsprüfung für Formularfelder berücksichtigte innerhalb der Schnellantwort das falsche Fenster, wodurch die Warten-Schnellauswahl dort trotz des vorherigen Fixes weiterhin nicht erschien."
      ]
    },
    {
      version: "1.2.3",
      items: [
        "Fix: Die Warten-Schnellauswahl erschien nicht innerhalb der Schnellantwort. Funktioniert jetzt auch dort, inklusive bei nachträglicher Umstellung auf einen Warten-Status."
      ]
    },
    {
      version: "1.2.2",
      items: [
        "Sicherheit: Die PDF-Vorschau in der Anhang-Vorschau läuft jetzt wie die DOCX-/Tabellen-Vorschau in einem abgesicherten (\"sandboxed\") Vorschaufenster ohne Skriptausführung."
      ]
    },
    {
      version: "1.2.1",
      items: [
        "Fix: Strg+Enter zum Senden funktionierte innerhalb der Schnellantwort nicht.",
        "Fix: Nach dem Absenden einer Schnellantwort blieb die Ticketseite unverändert stehen, statt die neue Antwort zu zeigen.",
        "Schnellantwort trägt nicht mehr den Zusatz \"(Beta)\"."
      ]
    },
    {
      version: "1.2.0",
      items: [
        "Neu: Schnellantwort – \"Antworten\" und \"Allen antworten\" öffnen wahlweise als kleines Fenster direkt über dem Ticket statt in einem neuen Tab. Nach dem Absenden schliesst es sich automatisch und das Ticket wird aktualisiert. Standardmässig aus, einschaltbar im Popup."
      ]
    },
    {
      version: "1.1.1",
      items: [
        "Prioritäts-Vorlagen funktionieren jetzt auch beim \"Neues Telefon-Ticket\"-Formular, nicht mehr nur bei Besitzer-/Prioritäts-Aktionen."
      ]
    },
    {
      version: "1.1.0",
      items: [
        "Neu: Bilder, die bereits im Ticketartikel angezeigt werden (z. B. eingebettete Bilder aus HTML-Mails), sind jetzt anklickbar und öffnen sich vergrößert.",
        "Neu: Drei zusätzliche, dezente Benachrichtigungstöne für \"Ton bei neuem Ticket\" (Sanfter Ping, Zwei-Ton-Chime, Weicher Klick) – Sanfter Ping ist jetzt der Standard.",
        "Geändert: Prioritäts-Vorlagen und Ton bei neuem Ticket sind jetzt standardmäßig deaktiviert.",
        "Fix: Tab-Schließen nach dem Übermitteln blieb manchmal offen oder schloss gar nicht automatisch.",
        "Fix: Ton bei neuem Ticket erkannte neue Tickets in manchen Tabs nicht zuverlässig und konnte bei mehreren offenen Znuny-Tabs mehrfach auslösen."
      ]
    },
    {
      version: "1.0.0",
      items: [
        "Neu: Der Znuny Helper ist jetzt für Chrome, Edge und Firefox verfügbar.",
        "Neu: Ton bei neuem Ticket – spielt einen wählbaren Sound ab, sobald ein neues Ticket bei dir gesperrt wird, und aktualisiert dabei automatisch die gerade sichtbare Ticketliste. Fünf Sounds sind eingebaut, eigene Sounds lassen sich hinzufügen und wieder entfernen.",
        "Infinite Scroll: mehrere Zuverlässigkeitsprobleme behoben (falsche Folgeseite, Aussetzer nach erneutem Ein-/Ausschalten, hängender Retry nach Netzwerkfehlern).",
        "Prioritäts-Vorlagen: \"Als Vorlage speichern\" erfasst jetzt zuverlässig alle Felder (Typ, Queue, Service, Besitzer, Kategorie), auch wenn sie als Tag-Auswahl dargestellt werden."
      ]
    },
    {
      version: "0.1.44",
      items: [
        "Ticket-Kategorien: Farben werden jetzt so gesetzt, dass Dark-Reader-artige Addons sie seltener plattbügeln (betroffene Farben blieben zuvor alle gleich dunkel).",
        "Ticket-Kategorien: Keyword \"laptop\"/\"notebook\" zu Hardware/Abholung ergänzt, damit z. B. \"Neuer Arbeitslaptop benötigt\" korrekt erkannt wird."
      ]
    },
    {
      version: "0.1.43",
      items: [
        "Ticket-Kategorien: automatische Erkennung ist zurück, neu aufgebaut mit sechs Themen-Kategorien (Dringend/Störung, Externe Zuständigkeit, Software/Zugang, Hardware/Abholung, Studis, Warten/Rückmeldung).",
        "Automatisch erkannte Kategorien sind jetzt klar als Vorschlag markiert (kursiv, gestrichelter Rahmen, \"(Vorschlag)\") und nie mit einer manuellen Auswahl zu verwechseln.",
        "Kategorien bearbeiten: Keywords sind wieder pflegbar; die Reihenfolge der Kategorien bestimmt jetzt sichtbar auch die Priorität bei mehrdeutigen Treffern."
      ]
    },
    {
      version: "0.1.42",
      items: [
        "Neu: Tastenkürzel Strg+Enter übermittelt das aktuelle Formular (Antwort, Notiz, Schließen, ...); der Tab schließt danach wie gewohnt automatisch."
      ]
    },
    {
      version: "0.1.41",
      items: [
        "Neu: Knopf \"Als Vorlage speichern\" auf Prioritätsseiten übernimmt die aktuell ausgefüllten Felder direkt als neue Prioritäts-Vorlage.",
        "Prioritäts-Vorlagen bearbeiten: Design überarbeitet (klarere Karten, bessere Abstände) und ein Problem behoben, durch das der erzwungene Dunkelmodus des Browsers das Fenster unleserlich machen konnte."
      ]
    },
    {
      version: "0.1.40",
      items: [
        "Anhang-Vorschau: PDFs, deren Server-Antwort keinen application/pdf-Typ meldet, werden jetzt korrekt im Browser angezeigt statt als unbenannte Datei heruntergeladen."
      ]
    },
    {
      version: "0.1.39",
      items: [
        "Prioritäts-Vorlagen: Anzeige auf der Antwortseite wieder entfernt (Platzierung passte dort nicht).",
        "Ticket-Kategorien: Farben auf dezente Pastelltöne umgestellt (Fertig ist jetzt grau statt schwarz).",
        "Ticket-Kategorien: automatische Erkennung per Keywords entfernt, Kategorien werden nur noch manuell gesetzt.",
        "Zeitraum-Schnellauswahl in der Suche: Ausrichtung korrigiert, damit sie sauber mit den anderen Suchfeldern fluchtet."
      ]
    },
    {
      version: "0.1.38",
      items: [
        "Neu: Anhang-Erinnerung auf der Antwortseite, wenn der Text einen Anhang erwähnt, aber keiner angehängt ist.",
        "Neu: Schnellknöpfe für Wartedatum (+3/+7/+14 Tage, Standard 3) überall dort, wo ein Warten-Status ein Datum verlangt.",
        "Neu: Schnellauswahl Zeitraum (letzte Woche/Monat/Quartal/Jahr) in der Ticket-Suche.",
        "Ticket-Kategorien: Standardkategorien auf Ampelschema umgestellt (Neu/Wartend/Wichtig/Fertig) und Import/Export zum Teilen ergänzt.",
        "Prioritäts-Vorlagen: auf der Antwortseite nutzbar und ebenfalls per Import/Export teilbar."
      ]
    },
    {
      version: "0.1.37",
      items: [
        "Funktionseinstellungen nutzen jetzt lokalen statt synchronisierten Speicher, damit sie unter Firefox zuverlässig laden und speichern.",
        "Doppelt definierte interne Funktionen für den Extern-Hinweis auf Prioritätsseiten entfernt."
      ]
    },
    {
      version: "0.1.36",
      items: [
        "Tabs von Mail-Antworten werden nach \"E-Mail übermitteln\" automatisch geschlossen."
      ]
    },
    {
      version: "0.1.35",
      items: [
        "Vorlagen werden jetzt auch auf der Seite \"Besitzer wechseln\" angezeigt.",
        "Tabs von Mail-Antworten werden nach \"Übermitteln\" zuverlässiger geschlossen."
      ]
    },
    {
      version: "0.1.34",
      items: [
        "Sichtbare Texte wurden auf echte deutsche Umlaute umgestellt."
      ]
    },
    {
      version: "0.1.33",
      items: [
        "Der Extern-Hinweis auf Prioritätsseiten wird nun direkt neben \"Ist sichtbar für Kunde\" angezeigt.",
        "Der zusätzliche Hinweis im Vorlagenkasten wurde entfernt."
      ]
    },
    {
      version: "0.1.32",
      items: [
        "Externe Kunden werden auf Prioritätsseiten auch über EXTERN-Markierungen im Titel erkannt.",
        "Der Warnhinweis unter \"Ist sichtbar für Kunde\" wurde robuster platziert."
      ]
    },
    {
      version: "0.1.31",
      items: [
        "Externe Kunden werden auf Prioritätsseiten zusätzlich unten beim Bereich \"Ist sichtbar für Kunde\" markiert."
      ]
    },
    {
      version: "0.1.30",
      items: [
        "Willkommens- und Changelog-Seite bei Installation und Updates ergänzt.",
        "EB Helper ist standardmäßig deaktiviert.",
        "Suchergebnisse im neuen Tab sind standardmäßig deaktiviert."
      ]
    },
    {
      version: "0.1.29",
      items: [
        "Hinweis auf Prioritätsseiten ergänzt, wenn eine externe Kundenadresse erkannt wird."
      ]
    },
    {
      version: "0.1.28",
      items: [
        "XLSX-Vorschau robuster gemacht.",
        "Infinite Scroll lädt toleranter weiter.",
        "Suchdialog räumt leere Filterzeilen besser auf."
      ]
    },
    {
      version: "0.1.27",
      items: [
        "XLSX-Vorschau als statische Tabelle ergänzt.",
        "DOCX-, EML-, LOG- und TXT-Vorschau verbessert."
      ]
    }
  ];

  function renderChangelog() {
    const root = document.getElementById("changelog");
    root.textContent = "";

    releases.forEach((release) => {
      const section = document.createElement("section");
      section.className = "release";

      const title = document.createElement("h3");
      title.textContent = `Version ${release.version}`;
      section.appendChild(title);

      const list = document.createElement("ul");
      release.items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      section.appendChild(list);
      root.appendChild(section);
    });
  }

  function renderHeader() {
    const eyebrow = document.getElementById("eyebrow");
    if (reason === "update") {
      eyebrow.textContent = previousVersion
        ? `Znuny Helper wurde von ${previousVersion} auf ${manifest.version} aktualisiert`
        : `Znuny Helper wurde auf ${manifest.version} aktualisiert`;
    } else {
      eyebrow.textContent = `Znuny Helper ${manifest.version} installiert`;
    }

    document.getElementById("version").textContent = `Version ${manifest.version}`;
  }

  renderHeader();
  renderChangelog();
})();
