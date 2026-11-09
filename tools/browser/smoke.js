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
 *   node tools/browser/smoke.js
 *   node tools/browser/smoke.js --headful          (Fenster zeigen)
 *   node tools/browser/smoke.js --nur=agent-ticket-zoom
 *   node tools/browser/smoke.js --settle=2500
 *
 * Rueckgabewert 1, sobald eine feste Erwartung verletzt ist.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { startChrome, loadExtension, REPO_ROOT } = require("./launch.js");
const { CdpConnection, CdpPage } = require("./cdp.js");
const { ladeIndex, bedieneAusFixtures } = require("./fixtures.js");

const AUSGABE = path.join(__dirname, "output");

function argumente() {
  const optionen = { headful: false, nur: null, settle: 1500, chrome: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--headful") optionen.headful = true;
    else if (arg.startsWith("--nur=")) optionen.nur = arg.slice("--nur=".length);
    else if (arg.startsWith("--settle=")) optionen.settle = Number(arg.slice("--settle=".length));
    else if (arg.startsWith("--chrome=")) optionen.chrome = arg.slice("--chrome=".length);
  }
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

async function schliesseFremdeTabs(connection) {
  const { targetInfos } = await connection.send("Target.getTargets");
  for (const target of targetInfos) {
    if (target.type !== "page") continue;
    if (!target.url.startsWith("chrome-extension://")) continue;
    await connection.send("Target.closeTarget", { targetId: target.targetId }).catch(() => {});
  }
}

async function pruefeSeite(connection, seite, optionen) {
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
  };

  try {
    await page.goto(seite.url, { settleMs: optionen.settle, timeoutMs: 30000 });

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
  } catch (error) {
    ergebnis.exceptions.push({ text: `Ablauf abgebrochen: ${error.message}`, description: "" });
  } finally {
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

  try {
    const id = await loadExtension(connection, path.join(REPO_ROOT, "znuny-helper-extension"));
    console.log(`Chrome ${chrome.version["Browser"]} - Erweiterung ${id}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await schliesseFremdeTabs(connection);

    for (const seite of seiten) {
      const ergebnis = await pruefeSeite(connection, seite, optionen);
      const fehler = bewerte(ergebnis);

      console.log("");
      console.log(`${fehler.length ? "FEHLER" : "ok    "}  ${seite.name}  (${seite.beschreibung})`);
      console.log(`        ${seite.url}`);
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

      if (fehler.length) gescheitert += 1;
    }
  } finally {
    connection.close();
    await chrome.stop();
    await new Promise((resolve) => setTimeout(resolve, 500));
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
