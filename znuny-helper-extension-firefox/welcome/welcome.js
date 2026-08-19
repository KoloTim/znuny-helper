(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason") || "install";
  const previousVersion = params.get("previousVersion") || "";
  const manifest = api.runtime.getManifest();

  const releases = [
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
