(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;
  const SETTINGS_KEY = "znunyHelperSettings";
  const activeTabsByWindow = new Map();
  const previousTabsByWindow = new Map();

  function getTab(tabId) {
    if (!tabId && tabId !== 0) return Promise.resolve(null);

    if (typeof browser !== "undefined") {
      return api.tabs.get(tabId).catch(() => null);
    }

    return new Promise((resolve) => {
      api.tabs.get(tabId, (tab) => {
        if (api.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(tab || null);
      });
    });
  }

  function updateTab(tabId, properties) {
    if (typeof browser !== "undefined") {
      return api.tabs.update(tabId, properties).catch(() => null);
    }

    return new Promise((resolve) => {
      api.tabs.update(tabId, properties, (tab) => {
        if (api.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(tab || null);
      });
    });
  }

  function focusWindow(windowId) {
    if (!windowId && windowId !== 0) return Promise.resolve(null);

    if (typeof browser !== "undefined") {
      return api.windows.update(windowId, { focused: true }).catch(() => null);
    }

    return new Promise((resolve) => {
      api.windows.update(windowId, { focused: true }, (windowInfo) => {
        if (api.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(windowInfo || null);
      });
    });
  }

  function removeTab(tabId) {
    if (typeof browser !== "undefined") {
      return api.tabs.remove(tabId).catch(() => null);
    }

    return new Promise((resolve) => {
      api.tabs.remove(tabId, () => {
        resolve(null);
      });
    });
  }

  function reloadTab(tabId) {
    if (!tabId && tabId !== 0) return Promise.resolve(null);

    if (typeof browser !== "undefined") {
      return api.tabs.reload(tabId).catch(() => null);
    }

    return new Promise((resolve) => {
      api.tabs.reload(tabId, () => {
        resolve(null);
      });
    });
  }

  function createTab(properties) {
    if (typeof browser !== "undefined") {
      return api.tabs.create(properties).catch(() => null);
    }

    return new Promise((resolve) => {
      api.tabs.create(properties, (tab) => {
        if (api.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(tab || null);
      });
    });
  }

  function storageGet(area, defaults) {
    if (typeof browser !== "undefined") {
      return api.storage[area].get(defaults).then((value) => value || defaults);
    }

    return new Promise((resolve) => {
      api.storage[area].get(defaults, (value) => resolve(value || defaults));
    });
  }

  function storageSet(area, value) {
    if (typeof browser !== "undefined") {
      return api.storage[area].set(value).catch(() => null);
    }

    return new Promise((resolve) => {
      api.storage[area].set(value, () => resolve(null));
    });
  }

  async function migrateNewDisabledDefaults() {
    const stored = await storageGet("local", { [SETTINGS_KEY]: {} });
    const current = stored[SETTINGS_KEY] || {};

    await storageSet("local", {
      [SETTINGS_KEY]: {
        ...current,
        ebHelper: false,
        searchResultsPopup: false
      }
    });
  }

  function getExtensionUrl(path) {
    return api.runtime.getURL(path);
  }

  function openWelcomePage(reason, previousVersion = "") {
    const manifest = api.runtime.getManifest?.() || {};
    const params = new URLSearchParams({
      reason: reason || "install",
      version: manifest.version || "",
      previousVersion: previousVersion || ""
    });

    createTab({
      url: `${getExtensionUrl("welcome/welcome.html")}?${params.toString()}`
    });
  }

  function queryTabs(queryInfo) {
    if (typeof browser !== "undefined") {
      return api.tabs.query(queryInfo).catch(() => []);
    }

    return new Promise((resolve) => {
      api.tabs.query(queryInfo, (tabs) => {
        if (api.runtime.lastError) {
          resolve([]);
          return;
        }

        resolve(tabs || []);
      });
    });
  }

  function normalizeTabUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = "";
      return parsed.href;
    } catch (error) {
      return String(url || "").split("#")[0];
    }
  }

  async function findTabByUrl(url, windowId, excludedTabId) {
    if (!url) return null;

    const wanted = normalizeTabUrl(url);
    const tabs = await queryTabs({ windowId });

    return tabs.find((candidate) =>
      candidate?.id !== excludedTabId &&
      normalizeTabUrl(candidate.url || candidate.pendingUrl || "") === wanted
    ) || null;
  }

  const handledCloseTabs = new Set();

  async function closeSubmittedTab(tab, message) {
    if (!tab?.id) return;

    // The content script and the watcher below may both ask for the same tab; the second
    // request must not reload the return tab a second time.
    if (handledCloseTabs.has(tab.id)) return;
    handledCloseTabs.add(tab.id);
    globalThis.setTimeout(() => handledCloseTabs.delete(tab.id), 10000);

    let returnTab = tab.openerTabId ? await getTab(tab.openerTabId) : null;

    if (!returnTab?.id && message?.returnUrl) {
      returnTab = await findTabByUrl(message.returnUrl, tab.windowId, tab.id);
    }

    if (!returnTab?.id) {
      const previousTabId = previousTabsByWindow.get(tab.windowId);
      if (previousTabId && previousTabId !== tab.id) {
        returnTab = await getTab(previousTabId);
      }
    }

    if (returnTab?.id && returnTab.id !== tab.id) {
      await updateTab(returnTab.id, { active: true });
      await focusWindow(returnTab.windowId);
      await removeTab(tab.id);
      globalThis.setTimeout(() => {
        reloadTab(returnTab.id);
      }, 150);
      return;
    }

    await removeTab(tab.id);
  }

  api.tabs.onActivated?.addListener((activeInfo) => {
    const previous = activeTabsByWindow.get(activeInfo.windowId);
    if (previous && previous !== activeInfo.tabId) {
      previousTabsByWindow.set(activeInfo.windowId, previous);
    }

    activeTabsByWindow.set(activeInfo.windowId, activeInfo.tabId);
  });

  api.runtime.onInstalled?.addListener((details) => {
    if (!["install", "update"].includes(details.reason)) return;

    migrateNewDisabledDefaults();
    openWelcomePage(details.reason, details.previousVersion);
  });

  api.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== "znuny-helper-close-submitted-tab") return false;

    const tab = sender.tab;
    const delayMs = Math.max(300, Math.min(Number(message.delayMs) || 1300, 5000));

    globalThis.setTimeout(() => {
      closeSubmittedTab(tab, message);
    }, delayMs);

    return false;
  });

  // ---------------------------------------------------------------------------------
  // Auto close for action tabs.
  // A tab that the extension opened for an action page reports itself when the agent
  // submits. The background then watches that tab and closes it as soon as it has left
  // the action page (Znuny loads the ticket afterwards) and reloads the tab it came
  // from. Doing this here means it works even if the follow-up page's own script does
  // not run and even if Znuny has overwritten window.name.
  const pendingAutoClose = new Map();
  const AUTO_CLOSE_TIMEOUT_MS = 30000;
  const AUTO_CLOSE_POLL_MS = 1500;

  function isActionPageUrl(url, source, flags) {
    try {
      return new RegExp(source, flags || "i").test(String(url || ""));
    } catch (error) {
      return false;
    }
  }

  async function maybeCloseArmedTab(tabId) {
    const entry = pendingAutoClose.get(tabId);
    if (!entry) return;

    if (Date.now() - entry.at > AUTO_CLOSE_TIMEOUT_MS) {
      // Still on the action page after all: the submit did not go through.
      pendingAutoClose.delete(tabId);
      return;
    }

    const tab = await getTab(tabId);
    if (!tab?.id) {
      pendingAutoClose.delete(tabId);
      return;
    }

    const url = tab.url || tab.pendingUrl || "";
    if (!url) return;

    // Still on the action page (e.g. a validation error re-rendered the form): keep it.
    if (entry.pattern && isActionPageUrl(url, entry.pattern, entry.flags)) return;

    pendingAutoClose.delete(tabId);
    await closeSubmittedTab(tab, { returnUrl: entry.returnUrl });
  }

  api.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== "znuny-helper-arm-auto-close") return false;

    const tab = sender.tab;
    if (!tab?.id) return false;

    pendingAutoClose.set(tab.id, {
      at: Date.now(),
      returnUrl: String(message.returnUrl || ""),
      pattern: String(message.actionPattern || ""),
      flags: String(message.actionFlags || "i")
    });

    return false;
  });

  api.tabs.onUpdated?.addListener((tabId, changeInfo) => {
    if (!pendingAutoClose.has(tabId)) return;
    if (!changeInfo.url && changeInfo.status !== "complete") return;

    maybeCloseArmedTab(tabId);
  });

  globalThis.setInterval(() => {
    [...pendingAutoClose.keys()].forEach((tabId) => {
      maybeCloseArmedTab(tabId);
    });
  }, AUTO_CLOSE_POLL_MS);
})();
