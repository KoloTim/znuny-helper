"use strict";

/**
 * Waechter fuer Klick-Tests: Er laesst nur Lesen zu.
 *
 * Ein Versprechen wie "ich schreibe nichts ins Ticketsystem" ist nur so viel
 * wert wie seine Durchsetzung. Deshalb sperrt dieser Waechter drei Wege:
 *
 *   1. Schreibende Anfragen. Jede Anfrage an das Znuny wird abgefangen;
 *      GET und HEAD werden aus den Fixtures beantwortet, alles andere
 *      (POST, PUT, PATCH, DELETE) wird mit "Aborted" abgewiesen und
 *      protokolliert. Ein abgeschicktes Formular erreicht den Server nie.
 *   2. Formulare. Ein Skript laeuft vor jeder Seite und blockiert das
 *      submit-Ereignis (preventDefault) sowie HTMLFormElement.submit und
 *      requestSubmit. Es zaehlt mit, damit ein Test pruefen kann, dass das
 *      Addon ueberhaupt senden wollte.
 *   3. Neue Tabs. Oeffnet ein Klick einen neuen Tab (z. B. eine
 *      Aktionsseite), wird er sofort wieder geschlossen und vermerkt. So
 *      entsteht gar keine Seite, auf der gesendet werden koennte.
 */

const { bedieneAnfrage } = require("./fixtures.js");

/**
 * Laeuft vor jedem Seitenaufbau im Hauptkontext der Seite. Zaehlt blockierte
 * Formularuebermittlungen in window.__zhWaechter.
 */
const WaechterSkript = `
(() => {
  if (window.__zhWaechter) return;
  const zaehler = { formulare: 0, submitAufrufe: 0, fenster: 0 };
  window.__zhWaechter = zaehler;

  document.addEventListener("submit", (ereignis) => {
    zaehler.formulare += 1;
    ereignis.preventDefault();
    ereignis.stopImmediatePropagation();
  }, true);

  const urspruenglich = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    zaehler.submitAufrufe += 1;
  };

  if (HTMLFormElement.prototype.requestSubmit) {
    HTMLFormElement.prototype.requestSubmit = function () {
      zaehler.submitAufrufe += 1;
    };
  }

  // Neue Tabs gar nicht erst entstehen lassen: Ein Klick, der eine Aktionsseite
  // oeffnen wuerde, wird gezaehlt und verworfen. Damit kann keine Seite
  // entstehen, die vom Waechter nichts weiss.
  const urspruenglichOeffnen = window.open;
  window.open = function () {
    zaehler.fenster += 1;
    return null;
  };
})();
`;

/**
 * Waechter fuer einen Tab einrichten.
 *
 * @returns {object} Bericht mit blockierten Anfragen, Formularen und Tabs
 */
async function bewache(connection, sessionId, index, optionen = {}) {
  const bericht = {
    anfragen: [],
    formulare: 0,
    submitAufrufe: 0,
    fenster: 0,
    tabs: [],
    erlaubteGet: 0,
  };
  const statistik = { dokumente: 0, assets: 0, unbekannt: [] };

  // 1. Formulare: Skript vor dem Seitenaufbau einsetzen
  await connection
    .send("Page.addScriptToEvaluateOnNewDocument", { source: WaechterSkript }, sessionId)
    .catch(() => {});

  // 2. Anfragen: GET/HEAD aus den Fixtures, alles andere abweisen
  await connection.send(
    "Fetch.enable",
    { patterns: [{ urlPattern: "*otrs.staff.hsrw*", requestStage: "Request" }] },
    sessionId
  );

  connection.on(
    "Fetch.requestPaused",
    async (params) => {
      const methode = (params.request.method || "GET").toUpperCase();
      const url = params.request.url;

      if (methode === "GET" || methode === "HEAD") {
        bericht.erlaubteGet += 1;
        return bedieneAnfrage(connection, sessionId, index, params, statistik, optionen.stumm === true);
      }

      bericht.anfragen.push({ methode, url });
      try {
        await connection.send(
          "Fetch.failRequest",
          { requestId: params.requestId, errorReason: "Aborted" },
          sessionId
        );
      } catch {
        /* Tab schon zu */
      }
    },
    sessionId
  );

  return {
    bericht,
    statistik,
    /** Stand der Zaehler aus der Seite holen (Formulare). */
    async aktualisiere() {
      try {
        const werte = await connection.send(
          "Runtime.evaluate",
          {
            expression: "window.__zhWaechter ? JSON.stringify(window.__zhWaechter) : ''",
            returnByValue: true,
          },
          sessionId
        );
        const roh = werte.result && werte.result.value;
        if (roh) {
          const zahlen = JSON.parse(roh);
          bericht.formulare = Math.max(bericht.formulare, zahlen.formulare || 0);
          bericht.submitAufrufe = Math.max(bericht.submitAufrufe, zahlen.submitAufrufe || 0);
          bericht.fenster = Math.max(bericht.fenster, zahlen.fenster || 0);
        }
      } catch {
        /* Seite weg */
      }
      return bericht;
    },
    async abmelden() {
      await connection.send("Page.removeScriptToEvaluateOnNewDocument", {}, sessionId).catch(() => {});
      await connection.send("Fetch.disable", {}, sessionId).catch(() => {});
    },
  };
}

/**
 * Neue Tabs nachtraeglich aufspueren.
 *
 * Bewusst nicht ueber Target.setDiscoverTargets: Dieses Ereignis feuert auch
 * fuer die Seiten, die der Test selbst anlegt - ein sofortiges Schliessen
 * haette den eigenen Tab erwischt (und den Lauf zum Haengen gebracht). Das
 * Oeffnen neuer Tabs verhindert bereits das Waechter-Skript (window.open);
 * diese Pruefung ist das Sicherheitsnetz fuer alles, was daran vorbeigeht.
 */
async function findeFremdeTabs(connection, eigeneTargets = []) {
  const erlaubt = new Set(eigeneTargets.filter(Boolean));
  const { targetInfos } = await connection.send("Target.getTargets");
  const fremde = targetInfos.filter(
    (target) =>
      target.type === "page" &&
      !erlaubt.has(target.targetId) &&
      !target.url.startsWith("chrome-extension://") &&
      target.url !== "chrome://newtab/" &&
      target.url !== "about:blank"
  );
  for (const target of fremde) {
    await connection.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  }
  return fremde.map((target) => ({ url: target.url }));
}

module.exports = { bewache, findeFremdeTabs, WaechterSkript };
