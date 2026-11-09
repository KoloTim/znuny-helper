"use strict";

/**
 * Klick-Tests: echte Bedienung der Erweiterung gegen die Fixtures.
 *
 * Geklickt wird mit echten Mausereignissen (Input.dispatchMouseEvent), getippt
 * mit Input.insertText - die Erweiterung muss also genau so reagieren wie im
 * Alltag. Gleichzeitig sichert der Waechter (guard.js) zu, dass dabei nichts
 * ins Ticketsystem geschrieben wird: schreibende Anfragen werden abgewiesen,
 * Formulare abgefangen, neue Tabs sofort geschlossen.
 *
 * Aufruf:
 *   node tools/browser/clicks.js
 *   node tools/browser/clicks.js --sichtbar
 *   node tools/browser/clicks.js --nur=kategorie-setzen
 *   node tools/browser/clicks.js --aufzeichnen=tools/browser/output/klicks
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { startChrome, loadExtension, REPO_ROOT } = require("./launch.js");
const { CdpConnection, CdpPage } = require("./cdp.js");
const { ladeIndex } = require("./fixtures.js");
const { bewache, findeFremdeTabs } = require("./guard.js");
const { starteAufzeichnung, schreibePlayer } = require("./screencast.js");

const AUSGABE = path.join(__dirname, "output");

function argumente() {
  const optionen = { headful: false, sichtbar: false, nur: null, langsam: 0, aufzeichnen: null, max: 180000 };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--headful") optionen.headful = true;
    else if (arg === "--sichtbar") {
      optionen.sichtbar = true;
      optionen.headful = true;
    } else if (arg.startsWith("--nur=")) optionen.nur = arg.slice("--nur=".length);
    else if (arg.startsWith("--langsam=")) optionen.langsam = Number(arg.slice("--langsam=".length));
    else if (arg.startsWith("--max=")) optionen.max = Number(arg.slice("--max=".length));
    else if (arg.startsWith("--aufzeichnen="))
      optionen.aufzeichnen = path.resolve(REPO_ROOT, arg.slice("--aufzeichnen=".length));
  }
  if (optionen.sichtbar && !optionen.langsam) optionen.langsam = 1200;
  return optionen;
}

const schlafe = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bedien- und Pruefhilfen, die ein Szenario benutzt. */
function macheWerkzeuge(connection, page, optionen) {
  const pruefungen = [];
  const protokoll = [];

  const notiere = (beschreibung, ok, detail) => {
    pruefungen.push({ beschreibung, ok: Boolean(ok), detail });
    console.log(`        ${ok ? "ok " : "!! "} ${beschreibung}${detail ? ` - ${detail}` : ""}`);
  };

  const findePunkt = async (selektor, text) => {
    const ausdruck = `(() => {
      const kandidaten = [...document.querySelectorAll(${JSON.stringify(selektor)})];
      const ziel = ${
        text === undefined
          ? "kandidaten[0]"
          : `kandidaten.find((el) => (el.textContent || "").trim() === ${JSON.stringify(text)})`
      };
      if (!ziel) return null;
      ziel.scrollIntoView({ block: "center", inline: "center" });
      const r = ziel.getBoundingClientRect();
      if (!r.width && !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`;
    return page.evaluate(ausdruck);
  };

  const werkzeuge = {
    page,
    verbindung: connection,

    async evalJs(ausdruck) {
      return page.evaluate(ausdruck);
    },

    async text(selektor) {
      return page.evaluate(
        `(document.querySelector(${JSON.stringify(selektor)}) || {}).textContent || ""`
      );
    },

    async anzahl(selektor) {
      return page.evaluate(`document.querySelectorAll(${JSON.stringify(selektor)}).length`);
    },

    warte: schlafe,

    /**
     * Auf einen Zustand warten statt auf eine feste Zeit. Die Erweiterung
     * speichert asynchron und zeichnet danach neu - feste Pausen sind je nach
     * Rechner manchmal zu kurz.
     */
    async warteAuf(ausdruck, zeitlimitMs = 2500) {
      const ende = Date.now() + zeitlimitMs;
      while (Date.now() < ende) {
        try {
          if (await page.evaluate(`Boolean(${ausdruck})`)) return true;
        } catch {
          /* Seite im Umbau */
        }
        await schlafe(100);
      }
      return false;
    },

    /** Echter Mausklick auf das erste passende Element. */
    async klick(selektor, text) {
      const punkt = await findePunkt(selektor, text);
      if (!punkt) throw new Error(`nicht klickbar: ${selektor}${text ? ` ("${text}")` : ""}`);
      protokoll.push(`Klick auf ${selektor}${text ? ` [${text}]` : ""}`);
      await connection.send(
        "Input.dispatchMouseEvent",
        { type: "mouseMoved", x: punkt.x, y: punkt.y, button: "none" },
        page.sessionId
      );
      await connection.send(
        "Input.dispatchMouseEvent",
        { type: "mousePressed", x: punkt.x, y: punkt.y, button: "left", clickCount: 1 },
        page.sessionId
      );
      await connection.send(
        "Input.dispatchMouseEvent",
        { type: "mouseReleased", x: punkt.x, y: punkt.y, button: "left", clickCount: 1 },
        page.sessionId
      );
      await schlafe(120);
    },

    async klickText(selektor, text) {
      return werkzeuge.klick(selektor, text);
    },

    /** Auswahlfeld setzen (Wert + change-Ereignis). */
    async waehle(selektor, wert) {
      protokoll.push(`Auswahl ${selektor} = ${wert}`);
      const ok = await page.evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(selektor)});
        if (!el) return false;
        el.value = ${JSON.stringify(wert)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`);
      if (!ok) throw new Error(`Auswahlfeld fehlt: ${selektor}`);
      await schlafe(150);
    },

    /** In ein Feld tippen: erst hineinklicken, dann Text einfuegen. */
    async tippe(selektor, text) {
      await werkzeuge.klick(selektor);
      protokoll.push(`Tippen in ${selektor}: "${text}"`);
      await connection.send("Input.insertText", { text }, page.sessionId);
      await schlafe(200);
    },

    /** Taste druecken, optional mit Modifikatoren. */
    async taste(taste, modifikatoren = {}) {
      const codes = { Enter: 13, Escape: 27, Tab: 9, ArrowDown: 40, ArrowUp: 38 };
      const mods = (modifikatoren.alt ? 1 : 0) + (modifikatoren.ctrl ? 2 : 0) +
        (modifikatoren.meta ? 4 : 0) + (modifikatoren.shift ? 8 : 0);
      protokoll.push(`Taste ${taste}${mods ? ` (Modifikatoren ${mods})` : ""}`);
      const basis = {
        key: taste,
        code: taste,
        windowsVirtualKeyCode: codes[taste] || 0,
        modifiers: mods,
      };
      await connection.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...basis }, page.sessionId);
      await connection.send("Input.dispatchKeyEvent", { type: "keyUp", ...basis }, page.sessionId);
      await schlafe(250);
    },

    // ---- Pruefungen ----
    pruefe: notiere,

    async erwarte(selektor, beschreibung) {
      const anzahl = await werkzeuge.anzahl(selektor);
      notiere(beschreibung || `${selektor} vorhanden`, anzahl > 0, `${anzahl} gefunden`);
      return anzahl;
    },

    async erwarteNicht(selektor, beschreibung) {
      const anzahl = await werkzeuge.anzahl(selektor);
      notiere(beschreibung || `${selektor} nicht mehr vorhanden`, anzahl === 0, `${anzahl} gefunden`);
      return anzahl;
    },

    async erwarteText(selektor, teil, beschreibung) {
      const inhalt = (await werkzeuge.text(selektor)).trim();
      const ok = inhalt.includes(teil);
      notiere(beschreibung || `${selektor} enthaelt "${teil}"`, ok, `war: "${inhalt.slice(0, 80)}"`);
      return ok;
    },

    async erwarteWert(selektor, teil, beschreibung) {
      const wert = await page.evaluate(
        `(document.querySelector(${JSON.stringify(selektor)}) || {}).value || ""`
      );
      const ok = String(wert).includes(teil);
      notiere(beschreibung || `${selektor} hat Wert "${teil}"`, ok, `war: "${wert}"`);
      return ok;
    },
  };

  return { werkzeuge, pruefungen, protokoll, notiere };
}

async function fahreSzenario(connection, index, szenario, optionen) {
  const seite = index.seiten.find((eintrag) => eintrag.name === szenario.seite);
  if (!seite) throw new Error(`Unbekannte Fixture-Seite: ${szenario.seite}`);

  const page = await CdpPage.create(connection, "about:blank");
  const waechter = await bewache(connection, page.sessionId, index);
  const { werkzeuge, pruefungen, protokoll } = macheWerkzeuge(connection, page, optionen);

  const ergebnis = { szenario, pruefungen, protokoll, fehler: [], aufnahme: null };
  let aufzeichnung = null;

  try {
    if (optionen.aufzeichnen) {
      aufzeichnung = await starteAufzeichnung(
        connection,
        page.sessionId,
        path.join(optionen.aufzeichnen, szenario.name)
      );
    }

    await page.goto(seite.url, { settleMs: 1800, timeoutMs: 30000 });
    console.log(`        Seite: ${seite.name}`);

    await szenario.schritte(werkzeuge);

    // Zaehler aus der Seite nachziehen (Formulare)
    await waechter.aktualisiere();
    if (page.exceptions.length) {
      for (const exception of page.exceptions) {
        ergebnis.fehler.push(`Exception: ${exception.text} ${(exception.description || "").slice(0, 200)}`);
      }
    }

    fs.mkdirSync(AUSGABE, { recursive: true });
    const bild = path.join(AUSGABE, `klick-${szenario.name}.png`);
    await page.screenshot(bild);
    ergebnis.screenshot = bild;
    if (aufzeichnung) aufzeichnung.ergaenzeBild(bild, "png");

    if (optionen.headful) {
      await connection.send("Page.bringToFront", {}, page.sessionId).catch(() => {});
    }
    if (optionen.langsam) await schlafe(optionen.langsam);
  } catch (error) {
    ergebnis.fehler.push(error.message);
  } finally {
    await waechter.aktualisiere();
    ergebnis.waechter = waechter.bericht;
    ergebnis.angefordert = waechter.statistik.dokumente;
    if (aufzeichnung) {
      const bilder = await aufzeichnung.stoppe();
      ergebnis.aufnahme = {
        name: szenario.name,
        beschreibung: szenario.beschreibung,
        ordner: szenario.name,
        bilder,
      };
    }
    await page.dispose();
  }

  return ergebnis;
}

function bewerte(ergebnis) {
  const fehler = [...ergebnis.fehler];
  for (const pruefung of ergebnis.pruefungen) {
    if (!pruefung.ok) fehler.push(`Pruefung fehlgeschlagen: ${pruefung.beschreibung}`);
  }
  return fehler;
}

function berichte(ergebnis) {
  const fehler = bewerte(ergebnis);
  const w = ergebnis.waechter || {};
  console.log("");
  console.log(`${fehler.length ? "FEHLER" : "ok    "}  ${ergebnis.szenario.name}  (${ergebnis.szenario.beschreibung})`);
  console.log(
    `        Waechter: ${w.formulare || 0} Formular(e) abgefangen, ${w.submitAufrufe || 0} submit()-Aufruf(e), ` +
      `${(w.anfragen || []).length} schreibende Anfrage(n) abgewiesen, ${(w.tabs || []).length} neuer Tab`
  );
  for (const anfrage of (w.anfragen || []).slice(0, 5)) {
    console.log(`        ! ${anfrage.methode} ${anfrage.url.slice(0, 110)}`);
  }
  if ((w.tabs || []).length) {
    // Ehrlich benannt: Der Waechter hat den Tab geschlossen, aber entstanden
    // ist er. Ein GET auf eine Aktionsseite ist kein Schreibzugriff - trotzdem
    // gehoert das in den Bericht.
    console.log(`        ! Achtung: ${w.tabs.length} Tab(s) entstanden und sofort geschlossen:`);
    for (const tab of w.tabs.slice(0, 5)) {
      console.log(`          ${(tab.url || "(noch ohne Adresse)").slice(0, 110)}`);
    }
  }
  for (const meldung of fehler) console.log(`        ! ${meldung}`);
  if (ergebnis.screenshot) {
    console.log(`        Screenshot: ${path.relative(REPO_ROOT, ergebnis.screenshot)}`);
  }
  return fehler;
}

async function main() {
  const optionen = argumente();
  const index = ladeIndex();
  const szenarienModul = require(path.join(REPO_ROOT, "tools", "fixtures", "clicks.js"));
  const alle = szenarienModul.szenarien || [];
  const szenarien = alle.filter((eintrag) => !optionen.nur || eintrag.name === optionen.nur);

  if (!szenarien.length) {
    console.error(`Kein Szenario passt zu --nur=${optionen.nur}`);
    process.exit(2);
  }

  const profil = fs.mkdtempSync(path.join(os.tmpdir(), "zh-klick-"));
  // Notbremse: ein haengender Lauf darf nicht ewig laufen.
  const notbremse = setTimeout(() => {
    console.error(`Zeitlimit erreicht (${optionen.max} ms) - Abbruch.`);
    process.exit(1);
  }, optionen.max);

  const chrome = await startChrome({
    headless: !optionen.headful,
    extension: false,
    userDataDir: profil,
    args: ["--no-sandbox"],
  });
  const connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);

  let gescheitert = 0;
  const aufnahmen = [];

  try {
    const id = await loadExtension(connection, path.join(REPO_ROOT, "znuny-helper-extension"));
    console.log(`Chrome ${chrome.version["Browser"]} - Erweiterung ${id}`);
    console.log("Waechter aktiv: schreibende Anfragen gesperrt, Formulare abgefangen, neue Tabs geschlossen.");
    await schlafe(600);

    // Willkommensseite schliessen; neue Tabs werden vom Waechter-Skript
    // verhindert und nach jedem Szenario zusaetzlich aufgespuert.
    const { targetInfos } = await connection.send("Target.getTargets");
    const eigene = [];
    for (const target of targetInfos) {
      if (target.type === "page" && target.url.startsWith("chrome-extension://")) {
        await connection.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
      } else if (target.type === "page") {
        eigene.push(target.targetId);
      }
    }

    for (const szenario of szenarien) {
      console.log("");
      console.log(`--- ${szenario.name}: ${szenario.beschreibung}`);
      const ergebnis = await fahreSzenario(connection, index, szenario, optionen);
      // Sicherheitsnetz: falls doch ein Tab entstanden ist, jetzt schliessen
      const fremde = await findeFremdeTabs(connection, eigene);
      ergebnis.waechter.tabs = fremde;
      if (ergebnis.aufnahme) aufnahmen.push(ergebnis.aufnahme);
      const fehler = berichte(ergebnis);
      if (fehler.length) gescheitert += 1;
    }

    if (optionen.aufzeichnen && aufnahmen.length) {
      const ziel = path.join(optionen.aufzeichnen, "index.html");
      schreibePlayer(ziel, aufnahmen);
      console.log("");
      console.log(`Aufzeichnung: ${path.relative(REPO_ROOT, ziel)}`);
    }
  } finally {
    clearTimeout(notbremse);
    connection.close();
    await chrome.stop();
    await schlafe(400);
    fs.rmSync(profil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }

  console.log("");
  if (gescheitert) {
    console.log(`ERGEBNIS: ${gescheitert} von ${szenarien.length} Szenarien fehlgeschlagen.`);
    process.exit(1);
  }
  console.log(`ERGEBNIS: alle ${szenarien.length} Szenarien in Ordnung.`);
}

main().catch((error) => {
  console.error("Klick-Tests abgebrochen:", error.message);
  process.exit(1);
});
