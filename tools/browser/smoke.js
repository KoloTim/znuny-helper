"use strict";

/**
 * Rauchtest gegen Fixtures: Die Erweiterung wird in Chrome geladen, die
 * Znuny-Adressen werden aus tools/fixtures/ bedient. Geprueft wird je Seite:
 *
 *   1. Der Content-Script meldet sich ("Znuny Helper <Version> aktiv").
 *   2. Es wurde keine Exception geworfen.
 *   3. Die als "fest" hinterlegten Elemente existieren (z. B. Kategorie-Spalte
 *      in der Ticketliste, Artikelsuche im Ticket).
 *   4. Als "beobachtet" hinterlegte Elemente werden nur berichtet.
 *
 * Zusaetzlich entsteht je Seite ein Screenshot unter tools/browser/output/.
 *
 * Aufruf:
 *   node tools/browser/smoke.js                      (still, fuer CI)
 *   node tools/browser/smoke.js --sichtbar           (Fenster, langsam, bleibt offen)
 *   node tools/browser/smoke.js --headful            (Fenster, ohne Pausen)
 *   node tools/browser/smoke.js --aufzeichnen=<dir>  (Bilderfolge + Abspielseite)
 *   node tools/browser/smoke.js --nur=agent-ticket-zoom
 *   node tools/browser/smoke.js --settle=2500        (laenger warten)
 *
 * Rueckgabewert 1, sobald eine feste Erwartung verletzt ist.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const { startChrome, loadExtension, REPO_ROOT } = require("./launch.js");
const { CdpConnection, CdpPage } = require("./cdp.js");
const { ladeIndex, bedieneAusFixtures } = require("./fixtures.js");
const { starteAufzeichnung, schreibePlayer } = require("./screencast.js");

const AUSGABE = path.join(__dirname, "output");

function argumente() {
  const optionen = {
    headful: false,
    sichtbar: false,
    bleiben: false,
    nur: null,
    settle: 1500,
    settleGesetzt: false,
    langsam: 0,
    chrome: null,
    aufzeichnen: null,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--headful") optionen.headful = true;
    else if (arg === "--sichtbar") {
      optionen.sichtbar = true;
      optionen.headful = true;
    } else if (arg === "--bleiben") optionen.bleiben = true;
    else if (arg.startsWith("--nur=")) optionen.nur = arg.slice("--nur=".length);
    else if (arg.startsWith("--settle=")) {
      optionen.settle = Number(arg.slice("--settle=".length));
      optionen.settleGesetzt = true;
    } else if (arg.startsWith("--langsam=")) optionen.langsam = Number(arg.slice("--langsam=".length));
    else if (arg.startsWith("--chrome=")) optionen.chrome = arg.slice("--chrome=".length);
    else if (arg.startsWith("--aufzeichnen="))
      optionen.aufzeichnen = path.resolve(REPO_ROOT, arg.slice("--aufzeichnen=".length));
  }

  // Sichtbar heisst: Zeit zum Hinsehen. Ohne ausdrueckliche Angabe laenger warten.
  if (optionen.sichtbar && !optionen.settleGesetzt) optionen.settle = 2500;
  if (optionen.sichtbar && !optionen.langsam) optionen.langsam = 2200;
  return optionen;
}

/**
 * Chrome gibt Dateien des Profils erst frei, wenn die letzten Unterprozesse
 * beendet sind. Ein fehlgeschlagenes Loeschen darf den Test nicht kippen -
 * das Verzeichnis liegt im Temp-Ordner und wird vom System aufgeraeumt.
 */
async function entferneProfil(verzeichnis) {
  for (let versuch = 0; versuch < 10; versuch++) {
    try {
      fs.rmSync(verzeichnis, { recursive: true, force: true });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  return false;
}

function schlafe(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function warteAufEingabe(text) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      setTimeout(resolve, 180000);
      return;
    }
    const schnittstelle = readline.createInterface({ input: process.stdin, output: process.stdout });
    schnittstelle.question(text, () => {
      schnittstelle.close();
      resolve();
    });
  });
}

