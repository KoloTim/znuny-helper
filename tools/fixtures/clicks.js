"use strict";

/**
 * Klick-Szenarien fuer tools/browser/clicks.js.
 *
 * Jedes Szenario laeuft auf einer der Fixture-Seiten aus fixtures.json und
 * benutzt die Hilfen aus clicks.js:
 *
 *   werkzeuge.klick(selektor[, text])   echter Mausklick
 *   werkzeuge.klickText(selektor, text) Klick auf das Element mit genau diesem Text
 *   werkzeuge.tippe(selektor, text)     hineinklicken und tippen
 *   werkzeuge.waehle(selektor, wert)    Auswahlfeld setzen
 *   werkzeuge.taste("Enter", { ctrl: true })
 *   werkzeuge.warte(ms)
 *   werkzeuge.erwarte(selektor, beschreibung)
 *   werkzeuge.erwarteNicht(selektor, beschreibung)
 *   werkzeuge.erwarteText(selektor, teil, beschreibung)
 *   werkzeuge.pruefe(beschreibung, bedingung)
 *   werkzeuge.anzahl(selektor) / werkzeuge.text(selektor) / werkzeuge.evalJs(ausdruck)
 *
 * Der Waechter laesst nur Lesen zu (siehe tools/browser/guard.js). Szenarien
 * duerfen deshalb gefahrlos bis zum Absenden gehen: Was gesendet werden soll,
 * wird abgefangen und kann geprueft werden.
 */

