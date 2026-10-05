/* Kleiner Helfer, damit die npm-Scripts unter Windows und unter Linux (CI)
 * funktionieren, ohne neue Abhaengigkeiten und ohne Shell-Besonderheiten.
 *
 * Windows:  python / py -3  (Python wird ueblicherweise als "python" oder "py" installiert)
 * Linux:    python3
 *
 * Aufruf:  node tools/run-python.js <script.py> [argumente...]
 * Beispiel: node tools/run-python.js tools/sync-firefox.py --check
 *
 * Der Exit-Code des Python-Skripts wird unveraendert durchgereicht.
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

if (args.length < 1 || !fs.existsSync(path.resolve(REPO_ROOT, args[0]))) {
  console.error("FEHLER: Aufruf: node tools/run-python.js <script.py> [argumente...]");
  process.exit(2);
}

/* Windows: "python" zuerst, dann der Launcher "py -3". */
if (process.platform === "win32") {
  for (const candidate of [
    { command: "python", prefix: [] },
    { command: "py", prefix: ["-3"] }
  ]) {
    const probe = spawnSync(candidate.command, candidate.prefix.concat(["--version"]), {
      stdio: "ignore",
      shell: true
    });
    if (probe.status === 0) {
      run(candidate.command, candidate.prefix.concat(args));
    }
  }
  console.error(
    "FEHLER: Kein Python gefunden. Bitte Python 3 installieren " +
      '(unter Windows z. B. mit "python" oder "py" im PATH).'
  );
  process.exit(127);
}

/* Linux/macOS: python3 ist auf den CI-Runnern vorhanden. */
run("python3", args);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    cwd: REPO_ROOT
  });

  if (result.error) {
    console.error(`FEHLER: ${command} konnte nicht gestartet werden: ${result.error.message}`);
    process.exit(127);
  }
  process.exit(result.status === null ? 1 : result.status);
}