async function schliesseFremdeTabs(connection) {
  const { targetInfos } = await connection.send("Target.getTargets");
  for (const target of targetInfos) {
    if (target.type !== "page") continue;
    if (!target.url.startsWith("chrome-extension://")) continue;
    await connection.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  }
}

async function pruefeSeite(connection, seite, optionen, nummer, gesamt) {
  const page = await CdpPage.create(connection, "about:blank");
  await connection.send(
    "Fetch.enable",
    { patterns: [{ urlPattern: "*otrs.staff.hsrw*", requestStage: "Request" }] },
    page.sessionId
  );
  const statistik = bedieneAusFixtures(connection, page.sessionId, optionen.index);

  const ergebnis = {
    seite,
    log: false,
    logText: "",
    exceptions: [],
    fest: [],
    beobachtet: [],
    zhElemente: 0,
    screenshot: null,
    aufnahme: null,
  };

  console.log("");
  console.log(`[${nummer}/${gesamt}] ${seite.name} - ${seite.beschreibung}`);
  console.log(`        oeffne ${seite.url}`);

  let aufzeichnung = null;
  try {
    if (optionen.aufzeichnen) {
      aufzeichnung = await starteAufzeichnung(
        connection,
        page.sessionId,
        path.join(optionen.aufzeichnen, seite.name)
      );
    }

    await page.goto(seite.url, { settleMs: optionen.settle, timeoutMs: 30000 });
    console.log("        Seite geladen - lese DOM und Erweiterungsoberflaeche");

    const logs = page.helperLogs();
    ergebnis.log = logs.length > 0;
    ergebnis.logText = logs.length ? logs[0].text : "";
    ergebnis.exceptions = page.exceptions.slice();

    const zaehle = async (selektoren) => {
      if (!selektoren.length) return [];
      return page.evaluate(`(() => {
        const selektoren = ${JSON.stringify(selektoren)};
        return selektoren.map((s) => {
          try { return { selektor: s, anzahl: document.querySelectorAll(s).length }; }
          catch (error) { return { selektor: s, anzahl: -1, fehler: String(error) }; }
        });
      })()`);
    };

    ergebnis.fest = await zaehle(seite.fest || []);
    ergebnis.beobachtet = await zaehle(seite.beobachtet || []);

    ergebnis.zhElemente = await page.evaluate(
      `document.querySelectorAll('[class*="zh-"], [id^="zh-"], [data-zh-article-action-url]').length`
    );

    fs.mkdirSync(AUSGABE, { recursive: true });
    ergebnis.screenshot = path.join(AUSGABE, `${seite.name}.png`);
    await page.screenshot(ergebnis.screenshot);

    // Das scharfe Schlussbild in die Aufzeichnung uebernehmen
    if (aufzeichnung) aufzeichnung.ergaenzeBild(ergebnis.screenshot, "png");

    if (optionen.headful) {
      await connection.send("Page.bringToFront", {}, page.sessionId).catch(() => {});
    }
    if (optionen.langsam) await schlafe(optionen.langsam);
  } catch (error) {
    ergebnis.exceptions.push({ text: `Ablauf abgebrochen: ${error.message}`, description: "" });
  } finally {
    if (aufzeichnung) {
      const bilder = await aufzeichnung.stoppe();
      ergebnis.aufnahme = {
        name: seite.name,
        beschreibung: seite.beschreibung,
        ordner: seite.name,
        bilder,
      };
      console.log(`        aufgezeichnet: ${bilder.length} Bilder`);
    }
    ergebnis.angefordert = statistik.dokumente;
    await page.dispose();
  }

  return ergebnis;
}

function bewerte(ergebnis) {
  const fehler = [];
  if (!ergebnis.log) fehler.push("Content-Script hat sich nicht gemeldet");
  for (const exception of ergebnis.exceptions) {
    fehler.push(`Exception: ${exception.text} ${exception.description || ""}`.trim());
  }
  for (const eintrag of ergebnis.fest) {
    if (eintrag.anzahl <= 0) fehler.push(`fehlt: ${eintrag.selektor}`);
  }
  return fehler;
}

