"use strict";

/**
 * Echte Znuny-Seiten aufnehmen und als Fixture ablegen.
 *
 * Wichtig: Beim Aufnehmen wird die Erweiterung ABSICHTLICH NICHT geladen.
 * Dadurch enthaelt die Aufnahme reines Znuny-Markup (nach Ausfuehrung der
 * Znuny-Skripte) und keine eingehngten Elemente des Helfers - sonst wuerde
 * der Rauchtest seine eigene Oberflaeche mitbringen.
 *
 * Anmeldung: Der Aufruf benutzt das Profil .browser-profile/. Dort meldet man
 * sich einmal ueber "--login" von Hand an; die Sitzung bleibt gespeichert. Das
 * Addon bekommt dadurch keine Zugangsdaten zu sehen, und es muessen keine
 * Passwoerter im Skript stehen.
 *
 * Aufrufe:
 *   node tools/browser/capture.js --login
 *   node tools/browser/capture.js                      (alle Seiten aus fixtures.json)
 *   node tools/browser/capture.js --nur=agent-ticket-zoom
 *   node tools/browser/capture.js --uebernehmen        (Aufnahmen als Fixture einsetzen)
 *   node tools/browser/capture.js --headful            (Fenster zeigen)
 */

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const { startChrome, REPO_ROOT } = require("./launch.js");
const { CdpConnection, CdpPage } = require("./cdp.js");
const { ladeIndex, FIXTURE_DIR } = require("./fixtures.js");

const PROFIL = path.join(REPO_ROOT, ".browser-profile");
const AUFNAHME = path.join(FIXTURE_DIR, "aufnahme");
const STARTSEITE = "https://otrs.staff.hsrw/otrs/index.pl";

function argumente() {
  const optionen = {
    login: false,
    headful: false,
    uebernehmen: false,
    nur: null,
    settle: 2500,
    dauer: 0,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--login") optionen.login = true;
    else if (arg === "--headful") optionen.headful = true;
    else if (arg === "--uebernehmen") optionen.uebernehmen = true;
    else if (arg.startsWith("--nur=")) optionen.nur = arg.slice("--nur=".length);
    else if (arg.startsWith("--settle=")) optionen.settle = Number(arg.slice("--settle=".length));
    else if (arg.startsWith("--dauer=")) optionen.dauer = Number(arg.slice("--dauer=".length));
    else if (arg.startsWith("--basis=")) optionen.basis = arg.slice("--basis=".length).replace(/\/$/, "");
  }
  return optionen;
}

function warteAufEingabe(text, fallbackSekunden) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || fallbackSekunden > 0) {
      const sekunden = fallbackSekunden || 300;
      console.log(`${text} (kein Terminal erkannt - warte ${sekunden} s)`);
      setTimeout(resolve, sekunden * 1000);
      return;
    }
    const schnittstelle = readline.createInterface({ input: process.stdin, output: process.stdout });
    schnittstelle.question(text, () => {
      schnittstelle.close();
      resolve();
    });
  });
}

async function loginModus(optionen) {
  console.log(`Profil: ${PROFIL}`);
  const chrome = await startChrome({
    headless: false,
    extension: false,
    userDataDir: PROFIL,
  });
  const connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);
  const page = await CdpPage.create(connection, "about:blank");
  await page.goto(STARTSEITE, { settleMs: 1500 }).catch(() => {});

  console.log("");
  console.log("Im geoeffneten Fenster jetzt im Znuny anmelden.");
  console.log("Danach hier Enter druecken - die Sitzung bleibt im Profil gespeichert.");
  console.log("");
  await warteAufEingabe("Fertig? Enter zum Fortsetzen ... ", optionen.dauer);

  connection.close();
  await chrome.stop();
  console.log("Profil gespeichert. Naechster Schritt: node tools/browser/capture.js");
}

