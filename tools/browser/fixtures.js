"use strict";

/**
 * Fixture-Betrieb: Die echten Znuny-Adressen werden nicht vom Server gehoert,
 * sondern ueber das DevTools-Protokoll aus tools/fixtures/ beantwortet.
 *
 * Vorteil: Der Content-Script der Erweiterung sieht die richtige Herkunft
 * (https://otrs.staff.hsrw/...), also greift die Uebereinstimmung aus dem
 * Manifest. Es braucht weder Anmeldung noch Netz - und in der CI laeuft es
 * genauso wie am Entwicklungsrechner.
 */

const fs = require("node:fs");
const path = require("node:path");

const FIXTURE_DIR = path.resolve(__dirname, "..", "fixtures");
const INDEX_DATEI = path.join(FIXTURE_DIR, "fixtures.json");

function ladeIndex() {
  const index = JSON.parse(fs.readFileSync(INDEX_DATEI, "utf8"));
  if (!Array.isArray(index.seiten) || !index.seiten.length) {
    throw new Error(`Keine Seiten in ${INDEX_DATEI}`);
  }
  for (const seite of index.seiten) {
    const datei = path.join(FIXTURE_DIR, seite.datei);
    if (!fs.existsSync(datei)) {
      throw new Error(`Fixture-Datei fehlt: ${seite.datei} (${seite.name})`);
    }
    seite.pfad = datei;
  }

  // Folgeseiten (Nachladen) einsammeln: Adresse -> Datei
  index.folgeseiten = new Map();
  for (const seite of index.seiten) {
    for (const [url, dateiName] of Object.entries(seite.folgeseiten || {})) {
      const datei = path.join(FIXTURE_DIR, dateiName);
      if (!fs.existsSync(datei)) {
        throw new Error(`Folgeseite fehlt: ${dateiName} (${seite.name}, ${url})`);
      }
      index.folgeseiten.set(url, datei);
    }
  }

  return index;
}

/** Fixture zu einer angefragten Adresse finden (exakt, sonst ueber "match"). */
function findeSeite(index, url) {
  const ohneFragment = String(url).split("#")[0];
  for (const seite of index.seiten) {
    if (seite.url === ohneFragment) return seite;
    if (seite.match && ohneFragment.includes(seite.match)) return seite;
  }
  return null;
}

function kopfzeilen(contentType) {
  return [
    { name: "Content-Type", value: contentType },
    { name: "Cache-Control", value: "no-store" },
    { name: "Access-Control-Allow-Origin", value: "*" },
  ];
}

/**
 * Handler fuer "Fetch.requestPaused": beantwortet Znuny-Anfragen aus den
 * Fixtures, alles andere mit 404. Gibt eine Statistik zurueck.
 */
function bedieneAusFixtures(connection, sessionId, index, options = {}) {
  const statistik = { dokumente: 0, assets: 0, unbekannt: [] };
  const stumm = options.stumm === true;

  const handler = async (params) => {
    const url = params.request.url;
    const ohneFragment = url.split("#")[0];
    const seite = findeSeite(index, url);
    const folgeseite = index.folgeseiten && index.folgeseiten.get(ohneFragment);
    try {
      if (folgeseite) {
        statistik.dokumente += 1;
        const html = fs.readFileSync(folgeseite, "utf8");
        await connection.send(
          "Fetch.fulfillRequest",
          {
            requestId: params.requestId,
            responseCode: 200,
            responseHeaders: kopfzeilen("text/html; charset=utf-8"),
            body: Buffer.from(html, "utf8").toString("base64"),
          },
          sessionId
        );
        return;
      }

      if (seite) {
        // Nur das Dokument selbst; Unterressourcen der Fixture (optional).
        const istDokument =
          params.resourceType === "Document" ||
          url === String(seite.url).split("#")[0] ||
          (seite.match && params.resourceType === "Document");

        if (istDokument) {
          statistik.dokumente += 1;
          const html = fs.readFileSync(seite.pfad, "utf8");
          await connection.send(
            "Fetch.fulfillRequest",
            {
              requestId: params.requestId,
              responseCode: 200,
              responseHeaders: kopfzeilen("text/html; charset=utf-8"),
              body: Buffer.from(html, "utf8").toString("base64"),
            },
            sessionId
          );
          return;
        }

        const asset = (seite.assets || {})[new URL(url).pathname];
        if (asset) {
          statistik.assets += 1;
          const datei = path.join(FIXTURE_DIR, asset.datei);
          await connection.send(
            "Fetch.fulfillRequest",
            {
              requestId: params.requestId,
              responseCode: 200,
              responseHeaders: kopfzeilen(asset.typ || "application/octet-stream"),
              body: fs.readFileSync(datei).toString("base64"),
            },
            sessionId
          );
          return;
        }
      }

      if (!stumm) statistik.unbekannt.push(url);
      await connection.send(
        "Fetch.fulfillRequest",
        {
          requestId: params.requestId,
          responseCode: 404,
          responseHeaders: kopfzeilen("text/plain; charset=utf-8"),
          body: "",
        },
        sessionId
      );
    } catch (error) {
      // Der Tab wurde womoeglich schon geschlossen - dann ist nichts zu tun.
      if (!/Invalid InterceptionId|No session/i.test(error.message)) throw error;
    }
  };

  connection.on("Fetch.requestPaused", handler, sessionId);
  return statistik;
}

module.exports = { FIXTURE_DIR, ladeIndex, findeSeite, bedieneAusFixtures };
