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

/* ---------- 3) Struktur- und Versionscheck ---------- */
// Faengt zwei Fehlerklassen, die sonst erst im Store oder beim Nutzer auffallen:
// eine Funktion, die still aus der Oberflaeche verschwindet, und eine Version,
// die an einer Stelle vergessen wurde (Manifest, package.json, Changelog-Seite).
console.log("\nStruktur- und Versionscheck:");

function pruefeStruktur(rel, bedingungen) {
  const datei = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(datei)) {
    failures += 1;
    console.log(`  FAIL ${rel} fehlt`);
    return;
  }
  const inhalt = fs.readFileSync(datei, "utf8");
  for (const [beschreibung, muster] of bedingungen) {
    const ok = typeof muster === "string" ? inhalt.includes(muster) : muster.test(inhalt);
    if (!ok) failures += 1;
    console.log(`  ${ok ? "OK  " : "FAIL"} ${rel}: ${beschreibung}`);
  }
}

const POPUP_HTML = path.join("znuny-helper-extension", "popup", "popup.html");
pruefeStruktur(POPUP_HTML, [
  ["Diagnose-Knopf im Popup", 'id="diagnoseCopy"'],
  ["Diagnose-Ausgabe im Popup", 'id="diagnoseOutput"']
]);
pruefeStruktur(path.join("znuny-helper-extension", "popup", "popup.js"), [
  ["Diagnose fragt das Content-Script", "zh-diagnose"],
  ["Diagnose formatiert den Bericht", "formatiereDiagnose"]
]);
pruefeStruktur(path.join("znuny-helper-extension", "src", "content.js"), [
  ["Diagnose antwortet dem Popup", "zh-diagnose"],
  ["Diagnose sammelt die Seite", "buildDiagnoseBericht"],
  ["Diagnose merkt sich Fehler", "merkeDiagnoseFehler"]
]);

const versionen = new Map();
function merkeVersion(rel, version) {
  if (!version) {
    failures += 1;
    console.log(`  FAIL ${rel}: keine Version gefunden`);
    return;
  }
  versionen.set(rel, version);
  console.log(`  OK   ${rel}: ${version}`);
}

for (const variante of VARIANTS) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, variante, "manifest.json"), "utf8")
  );
  merkeVersion(`${variante}/manifest.json`, manifest.version);
}

const paket = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
merkeVersion("package.json", paket.version);

const welcomeQuelle = fs.readFileSync(
  path.join(REPO_ROOT, "znuny-helper-extension", "welcome", "welcome.js"),
  "utf8"
);
merkeVersion("welcome.js (neuester Eintrag)", welcomeQuelle.match(/version:\s*"([\d.]+)"/)?.[1]);

const MAX_VERSION = "1.6.11";
const verschieden = [...new Set(versionen.values())];
if (verschieden.length > 1) {
  failures += 1;
  console.log(`  FAIL Versionen weichen voneinander ab: ${verschieden.join(" / ")}`);
} else if (verschieden[0] !== MAX_VERSION) {
  failures += 1;
  console.log(`  FAIL Version ist ${verschieden[0]}, erwartet ${MAX_VERSION}`);
} else {
  console.log(`  OK   Alle Versionsstellen stehen auf ${MAX_VERSION}`);
}

/* ---------- Ergebnis ---------- */
if (failures) {
  console.log(`\nERGEBNIS: ${failures} Schritt(e) fehlgeschlagen.`);
  process.exit(1);
}
console.log("\nERGEBNIS: Syntaxcheck und Regressionstest bestanden.");
