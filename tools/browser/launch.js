"use strict";

/**
 * Chrome mit geladener Erweiterung starten und ueber CDP ansprechbar machen.
 *
 * Zwei Betriebsarten:
 *  - Profil-Modus (Standard): festes Profil unter .browser-profile/. Dort meldet
 *    man sich EINMAL von Hand im Znuny an; die Sitzung bleibt erhalten. Das
 *    Addon bekommt dadurch nie Zugangsdaten zu sehen.
 *  - Fixture-Modus: derselbe Start, aber die Znuny-Adressen werden nicht vom
 *    echten Server geladen, sondern aus tools/fixtures/ bedient (siehe
 *    fixtures.js). Damit laeuft alles offline und ohne Anmeldung.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CHROME_KANDIDATEN = [
  process.env.ZH_CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChrome() {
  for (const kandidat of CHROME_KANDIDATEN) {
    if (!kandidat) continue;
    try {
      if (fs.existsSync(kandidat)) return kandidat;
    } catch {
      /* weiter */
    }
  }
  return null;
}

function freierPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function warteAufDevTools(port, timeoutMs, prozess) {
  const ende = Date.now() + timeoutMs;
  let letzterFehler = "";
  while (Date.now() < ende) {
    if (prozess && prozess.exitCode !== null) {
      throw new Error(`Chrome wurde mit Code ${prozess.exitCode} beendet`);
    }
    try {
      const antwort = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (antwort.ok) return antwort.json();
    } catch (error) {
      letzterFehler = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`DevTools-Schnittstelle auf Port ${port} nicht erreichbar (${letzterFehler})`);
}

/**
 * @param {object} [options]
 * @param {boolean} [options.headless]  ohne Fenster starten (Standard: false)
 * @param {string}  [options.extension] Pfad zum Erweiterungsordner; false = ohne
 * @param {string}  [options.userDataDir] Profilordner
 * @param {string[]} [options.args] zusaetzliche Chrome-Argumente
 */
async function startChrome(options = {}) {
  const chrome = options.chrome || findChrome();
  if (!chrome) {
    throw new Error(
      "Kein Chrome/Edge gefunden. Pfad ueber die Umgebungsvariable ZH_CHROME angeben."
    );
  }

  const headless = options.headless === true;
  const userDataDir =
    options.userDataDir || path.join(REPO_ROOT, ".browser-profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  const port = options.port || (await freierPort());
  const extension =
    options.extension === false
      ? null
      : options.extension || path.join(REPO_ROOT, "znuny-helper-extension");

  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    `--window-size=${options.windowSize || "1440,1000"}`,
  ];

  if (extension && !fs.existsSync(path.join(extension, "manifest.json"))) {
    throw new Error(`Kein manifest.json im Erweiterungsordner: ${extension}`);
  }

  if (headless) args.push("--headless=new");
  if (options.args) args.push(...options.args);

  const prozess = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
  const stderr = [];
  prozess.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  prozess.stdout.on("data", () => {});

  const version = await warteAufDevTools(port, options.startTimeoutMs || 30000, prozess);

  return {
    chrome,
    port,
    userDataDir,
    extension,
    process: prozess,
    version,
    webSocketDebuggerUrl: version.webSocketDebuggerUrl,
    stderr: () => stderr.join(""),
    async stop() {
      try {
        prozess.kill();
      } catch {
        /* egal */
      }
      await new Promise((resolve) => {
        if (prozess.exitCode !== null) return resolve();
        prozess.once("exit", resolve);
        setTimeout(resolve, 5000);
      });
    },
  };
}

/**
 * Erweiterung in einen laufenden Browser laden.
 *
 * Seit Chrome 137 ignoriert der Browser das Startschalter-Argument
 * --load-extension. Das Protokoll bietet dafuer "Extensions.loadUnpacked";
 * damit laedt die Erweiterung zuverlaessig, auch in neuen Versionen.
 *
 * @returns {Promise<string>} Kennung der geladenen Erweiterung
 */
async function loadExtension(connection, extensionPath) {
  const ordner = path.resolve(extensionPath);
  if (!fs.existsSync(path.join(ordner, "manifest.json"))) {
    throw new Error(`Kein manifest.json im Erweiterungsordner: ${ordner}`);
  }
  const { id } = await connection.send("Extensions.loadUnpacked", { path: ordner });
  return id;
}

module.exports = { startChrome, loadExtension, findChrome, freierPort, REPO_ROOT, CHROME_KANDIDATEN };