async function aufnehmen(optionen) {
  if (!fs.existsSync(PROFIL)) {
    console.error(
      `Kein Profil gefunden: ${PROFIL}\nZuerst anmelden: node tools/browser/capture.js --login`
    );
    process.exit(2);
  }

  const index = ladeIndex();
  const seiten = index.seiten.filter((seite) => !optionen.nur || seite.name === optionen.nur);
  if (!seiten.length) {
    console.error(`Keine Seite passt zu --nur=${optionen.nur}`);
    process.exit(2);
  }

  fs.mkdirSync(AUFNAHME, { recursive: true });

  const chrome = await startChrome({
    headless: !optionen.headful,
    extension: false,
    userDataDir: PROFIL,
  });
  const connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);
  let probleme = 0;

  try {
    for (const seite of seiten) {
      const page = await CdpPage.create(connection, "about:blank");
      const bericht = [];
      // --basis erlaubt eine andere Herkunft (z. B. ein lokaler Testserver),
      // damit sich der Aufnahme-Weg auch ohne Znuny-Zugang pruefen laesst.
      const zielUrl = optionen.basis
        ? seite.url.replace("https://otrs.staff.hsrw", optionen.basis)
        : seite.url;
      try {
        await page.goto(zielUrl, { settleMs: optionen.settle, timeoutMs: 45000 });

        const html = await page.html();
        const titel = await page.evaluate("document.title");
        const anmeldeseite = /Anmeldung|Login|Sign in/i.test(titel) || (await page.evaluate(
          "Boolean(document.querySelector('input[type=\"password\"]'))"
        ));

        const dateiName = `${seite.name}.html`;
        const ziel = path.join(AUFNAHME, dateiName);
        fs.writeFileSync(ziel, html, "utf8");

        const protokoll = page.consoleEntries
          .map((eintrag) => `[${eintrag.type}] ${eintrag.text}`)
          .join("\n");
        fs.writeFileSync(path.join(AUFNAHME, `${seite.name}.console.txt`), protokoll, "utf8");

        await page.screenshot(path.join(AUFNAHME, `${seite.name}.png`));

        bericht.push(`  ${seite.name}: ${html.length} Zeichen, Titel "${titel}"`);
        bericht.push(`  gespeichert: ${path.relative(REPO_ROOT, ziel)}`);
        if (anmeldeseite) {
          probleme += 1;
          bericht.push("  ! Sieht nach Anmeldeseite aus - bitte zuerst --login ausfuehren.");
        }
        if (page.exceptions.length) {
          bericht.push(`  ! ${page.exceptions.length} Exception(s) auf der Seite:`);
          for (const exception of page.exceptions.slice(0, 5)) {
            bericht.push(`    ${exception.text} ${(exception.description || "").slice(0, 160)}`);
          }
        }

        if (optionen.uebernehmen && !anmeldeseite) {
          const zielDatei = path.join(FIXTURE_DIR, seite.datei);
          fs.copyFileSync(ziel, zielDatei);
          seite.quelle = `Aufnahme ${new Date().toISOString().slice(0, 10)}`;
          bericht.push(`  uebernommen als ${seite.datei}`);
        }
      } catch (error) {
        probleme += 1;
        bericht.push(`  ! ${seite.name}: ${error.message}`);
      } finally {
        await page.dispose();
      }
      console.log(bericht.join("\n"));
      console.log("");
    }
  } finally {
    connection.close();
    await chrome.stop();
  }

  if (optionen.uebernehmen) {
    // Nur die Felder schreiben, die in die Datei gehoeren: ladeIndex() haengt
    // absolute Pfade (pfad) an und baut aus folgeseiten eine Map - beides
    // wuerde sonst maschinenabhaengig bzw. leer in fixtures.json landen.
    const sauber = {
      hinweis: index.hinweis,
      seiten: index.seiten.map((eintrag) => {
        const kopie = { ...eintrag };
        delete kopie.pfad;
        return kopie;
      }),
    };
    fs.writeFileSync(
      path.join(FIXTURE_DIR, "fixtures.json"),
      `${JSON.stringify(sauber, null, 2)}\n`,
      "utf8"
    );
  }

  console.log(`ERGEBNIS: ${seiten.length - probleme} von ${seiten.length} Seiten aufgenommen.`);
  process.exit(probleme ? 1 : 0);
}

async function main() {
  const optionen = argumente();
  if (optionen.login) return loginModus(optionen);
  return aufnehmen(optionen);
}

main().catch((error) => {
  console.error("Aufnahme abgebrochen:", error.message);
  process.exit(1);
});
