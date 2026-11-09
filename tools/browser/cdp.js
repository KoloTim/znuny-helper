"use strict";

/**
 * Winziger Client fuer das Chrome DevTools Protocol (CDP).
 *
 * Warum nicht Playwright/Puppeteer? Das Repo laeuft bewusst ohne Zusatzpakete
 * (siehe tools/run-node-test.js). Node 22+ bringt einen WebSocket-Client als
 * globale Klasse mit (Node 20 nicht - dort braeche das Harness ab), damit
 * reicht das Protokoll direkt: keine Installation, kein Browser-Download,
 * und es funktioniert offline.
 *
 * Protokoll: jede Nachricht ist JSON. Anfragen tragen eine "id" und werden
 * beantwortet; Ereignisse tragen "method". Mit "flatten: true" (siehe
 * Target.attachToTarget) kommen Ereignisse aller Tabs ueber dieselbe
 * Verbindung und sind ueber "sessionId" unterscheidbar.
 */

class CdpError extends Error {
  constructor(method, message) {
    super(`${method}: ${message}`);
    this.name = "CdpError";
    this.cdpMethod = method;
  }
}

class CdpConnection {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    this.closed = false;

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleMessage(message);
    });
    socket.addEventListener("close", () => {
      this.closed = true;
      for (const entry of this.pending.values()) {
        entry.reject(new Error(`${entry.method}: Verbindung geschlossen`));
      }
      this.pending.clear();
    });
  }

  static async open(webSocketUrl, timeoutMs = 20000) {
    // Node 20 kennt kein globales WebSocket; das Harness braucht deshalb
    // Node 22 oder neuer. Ohne diese Pruefung meldet sich sonst nur
    // "WebSocket is not defined" - ein Fehler, der nach Addon aussieht,
    // aber an der Laufzeit liegt.
    if (typeof WebSocket === "undefined") {
      throw new Error(
        `Dieser Node (${process.version}) bringt keinen WebSocket-Client mit. ` +
          "Das Browser-Harness braucht Node 22 oder neuer."
      );
    }

    const socket = new WebSocket(webSocketUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`WebSocket-Verbindung zu ${webSocketUrl} hat nicht geantwortet`));
      }, timeoutMs);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true }
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error(`WebSocket-Fehler: ${webSocketUrl}`));
        },
        { once: true }
      );
    });
    return new CdpConnection(socket);
  }

  handleMessage(message) {
    if (message.id !== undefined) {
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new CdpError(entry.method, message.error.message));
      else entry.resolve(message.result);
      return;
    }

    for (const listener of this.listeners.slice()) {
      if (listener.method !== message.method) continue;
      if (listener.sessionId && listener.sessionId !== message.sessionId) continue;
      try {
        listener.handler(message.params, message);
      } catch (error) {
        if (listener.onHandlerError) listener.onHandlerError(error);
      }
    }
  }

  send(method, params = {}, sessionId) {
    if (this.closed) return Promise.reject(new Error(`${method}: Verbindung geschlossen`));
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
    });
    this.socket.send(JSON.stringify(payload));
    return promise;
  }

  /** Ereignis abonnieren. Gibt eine Funktion zum Abbestellen zurueck. */
  on(method, handler, sessionId) {
    const listener = { method, handler, sessionId };
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  /** Auf ein einzelnes Ereignis warten (mit Zeitlimit). */
  once(method, sessionId, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error(`Zeitlimit (${timeoutMs} ms) fuer Ereignis ${method}`));
      }, timeoutMs);
      const off = this.on(
        method,
        (params) => {
          clearTimeout(timer);
          off();
          resolve(params);
        },
        sessionId
      );
    });
  }

  close() {
    this.closed = true;
    try {
      this.socket.close();
    } catch {
      /* egal */
    }
  }
}

/**
 * Hilfsklasse fuer einen einzelnen Tab: anlegen, verbinden, navigieren,
 * auswerten, Screenshot.
 */