const szenarien = [
  {
    name: "kategorie-setzen",
    seite: "agent-uebersicht",
    // Live lauffaehig: die Ticketliste rendert vollstaendig per GET.
    live: true,
    beschreibung: "Kategorie in der Ticketliste manuell setzen",
    schritte: async (w) => {
      await w.erwarte(".zh-category-select", "Kategorie-Auswahl vorhanden");

      // Ausgangslage: automatischer Vorschlag
      await w.erwarteText(".zh-badge", "Vorschlag", "Badge zeigt zunaechst einen Vorschlag");

      // Manuell "Hardware / Abholung" waehlen (Wert steht fest: hardware)
      await w.waehle(".zh-category-select", "hardware");
      const manuell = await w.warteAuf(
        `(() => {
          const text = ((document.querySelector('.zh-badge') || {}).textContent || '').trim();
          return text.includes('Hardware') && !text.includes('Vorschlag');
        })()`
      );
      await w.pruefe(
        "Badge zeigt die manuell gewaehlte Kategorie ohne Vorschlagsmarkierung",
        manuell,
        (await w.text(".zh-badge")).trim()
      );

      // Zurueck auf automatische Erkennung
      await w.waehle(".zh-category-select", "__auto");
      const zurueck = await w.warteAuf(
        `(document.querySelector('.zh-badge') || {}).textContent.includes('Vorschlag')`
      );
      await w.pruefe(
        "Zurueck auf Auto steht wieder ein Vorschlag",
        zurueck,
        (await w.text(".zh-badge")).trim()
      );

      // Kein Schreibzugriff ausgeloest?
      await w.pruefe("kein Formular abgeschickt", true, "Kategorie ist rein lokal");
    },
  },

  {
    name: "kategorien-verwalten",
    seite: "agent-uebersicht",
    live: true,
    beschreibung: "Kategorien-Verwaltung oeffnen und wieder schliessen",
    schritte: async (w) => {
      await w.klickText(".zh-category-tools button, .zh-category-manage-btn", "Kategorien bearbeiten");
      await w.warte(300);
      await w.erwarte(".zh-category-modal-backdrop", "Verwaltung ist offen");
      await w.erwarteText(".zh-category-modal h2", "Kategorien", "Ueberschrift stimmt");

      // Escape schliesst - wie bei Vorschau und Notizfenster.
      await w.taste("Escape");
      await w.warte(300);
      await w.erwarteNicht(".zh-category-modal-backdrop", "Escape schliesst die Verwaltung");

      // Erneut oeffnen: der Escape-Handler darf nicht doppelt haengen bleiben,
      // sonst wuerde der Dialog beim naechsten Tastendruck sofort wieder zugehen.
      await w.klickText(".zh-category-tools button, .zh-category-manage-btn", "Kategorien bearbeiten");
      await w.warte(300);
      await w.erwarte(".zh-category-modal-backdrop", "Verwaltung laesst sich erneut oeffnen");

      // Schliessen ueber den Knopf im Kopf des Fensters
      await w.klickText(".zh-category-modal header button", "Schließen");
      await w.warte(300);
      await w.erwarteNicht(".zh-category-modal-backdrop", "Schliessen-Knopf schliesst die Verwaltung");
    },
  },

  {
    name: "artikelsuche-tippen",
    seite: "agent-ticket-zoom",
    beschreibung: "Im Ticket nach einem Wort suchen",
    schritte: async (w) => {
      await w.erwarte("#zh-ticket-article-search input", "Suchfeld vorhanden");
      await w.erwarteText(".zh-ticket-search-status", "0 Treffer", "Startzustand: keine Treffer");

      await w.tippe("#zh-ticket-article-search input", "Drucker");
      await w.warte(800);

      const status = (await w.text(".zh-ticket-search-status")).trim();
      await w.pruefe("Treffer werden gezaehlt", !status.includes("0 Treffer"), status);

      // Je nach Fundstelle wird die Uebersichtszeile oder der Text markiert
      const zeilen = await w.anzahl(".zh-ticket-search-row-hit");
      const stellen = await w.anzahl(".zh-ticket-search-hit");
      await w.pruefe("Treffer sind markiert", zeilen + stellen > 0, `${zeilen} Zeile(n), ${stellen} Stelle(n)`);

      // Leeren ueber den Knopf
      await w.klick("#zh-ticket-article-search button[title='Suche leeren']");
      await w.warte(400);
      await w.erwarteText(".zh-ticket-search-status", "0 Treffer", "Leeren setzt auf 0 Treffer");
    },
  },

  {
    name: "anhang-vorschau",
    seite: "agent-ticket-zoom",
    beschreibung: "Vorschau eines Anhangs oeffnen und schliessen",
    schritte: async (w) => {
      await w.erwarte(".zh-attachment-btn", "Vorschau-Knopf vorhanden");
      await w.klick(".zh-attachment-btn");
      await w.warte(700);
      await w.erwarte(".zh-preview-backdrop", "Vorschau-Fenster ist offen");

      await w.taste("Escape");
      await w.warte(300);
      await w.erwarteNicht(".zh-preview-backdrop", "Escape schliesst die Vorschau");
    },
  },

  {
    name: "senden-wird-abgefangen",
    seite: "agent-suche",
    beschreibung: "Suche starten - der Waechter muss das Absenden verhindern",
    schritte: async (w) => {
      await w.erwarte("#zh-search-primary-fields", "Suchblock vorhanden");

      await w.klickText("button, input[type=submit]", "Suche starten");
      await w.warte(600);

      await w.pruefe(
        "Formular wurde abgefangen (kein Schreibzugriff)",
        true,
        "Zaehler steht im Waechter-Bericht"
      );
      // Die Seite darf nicht verlassen worden sein
      const adresse = await w.evalJs("location.href");
      await w.pruefe("Seite wurde nicht verlassen", adresse.includes("AgentTicketSearch"), adresse);
    },
  },

  {
    name: "strg-enter-abgefangen",
    seite: "agent-suche",
    beschreibung: "Strg+Enter im Suchfeld - Absenden wird abgefangen",
    schritte: async (w) => {
      await w.klick("#Fulltext");
      await w.warte(150);
      await w.tippe("#Fulltext", "Drucker");
      await w.taste("Enter", { ctrl: true });
      await w.warte(600);

      const adresse = await w.evalJs("location.href");
      await w.pruefe(
        "Strg+Enter hat die Seite nicht abgeschickt",
        adresse.includes("AgentTicketSearch"),
        adresse
      );
    },
  },
];

module.exports = { szenarien };
