(function () {
  "use strict";

  const SETTINGS_KEY = "znunyHelperSettings";
  const TICKET_SOUND_CONFIG_KEY = "znunyHelperTicketSoundConfig";
  const DEFAULT_SETTINGS = {
    popupTabs: true,
    attachmentPreview: true,
    ticketNumberSearch: true,
    searchResultsPopup: false,
    ticketArticleSearch: true,
    ebHelper: false,
    priorityTemplates: true,
    ticketCategories: true,
    ticketListInfiniteScroll: true,
    attachmentReminder: true,
    pendingDateButtons: true,
    keyboardShortcuts: true,
    assignedTicketSound: true
  };

  const BUILTIN_TICKET_SOUNDS = [
    { id: "icq", name: "ICQ", file: "sounds/icq.mp3" },
    { id: "iphone", name: "iPhone", file: "sounds/iphone.mp3" },
    { id: "minecraft-chicken-1", name: "Minecraft Huhn 1", file: "sounds/minecraft-chicken-1.mp3" },
    { id: "minecraft-chicken-2", name: "Minecraft Huhn 2", file: "sounds/minecraft-chicken-2.mp3" },
    { id: "whatsapp", name: "WhatsApp", file: "sounds/whatsapp.mp3" }
  ];

  const api = typeof browser !== "undefined" ? browser : chrome;
  const usesPromiseStorage = typeof browser !== "undefined";
  const form = document.getElementById("settingsForm");
  const status = document.getElementById("status");
  const soundSelect = document.getElementById("soundSelect");
  const soundPreview = document.getElementById("soundPreview");
  const customSoundList = document.getElementById("customSoundList");
  const soundAdd = document.getElementById("soundAdd");
  const soundFileInput = document.getElementById("soundFileInput");

  let ticketSoundConfig = { customSounds: [], selectedId: BUILTIN_TICKET_SOUNDS[0].id };

  function storageGet(defaults) {
    if (usesPromiseStorage) {
      return api.storage.local.get(defaults).then((value) => value || defaults);
    }

    return new Promise((resolve) => api.storage.local.get(defaults, (value) => resolve(value || defaults)));
  }

  function storageSet(value) {
    if (usesPromiseStorage) {
      return api.storage.local.set(value);
    }

    return new Promise((resolve) => api.storage.local.set(value, resolve));
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

  function normalizeTicketSoundConfig(config) {
    const customSounds = Array.isArray(config?.customSounds)
      ? config.customSounds
          .filter((sound) => sound?.dataUrl)
          .map((sound, index) => ({
            id: String(sound.id || `custom-${index + 1}`),
            name: String(sound.name || `Eigener Sound ${index + 1}`).trim(),
            dataUrl: String(sound.dataUrl)
          }))
      : [];

    const availableIds = [...BUILTIN_TICKET_SOUNDS, ...customSounds].map((sound) => sound.id);
    const selectedId = availableIds.includes(config?.selectedId) ? config.selectedId : BUILTIN_TICKET_SOUNDS[0].id;

    return { customSounds, selectedId };
  }

  function getSoundSource(sound) {
    if (!sound) return "";
    if (sound.dataUrl) return sound.dataUrl;
    if (sound.file) return api.runtime.getURL(sound.file);
    return "";
  }

  function renderSoundSelect() {
    const allSounds = [...BUILTIN_TICKET_SOUNDS, ...ticketSoundConfig.customSounds];
    soundSelect.replaceChildren();

    allSounds.forEach((sound) => {
      const option = document.createElement("option");
      option.value = sound.id;
      option.textContent = sound.name;
      if (sound.id === ticketSoundConfig.selectedId) option.selected = true;
      soundSelect.appendChild(option);
    });
  }

  function renderCustomSoundList() {
    customSoundList.replaceChildren();

    ticketSoundConfig.customSounds.forEach((sound) => {
      const item = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = sound.name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.title = "Entfernen";
      removeButton.textContent = "×";
      removeButton.addEventListener("click", () => removeCustomSound(sound.id));

      item.appendChild(label);
      item.appendChild(removeButton);
      customSoundList.appendChild(item);
    });
  }

  async function saveSoundConfig() {
    ticketSoundConfig = normalizeTicketSoundConfig(ticketSoundConfig);
    await storageSet({ [TICKET_SOUND_CONFIG_KEY]: ticketSoundConfig });
  }

  async function removeCustomSound(id) {
    ticketSoundConfig.customSounds = ticketSoundConfig.customSounds.filter((sound) => sound.id !== id);
    if (ticketSoundConfig.selectedId === id) {
      ticketSoundConfig.selectedId = BUILTIN_TICKET_SOUNDS[0].id;
    }
    await saveSoundConfig();
    renderSoundSelect();
    renderCustomSoundList();
  }

  function initSoundSettings() {
    soundSelect.addEventListener("change", () => {
      ticketSoundConfig.selectedId = soundSelect.value;
      saveSoundConfig();
    });

    soundPreview.addEventListener("click", () => {
      const allSounds = [...BUILTIN_TICKET_SOUNDS, ...ticketSoundConfig.customSounds];
      const src = getSoundSource(allSounds.find((sound) => sound.id === soundSelect.value));
      if (!src) return;
      new Audio(src).play().catch((error) => console.warn("Znuny Helper: Vorschau fehlgeschlagen:", error));
    });

    soundAdd.addEventListener("click", () => soundFileInput.click());

    soundFileInput.addEventListener("change", () => {
      const file = soundFileInput.files?.[0];
      soundFileInput.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result || "");
        if (!dataUrl) return;

        const defaultName = file.name.replace(/\.[^.]+$/, "");
        const name = (window.prompt("Name für den Sound:", defaultName) || defaultName || file.name).trim();

        ticketSoundConfig.customSounds.push({ id: `custom-${Date.now()}`, name: name || file.name, dataUrl });
        ticketSoundConfig.selectedId = ticketSoundConfig.customSounds[ticketSoundConfig.customSounds.length - 1].id;

        await saveSoundConfig();
        renderSoundSelect();
        renderCustomSoundList();
      };
      reader.readAsDataURL(file);
    });
  }

  async function init() {
    const stored = await storageGet({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    writeForm({ ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] || {}) });
    form.addEventListener("change", save);

    const storedSound = await storageGet({ [TICKET_SOUND_CONFIG_KEY]: ticketSoundConfig });
    ticketSoundConfig = normalizeTicketSoundConfig(storedSound[TICKET_SOUND_CONFIG_KEY]);
    renderSoundSelect();
    renderCustomSoundList();
    initSoundSettings();
  }

  init().catch((error) => {
    status.textContent = "Fehler beim Laden";
    console.warn("Znuny Helper popup failed:", error);
  });
})();