class CdpPage {
  constructor(connection, sessionId, targetId) {
    this.connection = connection;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.consoleEntries = [];
    this.exceptions = [];
    this.offHandlers = [];

    this.offHandlers.push(
      connection.on(
        "Runtime.consoleAPICalled",
        (params) => {
          this.consoleEntries.push({
            type: params.type,
            text: params.args
              .map((arg) => {
                if (arg.value !== undefined) {
                  return typeof arg.value === "string" ? arg.value : JSON.stringify(arg.value);
                }
                if (arg.description) return arg.description;
                if (arg.unserializableValue) return String(arg.unserializableValue);
                return "";
              })
              .join(" "),
          });
        },
        this.sessionId
      )
    );

    this.offHandlers.push(
      connection.on(
        "Runtime.exceptionThrown",
        (params) => {
          const details = params.exceptionDetails || {};
          this.exceptions.push({
            text: details.text || "",
            description:
              (details.exception && (details.exception.description || details.exception.value)) ||
              details.text ||
              "",
            url: details.url || "",
            lineNumber: details.lineNumber,
          });
        },
        this.sessionId
      )
    );
  }

  /** Neuen Tab anlegen und verbinden. */
  static async create(connection, url = "about:blank") {
    const { targetId } = await connection.send("Target.createTarget", { url });
    const { sessionId } = await connection.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new CdpPage(connection, sessionId, targetId);

    await page.connection.send("Page.enable", {}, page.sessionId);
    await page.connection.send("Runtime.enable", {}, page.sessionId);
    await page.connection.send("Log.enable", {}, page.sessionId).catch(() => {});
    return page;
  }

  /** Navigieren und auf "load" warten (bei Bedarf zusaetzlich beruhigen lassen). */
  async goto(url, options = {}) {
    const { settleMs = 1200, timeoutMs = 30000 } = options;
    const loaded = this.connection.once("Page.loadEventFired", this.sessionId, timeoutMs);
    await this.connection.send("Page.navigate", { url }, this.sessionId);
    await loaded;
    if (settleMs > 0) await sleep(settleMs);
  }

  /** Ausdruck im Tab auswerten; gibt den Wert zurueck (nicht Promise-aufgeloest). */
  async evaluate(expression, options = {}) {
    const result = await this.connection.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: options.awaitPromise !== false,
        userGesture: true,
      },
      this.sessionId
    );
    if (result.exceptionDetails) {
      const details = result.exceptionDetails;
      throw new Error(
        `Auswertung fehlgeschlagen: ${details.text || ""} ${
          (details.exception && details.exception.description) || ""
        }`.trim()
      );
    }
    return result.result ? result.result.value : undefined;
  }

  async html() {
    return this.evaluate("document.documentElement.outerHTML");
  }

  async screenshot(filePath, options = {}) {
    const params = { format: "png", captureBeyondViewport: false };
    if (options.fullPage) {
      const metrics = await this.connection.send("Page.getLayoutMetrics", {}, this.sessionId);
      const { width, height } = metrics.cssContentSize || metrics.contentSize;
      await this.connection.send(
        "Emulation.setDeviceMetricsOverride",
        { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 1, mobile: false },
        this.sessionId
      );
      params.captureBeyondViewport = true;
    }
    const { data } = await this.connection.send("Page.captureScreenshot", params, this.sessionId);
    if (options.fullPage) {
      await this.connection.send("Emulation.clearDeviceMetricsOverride", {}, this.sessionId);
    }
    require("node:fs").writeFileSync(filePath, Buffer.from(data, "base64"));
    return filePath;
  }

  /** Konsolenausgaben der Erweiterung (Praefix "Znuny Helper"). */
  helperLogs() {
    return this.consoleEntries.filter((entry) => entry.text.includes("Znuny Helper"));
  }

  dispose() {
    for (const off of this.offHandlers) off();
    this.offHandlers = [];
    return this.connection.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { CdpConnection, CdpPage, CdpError, sleep };