function berichte(ergebnis) {
  const fehler = bewerte(ergebnis);
  console.log("");
  console.log(`${fehler.length ? "FEHLER" : "ok    "}  ${ergebnis.seite.name}  (${ergebnis.seite.beschreibung})`);
  console.log(
    `        Meldung: ${ergebnis.logText || "(keine)"} | zh-Elemente: ${ergebnis.zhElemente} | Dokumente bedient: ${ergebnis.angefordert}`
  );
  for (const eintrag of ergebnis.fest) {
    console.log(`        fest        ${eintrag.anzahl > 0 ? "ok " : "-- "} ${eintrag.selektor} (${eintrag.anzahl})`);
  }
  for (const eintrag of ergebnis.beobachtet) {
    console.log(`        beobachtet  ${eintrag.anzahl > 0 ? "ok " : "-- "} ${eintrag.selektor} (${eintrag.anzahl})`);
  }
  if (ergebnis.screenshot) console.log(`        Screenshot: ${path.relative(REPO_ROOT, ergebnis.screenshot)}`);
  for (const meldung of fehler) console.log(`        ! ${meldung}`);
  return fehler;
}

async function main() {
  const optionen = argumente();
  const index = ladeIndex();
  optionen.index = index;

  const seiten = index.seiten.filter((seite) => !optionen.nur || seite.name === optionen.nur);
  if (!seiten.length) {
    console.error(`Keine Seite passt zu --nur=${optionen.nur}`);
    process.exit(2);
  }

  const profil = fs.mkdtempSync(path.join(os.tmpdir(), "zh-smoke-"));
  const chrome = await startChrome({
    headless: !optionen.headful,
    extension: false,
    userDataDir: profil,
    chrome: optionen.chrome,
    args: ["--no-sandbox"],
  });

  const connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);
  let gescheitert = 0;
  const aufnahmen = [];

  try {
    const id = await loadExtension(connection, path.join(REPO_ROOT, "znuny-helper-extension"));
    console.log(`Chrome ${chrome.version["Browser"]} - Erweiterung ${id}`);
    console.log(
      optionen.headful
        ? "Fenster ist offen - die Seiten werden nacheinander geoeffnet."
        : "Ohne Fenster (headless). Fuer einen sichtbaren Lauf: --sichtbar"
    );
    await schlafe(500);
    await schliesseFremdeTabs(connection);

    for (let lauf = 0; lauf < seiten.length; lauf += 1) {
      const ergebnis = await pruefeSeite(connection, seiten[lauf], optionen, lauf + 1, seiten.length);
      const fehler = berichte(ergebnis);
      if (ergebnis.aufnahme) aufnahmen.push(ergebnis.aufnahme);
      if (fehler.length) gescheitert += 1;
    }

    if (optionen.aufzeichnen && aufnahmen.length) {
      const ziel = path.join(optionen.aufzeichnen, "index.html");
      const folien = schreibePlayer(ziel, aufnahmen);
      console.log("");
      console.log(`Aufzeichnung: ${folien} Bilder - Abspielseite:`);
      console.log(`  ${path.relative(REPO_ROOT, ziel)}`);
    }

    if (optionen.bleiben) {
      console.log("");
      console.log("Fenster bleibt offen. Enter beendet den Lauf.");
      await warteAufEingabe("Weiter mit Enter ... ");
    }
  } finally {
    connection.close();
    await chrome.stop();
    await schlafe(500);
    if (!(await entferneProfil(profil))) {
      console.log(`(Hinweis: Temp-Profil konnte noch nicht geloescht werden: ${profil})`);
    }
  }

  console.log("");
  if (gescheitert) {
    console.log(`ERGEBNIS: ${gescheitert} von ${seiten.length} Seiten fehlgeschlagen.`);
    process.exit(1);
  }
  console.log(`ERGEBNIS: alle ${seiten.length} Seiten in Ordnung.`);
}

main().catch((error) => {
  console.error("Rauchtest abgebrochen:", error.message);
  process.exit(1);
});
