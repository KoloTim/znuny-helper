(function () {
  "use strict";

  const SETTINGS_KEY = "znunyHelperSettings";
  const DEFAULT_SETTINGS = {
    popupTabs: true,
    attachmentPreview: true,
    ticketNumberSearch: true,
    searchResultsPopup: false,
    ticketArticleSearch: true,
    ebHelper: false,
    priorityTemplates: true,
    ticketCategories: true,
    ticketListInfiniteScroll: true
  };

  const api = typeof browser !== "undefined" ? browser : chrome;
  const usesPromiseStorage = typeof browser !== "undefined";
  const form = document.getElementById("settingsForm");
  const status = document.getElementById("status");

  function storageGet(defaults) {
    if (usesPromiseStorage) {
      return api.storage.sync.get(defaults).then((value) => value || defaults);
    }

    return new Promise((resolve) => api.storage.sync.get(defaults, (value) => resolve(value || defaults)));
  }

  function storageSet(value) {
    if (usesPromiseStorage) {
      return api.storage.sync.set(value);
    }

    return new Promise((resolve) => api.storage.sync.set(value, resolve));
  }

  function readForm() {
    return Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS).map((key) => [key, Boolean(form.elements[key]?.checked)])
    );
  }

  function writeForm(settings) {
    Object.entries(settings).forEach(([key, value]) => {
      if (form.elements[key]) {
        form.elements[key].checked = Boolean(value);
      }
    });
  }

  async function save() {
    const nextSettings = readForm();
    await storageSet({ [SETTINGS_KEY]: nextSettings });
    status.textContent = "Gespeichert";
    window.setTimeout(() => {
      status.textContent = "Bereit";
    }, 1200);
  }

  async function init() {
    const stored = await storageGet({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    writeForm({ ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) });
    form.addEventListener("change", save);
  }

  init().catch((error) => {
    status.textContent = "Fehler beim Laden";
    console.warn("Znuny Helper popup failed:", error);
  });
})();
