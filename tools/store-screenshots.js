"use strict";
// Store-Screenshots 1280x800 aus den Fixtures (synthetische Daten).
const path = require("node:path");
const fs = require("node:fs");
const { startChrome, loadExtension, REPO_ROOT } = require("./browser/launch.js");
const { CdpConnection, CdpPage } = require("./browser/cdp.js");
const { ladeIndex, bedieneAusFixtures } = require("./browser/fixtures.js");

const ZIEL = path.join(REPO_ROOT, "store", "screenshots");

(async () => {
  let chrome = null;
  let connection = null;
  try {
    fs.mkdirSync(ZIEL, { recursive: true });
    const index = ladeIndex();
    chrome = await startChrome({ headless: true, extension: false, userDataDir: path.join(REPO_ROOT, ".browser-profile-store"), args: ["--no-sandbox"], windowSize: "1280,800" });
    connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);
    await loadExtension(connection, path.join(REPO_ROOT, "znuny-helper-extension"));

    for (const name of ["agent-uebersicht", "agent-ticket-zoom", "agent-suche"]) {
      const seite = index.seiten.find((e) => e.name === name);
      if (!seite) {
        console.log("fehlt:", name);
        continue;
      }
      const page = await CdpPage.create(connection, "about:blank");
      await connection.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, page.sessionId);
      await connection.send("Fetch.enable", { patterns: [{ urlPattern: "*otrs*" }] }, page.sessionId);
      bedieneAusFixtures(connection, page.sessionId, index);
      await page.goto(seite.url, { settleMs: 1800 });
      await new Promise((r) => setTimeout(r, 1200));
      const shot = await connection.send("Page.captureScreenshot", { format: "png" }, page.sessionId);
      const datei = path.join(ZIEL, `${name}.png`);
      fs.writeFileSync(datei, Buffer.from(shot.data, "base64"));
      console.log("Screenshot:", datei, fs.statSync(datei).size, "Bytes");
      await page.dispose();
    }
  } catch (fehler) {
    console.error("ABBRUCH:", fehler && fehler.message);
  } finally {
    try { if (connection) connection.close(); } catch (e) { /* egal */ }
    try { if (chrome) await chrome.stop(); } catch (e) { /* egal */ }
    process.exit(0);
  }
})();
