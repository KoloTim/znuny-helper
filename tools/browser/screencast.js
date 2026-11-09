"use strict";

/**
 * Bildschirmaufzeichnung ueber das DevTools-Protokoll.
 *
 * Chrome kann waehrend des Betriebs Einzelbilder des Tabs schicken
 * ("Page.startScreencast"). Daraus entsteht eine Bilderfolge plus eine kleine
 * HTML-Seite, die den Lauf wie ein Video abspielt - ohne zusaetzliche
 * Programme und ohne Videodatei.
 *
 * Gedacht zum Nachvollziehen: Was hat der Rauchtest eigentlich gemacht?
 */

const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {object} connection  offene CDP-Verbindung
 * @param {string} sessionId   Sitzung des Tabs
 * @param {string} ordner      Zielordner fuer die Einzelbilder
 */
async function starteAufzeichnung(connection, sessionId, ordner, optionen = {}) {
  const minAbstand = optionen.minAbstand || 200;
  const maxBilder = optionen.maxBilder || 200;

  fs.mkdirSync(ordner, { recursive: true });
  const bilder = [];
  let letzterZeitpunkt = 0;
  let laeuft = true;

  const abmelden = connection.on(
    "Page.screencastFrame",
    async (params) => {
      // Jedes Bild muss bestaetigt werden, sonst schickt Chrome keine weiteren.
      try {
        await connection.send(
          "Page.screencastFrameAck",
          { sessionId: params.sessionId },
          sessionId
        );
      } catch {
        /* Tab kann schon zu sein */
      }

      const jetzt = Date.now();
      if (!laeuft || bilder.length >= maxBilder) return;
      if (jetzt - letzterZeitpunkt < minAbstand) return;
      letzterZeitpunkt = jetzt;

      const nummer = String(bilder.length + 1).padStart(3, "0");
      const name = `bild-${nummer}.jpg`;
      try {
        fs.writeFileSync(path.join(ordner, name), Buffer.from(params.data, "base64"));
        bilder.push(name);
      } catch {
        /* Platte voll o. ae. - Aufzeichnung ist Beiwerk */
      }
    },
    sessionId
  );

  await connection.send(
    "Page.startScreencast",
    {
      format: "jpeg",
      quality: 70,
      maxWidth: optionen.maxWidth || 1280,
      maxHeight: optionen.maxHeight || 900,
      everyNthFrame: 1,
    },
    sessionId
  );

  return {
    bilder,
    /**
     * Ein fertiges Bild anhaengen (z. B. den scharfen Screenshot am Ende einer
     * Seite). Die Bilderflut der Aufzeichnung ist flau und unvollstaendig -
     * das Schlussbild zeigt den Zustand, der geprueft wurde.
     */
    ergaenzeBild(quelle, endung) {
      if (bilder.length >= maxBilder) return null;
      const nummer = String(bilder.length + 1).padStart(3, "0");
      const name = `bild-${nummer}.${endung || "png"}`;
      try {
        fs.copyFileSync(quelle, path.join(ordner, name));
        bilder.push(name);
        return name;
      } catch {
        return null;
      }
    },
    async stoppe() {
      laeuft = false;
      abmelden();
      await connection.send("Page.stopScreencast", {}, sessionId).catch(() => {});
      return bilder;
    },
  };
}

/**
 * HTML-Seite, die alle Aufnahmen hintereinander abspielt.
 *
 * @param {string} zielDatei
 * @param {Array<{name: string, beschreibung?: string, bilder: string[], ordner: string}>} aufnahmen
 */
