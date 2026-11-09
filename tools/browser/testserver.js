"use strict";

/**
 * Winziger statischer Server, mit dem sich der Aufnahme-Weg von
 * tools/browser/capture.js ohne Znuny-Zugang pruefen laesst:
 *
 *   node tools/browser/testserver.js 8099
 *   node tools/browser/capture.js --basis=http://127.0.0.1:8099 --nur=agent-suche
 *
 * Er liefert die Dateien aus tools/fixtures/ unter jedem Pfad aus (der Pfad
 * wird ignoriert, die Zuordnung laeuft ueber den Dateinamen in der Anfrage
 * bzw. faellt auf index.html zurueck). Nur fuer Pruefzwecke gedacht.
 */

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const { FIXTURE_DIR, ladeIndex, findeSeite } = require("./fixtures.js");

function main() {
  const port = Number(process.argv[2] || 8099);
  const index = ladeIndex();

  const server = http.createServer((request, response) => {
    const seite = findeSeite(index, `https://otrs.staff.hsrw${request.url}`);
    const datei = seite ? seite.pfad : path.join(FIXTURE_DIR, "agent-uebersicht.html");
    try {
      const html = fs.readFileSync(datei, "utf8");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Fehler: ${error.message}`);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`Testserver auf http://127.0.0.1:${port} - Strg+C beendet ihn.`);
  });
}

main();
