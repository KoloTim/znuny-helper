"use strict";
// Popup fuer den Store abbilden (natuerliche Groesse) und in 1280x800 setzen.
const path = require("node:path");
const fs = require("node:fs");
const { startChrome, loadExtension, REPO_ROOT } = require("./browser/launch.js");
const { CdpConnection, CdpPage } = require("./browser/cdp.js");

(async () => {
  let chrome = null;
  let connection = null;
  try {
    chrome = await startChrome({ headless: true, extension: false, userDataDir: path.join(REPO_ROOT, ".browser-profile-store"), args: ["--no-sandbox"], windowSize: "900,1400" });
    connection = await CdpConnection.open(chrome.webSocketDebuggerUrl);
    const id = await loadExtension(connection, path.join(REPO_ROOT, "znuny-helper-extension"));
    const page = await CdpPage.create(connection, "about:blank");
    await page.goto(`chrome-extension://${id}/popup/popup.html`, { settleMs: 900 });

    const groesse = await page.evaluate(`JSON.stringify({ breite: document.documentElement.scrollWidth, hoehe: document.body.scrollHeight })`);
    console.log("Popup-Groesse:", groesse);

    const masse = JSON.parse(groesse);
    await connection.send("Emulation.setDeviceMetricsOverride", {
      width: masse.breite, height: masse.hoehe + 20, deviceScaleFactor: 1, mobile: false
    }, page.sessionId);
    await new Promise((r) => setTimeout(r, 400));
    const shot = await connection.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: masse.breite, height: masse.hoehe + 20, scale: 1 }
    }, page.sessionId);
    const ziel = path.join(REPO_ROOT, "tools", "browser", "output", "popup-store.png");
    fs.writeFileSync(ziel, Buffer.from(shot.data, "base64"));
    console.log("Screenshot:", ziel, fs.statSync(ziel).size, "Bytes");
    await page.dispose();
  } catch (fehler) {
    console.error("ABBRUCH:", fehler && fehler.message);
  } finally {
    try { if (connection) connection.close(); } catch (e) { /* egal */ }
    try { if (chrome) await chrome.stop(); } catch (e) { /* egal */ }
    process.exit(0);
  }
})();
