/* Kleiner Test-Laeufer fuer "npm test" - nur Node-Bordmittel, keine Abhaengigkeiten.
 *
 * 1) Syntaxcheck aller eigenen JS-Dateien in beiden Varianten
 *    (src, popup, welcome - "vendor/" wird ausgelassen) via "node --check".
 * 2) Regressionstest tools/tests/infinite-scroll-regression.test.js.
 *
 * Aufruf aus dem Repo-Root:  node tools/run-node-test.js
 * Exit-Code 1, sobald ein Syntaxcheck oder der Regressionstest fehlschlaegt.
 */
"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const VARIANTS = ["znuny-helper-extension", "znuny-helper-extension-firefox"];
const CHECK_DIRS = ["src", "popup", "welcome"];
const REGRESSION_TEST = path.join(__dirname, "tests", "infinite-scroll-regression.test.js");

let failures = 0;

/* ---------- 1) Syntaxcheck ---------- */
const jsFiles = [];
for (const variant of VARIANTS) {
  for (const dir of CHECK_DIRS) {
    const folder = path.join(REPO_ROOT, variant, dir);
    if (!fs.existsSync(folder)) continue;
    for (const entry of fs.readdirSync(folder).sort()) {
      if (entry.toLowerCase().endsWith(".js")) {
        jsFiles.push(path.join(folder, entry));
      }
    }
  }
}

console.log(`Syntaxcheck: ${jsFiles.length} JS-Dateien (src, popup, welcome; vendor/ ausgelassen)`);

for (const file of jsFiles) {
  const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: ["ignore", "ignore", "pipe"],
    encoding: "utf8"
  });
  if (result.status === 0) {
    console.log(`  OK   ${rel}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${rel}`);
    const details = (result.stderr || "").trim();
    if (details) console.log(details.split("\n").map((line) => `       ${line}`).join("\n"));
  }
}

if (!jsFiles.length) {
  failures += 1;
  console.log("  FAIL keine JS-Dateien gefunden - stimmt die Ordnerstruktur?");
}

/* ---------- 2) Regressionstest ---------- */
console.log("\nRegressionstest: tools/tests/infinite-scroll-regression.test.js");
const regression = spawnSync(process.execPath, [REGRESSION_TEST], {
  stdio: "inherit",
  cwd: REPO_ROOT
});
if (regression.status !== 0) {
  failures += 1;
  console.log(`  FAIL Regressionstest (Exit-Code ${regression.status})`);
}

/* ---------- Ergebnis ---------- */
if (failures) {
  console.log(`\nERGEBNIS: ${failures} Schritt(e) fehlgeschlagen.`);
  process.exit(1);
}
console.log("\nERGEBNIS: Syntaxcheck und Regressionstest bestanden.");