function schreibePlayer(zielDatei, aufnahmen) {
  const folien = [];
  for (const aufnahme of aufnahmen) {
    for (const bild of aufnahme.bilder) {
      folien.push({
        bild: `${aufnahme.ordner}/${bild}`,
        seite: aufnahme.name,
        beschreibung: aufnahme.beschreibung || "",
      });
    }
  }

  if (!folien.length) {
    fs.writeFileSync(
      zielDatei,
      "<!DOCTYPE html><meta charset=\"utf-8\"><p>Keine Bilder aufgezeichnet.</p>",
      "utf8"
    );
    return 0;
  }

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Znuny Helper - Lauf des Rauchtests</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 14px/1.5 -apple-system, "Segoe UI", Arial, sans-serif; background: #16161d; color: #e8e8ef; }
  header { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; padding: 12px 18px; background: #1f1f29; border-bottom: 1px solid #333; }
  header h1 { margin: 0; font-size: 15px; font-weight: 600; }
  .steuerung { display: flex; gap: 8px; align-items: center; margin-left: auto; }
  button { font: inherit; padding: 5px 14px; border-radius: 6px; border: 1px solid #4a4a5c; background: #2b2b38; color: #e8e8ef; cursor: pointer; }
  button:hover { background: #363646; }
  button.haupt { background: #ff9900; border-color: #ff9900; color: #16161d; font-weight: 600; }
  input[type="range"] { width: 120px; }
  main { display: grid; place-items: center; padding: 18px; }
  figure { margin: 0; max-width: 1300px; width: 100%; }
  img { width: 100%; height: auto; border: 1px solid #3a3a4a; border-radius: 8px; background: #fff; display: block; }
  figcaption { display: flex; gap: 12px; align-items: baseline; padding: 10px 2px 0; color: #b9b9c9; font-size: 13px; }
  figcaption strong { color: #fff; }
  .fortschritt { height: 3px; background: #2b2b38; }
  .fortschritt span { display: block; height: 100%; background: #ff9900; width: 0; transition: width .15s linear; }
</style>
</head>
<body>
<header>
  <h1>Znuny Helper &ndash; Rauchtest im Browser</h1>
  <div class="steuerung">
    <button id="zurueck" type="button">&larr;</button>
    <button id="start" class="haupt" type="button">Abspielen</button>
    <button id="vor" type="button">&rarr;</button>
    <label for="tempo">Tempo</label>
    <input id="tempo" type="range" min="200" max="2000" step="100" value="700">
  </div>
</header>
<div class="fortschritt"><span id="balken"></span></div>
<main>
  <figure>
    <img id="bild" alt="Aufnahme">
    <figcaption><strong id="seite"></strong><span id="beschreibung"></span><span id="zaehler"></span></figcaption>
  </figure>
</main>
<script>
  const folien = ${JSON.stringify(folien, null, 0)};
  let index = 0;
  let laeuft = false;
  let timer = null;
  const bild = document.getElementById("bild");
  const seite = document.getElementById("seite");
  const beschreibung = document.getElementById("beschreibung");
  const zaehler = document.getElementById("zaehler");
  const balken = document.getElementById("balken");
  const tempo = document.getElementById("tempo");
  const start = document.getElementById("start");

  function zeige(i) {
    index = Math.max(0, Math.min(folien.length - 1, i));
    const folie = folien[index];
    bild.src = folie.bild;
    seite.textContent = folie.seite;
    beschreibung.textContent = folie.beschreibung;
    zaehler.textContent = (index + 1) + " / " + folien.length;
    balken.style.width = ((index + 1) / folien.length * 100) + "%";
  }

  function weiter() {
    if (index >= folien.length - 1) return anhalten();
    zeige(index + 1);
    timer = setTimeout(weiter, Number(tempo.value));
  }

  function abspielen() {
    if (laeuft) return;
    if (index >= folien.length - 1) zeige(0);
    laeuft = true;
    start.textContent = "Pause";
    timer = setTimeout(weiter, Number(tempo.value));
  }

  function anhalten() {
    laeuft = false;
    start.textContent = "Abspielen";
    clearTimeout(timer);
  }

  start.addEventListener("click", () => (laeuft ? anhalten() : abspielen()));
  document.getElementById("zurueck").addEventListener("click", () => { anhalten(); zeige(index - 1); });
  document.getElementById("vor").addEventListener("click", () => { anhalten(); zeige(index + 1); });
  document.addEventListener("keydown", (event) => {
    if (event.key === " ") { event.preventDefault(); laeuft ? anhalten() : abspielen(); }
    if (event.key === "ArrowRight") { anhalten(); zeige(index + 1); }
    if (event.key === "ArrowLeft") { anhalten(); zeige(index - 1); }
  });

  zeige(0);
</script>
</body>
</html>
`;
  fs.writeFileSync(zielDatei, html, "utf8");
  return folien.length;
}

module.exports = { starteAufzeichnung, schreibePlayer };
