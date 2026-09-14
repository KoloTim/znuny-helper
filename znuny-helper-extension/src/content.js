(function () {
  "use strict";

  const SETTINGS_KEY = "znunyHelperSettings";
  const TICKET_STATE_KEY = "znunyHelperTicketState";
  const SEARCH_HISTORY_KEY = "znunyHelperSearchHistory";
  const CATEGORY_CONFIG_KEY = "znunyHelperCategoryConfig";
  const PRIORITY_TEMPLATE_CONFIG_KEY = "znunyHelperPriorityTemplateConfig";
  const TICKET_SOUND_CONFIG_KEY = "znunyHelperTicketSoundConfig";
  const TICKET_SOUND_SEEN_KEY = "znunyHelperSeenLockedTicketIds";
  const EB_BASE_URL = "https://digi-eb.staff.hsrw/new";
  const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;
  const SPREADSHEET_PREVIEW_MAX_ROWS = 1000;
  const SPREADSHEET_PREVIEW_MAX_COLS = 80;
  const TICKET_SOUND_CHECK_INTERVAL_MS = 60000;
  // Actions the quick-reply drawer knows how to embed: replying (Compose),
  // changing the owner (Owner), adding a note (Note), closing (Close),
  // linking (LinkObject) and merging (Merge). The Close/Merge/LinkObject
  // action names are our best-known guess at the standard Znuny naming and
  // are unverified against this live instance — if one of them doesn't
  // trigger the drawer, the link simply falls back to its normal tab/popup
  // behaviour, so this is safe to leave in place either way.
  // Keep this in sync with isQuickReplyEligibleUrl in page-bridge.js.
  const QUICK_REPLY_ACTION_PATTERN = /Action=(?:AgentTicket(?:Compose|Owner|Note|Close|Merge)|AgentLinkObject)\b/i;

  const DEFAULT_SETTINGS = {
    popupTabs: true,
    attachmentPreview: true,
    ticketNumberSearch: true,
    searchResultsPopup: false,
    ticketArticleSearch: true,
    ticketNumberCopy: true,
    ebHelper: false,
    priorityTemplates: false,
    ticketCategories: true,
    ticketListInfiniteScroll: true,
    attachmentReminder: true,
    pendingDateButtons: true,
    keyboardShortcuts: true,
    assignedTicketSound: false,
    quickReply: false
  };

  const BUILTIN_TICKET_SOUNDS = [
    { id: "soft-ping", name: "Sanfter Ping", file: "sounds/soft-ping.wav" },
    { id: "two-tone-chime", name: "Zwei-Ton-Chime", file: "sounds/two-tone-chime.wav" },
    { id: "soft-click", name: "Weicher Klick", file: "sounds/soft-click.wav" },
    { id: "icq", name: "ICQ", file: "sounds/icq.mp3" },
    { id: "iphone", name: "iPhone", file: "sounds/iphone.mp3" },
    { id: "minecraft-chicken-1", name: "Minecraft Huhn 1", file: "sounds/minecraft-chicken-1.mp3" },
    { id: "minecraft-chicken-2", name: "Minecraft Huhn 2", file: "sounds/minecraft-chicken-2.mp3" },
    { id: "whatsapp", name: "WhatsApp", file: "sounds/whatsapp.mp3" }
  ];

  const DEFAULT_PRIORITY_TEMPLATES = [
    {
      id: "assignment-to-agent",
      title: "Assignment to Agent",
      color: "#3976bb",
      fields: {
        type: "ServiceRequest",
        queue: "2nd Line",
        service: "Person",
        owner: "Tim Kolodzej",
        category: "Authorisation",
        subject: "Assignment to Agent",
        body: "s.u,"
      }
    }
  ];

  // Order below doubles as auto-detection priority (checked top to bottom, first keyword
  // match wins) - see getCategoryGroups()/autoDetectCategory(). Keep the most urgent /
  // most specific categories first so they win over broader ones on overlapping keywords.
  const DEFAULT_GROUPS = [
    { id: "", title: "Ohne Kategorie", short: "Keine", color: "", order: 1 },
    { id: "dringend", title: "Dringend / Störung", short: "Dringend", color: "#ffd6d6", order: 2 },
    { id: "extern", title: "Externe Zuständigkeit", short: "Extern", color: "#ead8ff", order: 3 },
    { id: "software", title: "Software / Zugang", short: "Software", color: "#d9ecff", order: 4 },
    { id: "hardware", title: "Hardware / Abholung", short: "Hardware", color: "#ffe4c4", order: 5 },
    { id: "studis", title: "Studis", short: "Studis", color: "#d8ffd8", order: 6 },
    { id: "wartend", title: "Warten / Rückmeldung", short: "Wartend", color: "#fff3b0", order: 7 }
  ];

  const DEFAULT_KEYWORDS = {
    dringend: [
      "dringend", "sofort", "akut", "notfall", "kompletter ausfall", "komplettausfall",
      "heute noch", "kein zugriff", "keinen zugriff", "produktion steht", "urgent",
      "kritisch", "critical", "asap", "blockiert", "geht nicht mehr", "geht gar nicht",
      "funktioniert nicht mehr", "totalausfall", "system down", "alles steht", "ausfall",
      "stoerung", "störung"
    ],
    extern: [
      "campusmanagement", "personalservice", "marketing", "student services",
      "studierendenservice", "studierenden-service", "personalrat", "dekanat", "drvis",
      "pruefungsamt", "prüfungsamt", "applicant portal", "bewerberportal", "bewerber",
      "uni-assist", "uniassist"
    ],
    software: [
      "vpn", "f5", "big-ip", "bigip", "edge client", "yubikey", "ubikey", "2fa", "mfa",
      "duo", "otp", "access denied", "zugriff verweigert", "portal.hsrw.cloud",
      "outlook", "owa", "postfach", "mail-kle", "preauthentication", "pre-authentication",
      "passwort", "password", "kennwort", "account gesperrt", "konto gesperrt", "gesperrt",
      "login fehlgeschlagen", "anmeldung fehlgeschlagen", "zugang", "login", "anmeldung",
      "adobe", "citavi", "webex", "teams", "sciebo", "lizenz", "license", "sharepoint",
      "onedrive", "sap", "his", "qis", "ldap", "windows", "office", "browser", "zertifikat",
      "installation", "installieren", "programm", "software", "endpoint", "e-mail", "email"
    ],
    hardware: [
      "dockingstation", "docking station", "docking", "laptop abholen", "notebook abholen",
      "abholung", "abholen", "uebergabe", "übergabe", "bestellen", "bestellung", "beschaffen",
      "beschaffung", "inventarnummer", "inventar-nr", "akku", "tastatur", "monitor",
      "bildschirm", "netzteil", "defekt", "kaputt", "reparatur", "reparieren", "neugeraet",
      "neugerät", "neues notebook", "neues geraet", "neues gerät", "zur abholung bereit",
      "drucker", "printer", "scanner", "webcam", "headset", "maus", "thinclient",
      "thin client", "geraet", "gerät", "hardware", "rechner", "laptop", "notebook",
      "arbeitslaptop"
    ],
    studis: [
      "matrikelnummer", "matrikel-nr", "matrikel", "hisinone", "his in one", "moodle",
      "einschreibung", "exmatrikulation", "semesteranmeldung", "studienbescheinigung",
      "qisserver", "student", "studi", "studierende", "studium", "enrollment", "semester",
      "pruefung", "prüfung", "pruefungs", "prüfungs", "bewerbung", "campus", "eduroam",
      "abschlussarbeit", "thesis", "praktikum", "@students.hsrw"
    ],
    wartend: [
      "keine rueckmeldung", "keine rückmeldung", "wartet auf user", "wartet auf kunde",
      "wartet auf kunden", "bitte bescheid geben", "urlaub", "nicht erreichbar",
      "warte auf antwort", "warten auf antwort", "noch keine reaktion", "rueckmeldung",
      "rückmeldung", "feedback", "nachfrage", "termin", "terminvereinbarung", "abstimmung",
      "pending", "on hold"
    ]
  };

  const api = typeof browser !== "undefined" ? browser : chrome;
  const usesPromiseStorage = typeof browser !== "undefined";
  let settings = { ...DEFAULT_SETTINGS };
  let ticketState = { categories: {}, notes: {} };
  let categoryConfig = null;
  let priorityTemplateConfig = { templates: DEFAULT_PRIORITY_TEMPLATES };
  let priorityTemplateFilter = "";
  const priorityTemplateOpenIds = new Set();
  let ticketSoundConfig = { customSounds: [], selectedId: BUILTIN_TICKET_SOUNDS[0].id };
  let openNoteTicketId = null;
  let scanQueued = false;
  let searchModalFixQueued = false;
  let suppressMutationScanUntil = 0;
  let infiniteScrollState = {
    enabledUrl: "",
    nextUrl: "",
    loading: false,
    done: false,
    bound: false,
    hasLoadedPage: false,
    failCount: 0,
    nextRetryAt: 0
  };
  let articleSearchState = {
    terms: [],
    matches: [],
    rowMatches: [],
    blockMatches: [],
    activeIndex: -1,
    debounceTimer: 0,
    runId: 0,
    fetchCache: new Map()
  };

  function normalizeCategoryId(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCategoryConfig(config) {
    const sourceGroups = Array.isArray(config?.groups) ? config.groups : DEFAULT_GROUPS;
    const sourceKeywords = config?.keywords && typeof config.keywords === "object" ? config.keywords : DEFAULT_KEYWORDS;

    const groups = sourceGroups.map((group, index) => ({
      id: index === 0 ? "" : normalizeCategoryId(group.id || group.short || group.title || `cat-${index}`),
      title: String(group.title || group.short || "Kategorie").trim(),
      short: String(group.short || group.title || "Kat").trim(),
      color: String(group.color || "").trim(),
      order: Number(group.order || index + 1)
    }));

    if (!groups.some((group) => group.id === "")) {
      groups.unshift({ id: "", title: "Ohne Kategorie", short: "Keine", color: "", order: 1 });
    }

    const seenIds = new Set();
    const uniqueGroups = groups.filter((group) => {
      if (seenIds.has(group.id)) return false;
      seenIds.add(group.id);
      return true;
    }).sort((a, b) => a.order - b.order);

    const keywords = {};
    uniqueGroups.forEach((group) => {
      keywords[group.id] = Array.isArray(sourceKeywords[group.id])
        ? sourceKeywords[group.id].map((word) => String(word).trim()).filter(Boolean)
        : [];
    });

    return { groups: uniqueGroups, keywords };
  }

  function getCategoryGroups() {
    if (!categoryConfig) {
      categoryConfig = normalizeCategoryConfig({ groups: DEFAULT_GROUPS, keywords: DEFAULT_KEYWORDS });
    }

    return categoryConfig.groups;
  }

  function getCategoryKeywords() {
    if (!categoryConfig) getCategoryGroups();
    return categoryConfig.keywords;
  }

  function saveCategoryConfig() {
    categoryConfig = normalizeCategoryConfig(categoryConfig);
    syncSet("local", { [CATEGORY_CONFIG_KEY]: categoryConfig });
  }

  function setProtectedFill(element, color) {
    // Dark Reader (and similar recoloring extensions) rewrite plain background-color,
    // which flattens all category colors to the same dark tone. A same-stop gradient
    // renders identically but is generally left alone by those extensions, so the
    // category colors stay distinguishable.
    element.style.background = "";
    element.style.backgroundColor = "";
    element.style.backgroundImage = color ? `linear-gradient(${color}, ${color})` : "";
  }

  function getReadableTextColor(hexColor) {
    const hex = String(hexColor || "").trim();
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#111";

    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.55 ? "#fff" : "#111";
  }

  function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importJsonFile(onLoad) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          onLoad(JSON.parse(String(reader.result || "")));
        } catch (error) {
          window.alert("Datei konnte nicht gelesen werden: ungültiges JSON.");
        }
      };
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  }

  function normalizePriorityTemplateConfig(config) {
    const sourceTemplates = Array.isArray(config?.templates) && config.templates.length
      ? config.templates
      : DEFAULT_PRIORITY_TEMPLATES;

    const templates = sourceTemplates.map((template, index) => {
      const id = String(template.id || `priority-template-${index + 1}`).trim() || `priority-template-${index + 1}`;
      const title = String(template.title || "Vorlage").trim();
      const fields = {
        type: String(template.fields?.type || "").trim(),
        queue: String(template.fields?.queue || "").trim(),
        service: String(template.fields?.service || "").trim(),
        owner: String(template.fields?.owner || "").trim(),
        category: String(template.fields?.category || "").trim(),
        subject: String(template.fields?.subject || "").trim(),
        body: String(template.fields?.body || "").trim()
      };
      const isAssignmentTemplate =
        id === "assignment-to-agent" ||
        /assignment\s+to\s+(agent|me)/i.test(title) ||
        /assignment\s+to\s+(agent|me)/i.test(fields.subject);

      if (isAssignmentTemplate) {
        fields.type ||= "ServiceRequest";
        fields.queue ||= "2nd Line";
        fields.service ||= "Person";
        fields.owner ||= "Tim Kolodzej";
        fields.category ||= "Authorisation";
        if (!fields.subject || /^s\.?u\.?,?$/i.test(fields.subject)) fields.subject = "Assignment to Agent";
        fields.body ||= "s.u,";
      }

      return {
        id,
        title,
        color: String(template.color || "#3976bb").trim(),
        group: String(template.group || "").trim(),
        fields
      };
    });

    const declaredGroups = Array.isArray(config?.groups)
      ? config.groups.map((name) => String(name || "").trim()).filter(Boolean)
      : [];
    const groups = [...new Set([...declaredGroups, ...templates.map((template) => template.group).filter(Boolean)])];

    return { groups, templates };
  }

  function getPriorityGroups() {
    priorityTemplateConfig = normalizePriorityTemplateConfig(priorityTemplateConfig);
    return priorityTemplateConfig.groups || [];
  }

  function orderPriorityGroups(byGroup) {
    const configured = getPriorityGroups().filter((name) => byGroup.has(name));
    const extra = [...byGroup.keys()]
      .filter((name) => name && !configured.includes(name))
      .sort((left, right) => left.localeCompare(right, "de"));
    return [...configured, ...extra, ...(byGroup.has("") ? [""] : [])];
  }

  function savePriorityTemplateConfig() {
    priorityTemplateConfig = normalizePriorityTemplateConfig(priorityTemplateConfig);
    syncSet("local", { [PRIORITY_TEMPLATE_CONFIG_KEY]: priorityTemplateConfig });
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

  function getTicketSoundSource(sound) {
    if (!sound) return "";
    if (sound.dataUrl) return sound.dataUrl;
    if (sound.file) return api.runtime.getURL(sound.file);
    return "";
  }

  function playAssignedTicketSound() {
    const allSounds = [...BUILTIN_TICKET_SOUNDS, ...ticketSoundConfig.customSounds];
    const selected = allSounds.find((sound) => sound.id === ticketSoundConfig.selectedId) || allSounds[0];
    const src = getTicketSoundSource(selected);
    if (!src) return;

    try {
      const audio = new Audio(src);
      audio.volume = 0.6;
      audio.play().catch((error) => console.warn("Znuny Helper: Sound konnte nicht abgespielt werden:", error));
    } catch (error) {
      console.warn("Znuny Helper: Sound konnte nicht abgespielt werden:", error);
    }
  }

  function getLockedTicketsUrl() {
    // Built directly instead of scanning the page for the "Gesperrte Tickets" toolbar
    // link: that link (and its accessible text) isn't present on every Znuny page —
    // e.g. bare action tabs opened by "Popups als Tabs" — which made the periodic
    // check silently do nothing whenever it happened to run in one of those tabs.
    try {
      return new URL("index.pl?Action=AgentTicketLockedView", window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  async function refreshCurrentTicketList() {
    if (!isTicketListPage()) return;

    const table = findTicketTable();
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return;

    try {
      const response = await fetch(window.location.href, { credentials: "include", cache: "no-store" });
      if (!response.ok) return;

      const html = await response.text();
      const freshDoc = new DOMParser().parseFromString(html, "text/html");
      const freshTable = findTicketTable(freshDoc);
      const freshBody = freshTable?.querySelector("tbody");
      if (!freshTable || !freshBody) return;

      const freshRows = [...freshBody.querySelectorAll("tr")].map((row) => document.importNode(row, true));
      tbody.replaceChildren(...freshRows);

      if (settings.ticketCategories && isCategoryTicketListPage()) {
        applyTicketCategories();
      }
    } catch (error) {
      console.warn("Znuny Helper: Ticketliste konnte nicht aktualisiert werden:", error);
    }
  }

  async function runAssignedTicketsCheck(url) {
    try {
      const response = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!response.ok) return;

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const table = findTicketTable(doc);
      if (!table) return;

      const indexes = getIndexes(table);
      const currentIds = [...table.querySelectorAll("tbody tr")]
        .map((row) => getTicketId(row, indexes))
        .filter(Boolean);

      const stored = await syncGet("local", { [TICKET_SOUND_SEEN_KEY]: null });
      const seen = stored[TICKET_SOUND_SEEN_KEY];

      // Persist the new baseline before playing anything: another tab's poll
      // running right after this one reads the already-updated baseline and
      // correctly sees no new tickets, instead of also sounding off for the
      // same ticket. See the navigator.locks wrapper below for the other half
      // of this (serializing concurrent polls from multiple open Znuny tabs).
      await syncSet("local", { [TICKET_SOUND_SEEN_KEY]: currentIds });

      // First run ever: just record the current baseline, don't sound off for
      // every ticket already locked before this feature existed.
      if (!Array.isArray(seen)) return;

      const seenIds = new Set(seen);
      if (currentIds.some((id) => !seenIds.has(id))) {
        playAssignedTicketSound();
        refreshCurrentTicketList();
      }
    } catch (error) {
      console.warn("Znuny Helper: Ticket-Sound-Prüfung fehlgeschlagen:", error);
    }
  }

  async function checkForAssignedTickets() {
    if (!settings.assignedTicketSound) return;

    const url = getLockedTicketsUrl();
    if (!url) return;

    if (navigator.locks?.request) {
      try {
        await navigator.locks.request("znuny-helper-ticket-sound-check", () => runAssignedTicketsCheck(url));
        return;
      } catch (error) {
        // Fall through to an unlocked check if the Locks API itself rejects.
      }
    }

    await runAssignedTicketsCheck(url);
  }

  function syncGet(area, defaults) {
    const storageArea = api.storage[area];

    if (usesPromiseStorage) {
      return storageArea.get(defaults).then((value) => value || defaults);
    }

    return new Promise((resolve) => storageArea.get(defaults, (value) => resolve(value || defaults)));
  }

  function syncSet(area, value) {
    if (usesPromiseStorage) {
      return api.storage[area]
        .set(value)
        .catch((error) => console.warn("Znuny Helper storage write failed:", error));
    }

    return new Promise((resolve) => api.storage[area].set(value, resolve));
  }

  function dispatchPageSettings() {
    document.documentElement.dataset.zhPopupTabs = settings.popupTabs ? "1" : "0";
    document.documentElement.dataset.zhSearchResultsPopup = settings.searchResultsPopup ? "1" : "0";
    document.documentElement.dataset.zhQuickReply = settings.quickReply ? "1" : "0";

    window.dispatchEvent(new CustomEvent("znuny-helper-settings", {
      detail: {
        popupTabs: settings.popupTabs,
        searchResultsPopup: settings.searchResultsPopup,
        quickReply: settings.quickReply
      }
    }));
  }

  function normalizeText(text) {
    return (text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function addStyleToDocument(doc, id, css) {
    if (doc.getElementById(id)) return;

    const style = doc.createElement("style");
    style.id = id;
    style.textContent = css;
    doc.documentElement.appendChild(style);
  }

  function addStyle(id, css) {
    addStyleToDocument(document, id, css);
  }

  function removeStyle(id) {
    getAccessibleSearchDocuments().forEach((doc) => {
      doc.getElementById(id)?.remove();
    });
  }

  function isTicketZoomPage() {
    return window.location.href.includes("Action=AgentTicketZoom");
  }

  function isCategoryTicketListPage() {
    return /Action=AgentTicket(?:Owner|Locked)View/i.test(window.location.href);
  }

  function isPriorityTicketPage(href = window.location.href) {
    return /Action=AgentTicketPriority/i.test(href);
  }

  function isOwnerTicketPage(href = window.location.href) {
    return /Action=AgentTicketOwner/i.test(href);
  }

  function isPhoneTicketPage(href = window.location.href) {
    return /Action=AgentTicketPhone/i.test(href);
  }

  function isComposeTicketPage() {
    return /Action=AgentTicketCompose/i.test(window.location.href);
  }

  function isPriorityTemplatePage(href = window.location.href) {
    return isPriorityTicketPage(href) || isOwnerTicketPage(href) || isPhoneTicketPage(href);
  }

  function getFormControlValue(form, name) {
    return form?.querySelector?.(`[name="${name}"]`)?.value || "";
  }

  function isTransmitSubmitControl(control) {
    if (!control) return false;

    const text = normalizeText(control.value || control.textContent || control.title || control.getAttribute?.("aria-label") || "");
    return /bermitteln/i.test(text);
  }

  function requestCloseSubmittedTab(delayMs = 300) {
    try {
      const response = api.runtime?.sendMessage?.({
        type: "znuny-helper-close-submitted-tab",
        delayMs,
        returnUrl: document.referrer || ""
      });

      response?.catch?.(() => {});
    } catch (error) {
      // The browser API is unavailable on plain page contexts.
    }
  }

  const AUTO_CLOSE_FLAG_KEY = "zhAutoCloseAfterSubmit";
  const AUTO_CLOSE_FLAG_TTL_MS = 20000;

  function isZnunyActionSubmitContext(form) {
    const formAction = getFormControlValue(form, "Action");
    if (formAction) return /^AgentTicket/i.test(formAction);

    const urlAction = new URLSearchParams(window.location.search).get("Action") || "";
    return /^AgentTicket/i.test(urlAction);
  }

  function armAutoCloseOnSubmit(event) {
    const control = event.target?.closest?.('button, input[type="submit"], input[type="button"], a, [role="button"]');
    if (!control || !isTransmitSubmitControl(control)) return;
    if (!isZnunyActionSubmitContext(control.closest?.("form") || null)) return;

    try {
      sessionStorage.setItem(AUTO_CLOSE_FLAG_KEY, String(Date.now()));
    } catch (error) {
      // sessionStorage can be unavailable in rare privacy-mode edge cases; ignore.
    }
  }

  function enableCloseTabAfterSubmit() {
    if (window.top !== window.self || !settings.popupTabs) return;
    if (document.documentElement.dataset.zhCloseAfterSubmitBound === "1") return;

    document.documentElement.dataset.zhCloseAfterSubmitBound = "1";
    // Arming on the click that precedes submission (rather than on the form's
    // "submit" event, which fires just as the page starts unloading) avoids a
    // race where the close-tab message never reaches the background script
    // because navigation begins before it can be flushed. The flag survives
    // the resulting same-tab navigation via sessionStorage and is consumed
    // once the landing page has fully loaded, see consumeAutoCloseFlag().
    document.addEventListener("click", armAutoCloseOnSubmit, true);
  }

  function enableActionPopupCancelFallback() {
    if (window.top !== window.self || !settings.popupTabs) return;

    document.querySelectorAll(".CancelClosePopup").forEach((link) => {
      if (link.dataset.zhCancelFallbackBound === "1") return;
      link.dataset.zhCancelFallbackBound = "1";
      link.addEventListener("click", (event) => {
        stopEvent(event);
        window.close();
      });
    });
  }

  function consumeAutoCloseFlag() {
    if (window.top !== window.self) return;

    let armedAt = 0;
    try {
      armedAt = Number(sessionStorage.getItem(AUTO_CLOSE_FLAG_KEY) || 0);
      sessionStorage.removeItem(AUTO_CLOSE_FLAG_KEY);
    } catch (error) {
      return;
    }

    if (!settings.popupTabs || !armedAt || Date.now() - armedAt > AUTO_CLOSE_FLAG_TTL_MS) return;

    window.setTimeout(() => requestCloseSubmittedTab(), 400);
  }

  function findSubmitShortcutControl() {
    const candidates = [...document.querySelectorAll('button, input[type="submit"], input[type="button"]')]
      .filter(isVisibleFormControl)
      .filter((control) => !control.closest("#zh-priority-template-toolbar, .zh-priority-modal, .zh-category-modal-backdrop, .zh-note-popup, #zh-attachment-reminder, .zh-pending-date-row"));

    return candidates.find(isTransmitSubmitControl) || null;
  }

  function handleSubmitShortcutKeydown(event) {
    if (!settings.keyboardShortcuts) return;
    if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
    if (event.target?.closest?.("#zh-priority-template-toolbar, .zh-priority-modal, .zh-category-modal-backdrop, .zh-note-popup")) return;

    const control = findSubmitShortcutControl();
    if (!control) return;

    event.preventDefault();
    event.stopPropagation();
    control.click();
  }

  function bindSubmitShortcutToDocument(doc) {
    if (!doc || doc.__zhSubmitShortcutBound) return;

    try {
      doc.__zhSubmitShortcutBound = true;
      doc.addEventListener("keydown", handleSubmitShortcutKeydown, true);
    } catch (error) {
      // Cross-origin document access can fail; nothing to bind in that case.
    }
  }

  function enableSubmitShortcut() {
    if (window.top !== window.self) return;

    bindSubmitShortcutToDocument(document);

    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        if (iframe.contentDocument) bindSubmitShortcutToDocument(iframe.contentDocument);
      } catch (error) {
        // Cross-origin iframe; the page's own shortcuts still apply there.
      }
    });
  }

  const ATTACHMENT_MENTION_PATTERN = /\b(anbei|im\s+anhang|als\s+anhang|anhang\s+beigef(?:ue|ü)gt|angeh(?:ae|ä)ngt|beigef(?:ue|ü)gt|attached|attachment)\b/i;
  const ATTACHMENT_NO_ROWS_PATTERN = /^(keine\s+anh(?:ae|ä)nge|no\s+attachments?|anhang|anh(?:ae|ä)nge)$/i;
  let attachmentReminderState = { bound: false, timer: null };

  function isOutgoingMessagePage() {
    return isComposeTicketPage();
  }

  function getComposeBodyText() {
    const iframe = document.querySelector(".cke_wysiwyg_frame, iframe[title*='Rich' i], iframe");
    try {
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
      if (iframeDoc?.body) return iframeDoc.body.innerText || "";
    } catch (error) {
      // Cross-document access can fail; fall through to other strategies.
    }

    const editable = document.querySelector(".cke_editable[contenteditable='true'], [contenteditable='true']");
    if (editable) return editable.innerText || "";

    const textarea = [...document.querySelectorAll("textarea")]
      .find((control) => /richtext|body|article|text/i.test(`${control.name || ""} ${control.id || ""}`));

    return textarea?.value || "";
  }

  function findAttachmentListContainers() {
    return [...document.querySelectorAll('[id*="attachment" i], [class*="attachment" i]')]
      .filter((element) => ["TABLE", "TBODY", "UL", "OL"].includes(element.tagName));
  }

  function countComposeAttachmentRows() {
    const containers = findAttachmentListContainers();

    for (const container of containers) {
      const rows = [...container.querySelectorAll("tr, li")].filter((row) => {
        const text = normalizeText(getElementText(row)).toLowerCase();
        return text && !ATTACHMENT_NO_ROWS_PATTERN.test(text);
      });

      if (rows.length) return rows.length;
    }

    return 0;
  }

  function countPendingFileUploads() {
    return [...document.querySelectorAll('input[type="file"]')]
      .reduce((total, input) => total + (input.files?.length || 0), 0);
  }

  function hasAttachmentWidget() {
    return Boolean(document.querySelector('[id*="attachment" i], [class*="attachment" i], input[type="file"]'));
  }

  function hasComposeAttachment() {
    return countComposeAttachmentRows() > 0 || countPendingFileUploads() > 0;
  }

  function getAttachmentReminderTarget() {
    const widget = [...document.querySelectorAll(".WidgetSimple, fieldset")]
      .find((element) => /artikel hinzuf|nachricht/i.test(normalizeText(getElementText(element.querySelector(".Header") || element))));

    if (widget) return { mode: "before", element: widget };

    return { mode: "prepend", element: document.querySelector("form") || document.body };
  }

  function ensureAttachmentReminderBanner() {
    let banner = document.getElementById("zh-attachment-reminder");
    if (banner) return banner;

    const target = getAttachmentReminderTarget();
    if (!target?.element) return null;

    banner = document.createElement("div");
    banner.id = "zh-attachment-reminder";
    banner.hidden = true;
    banner.innerHTML = "<strong>Anhang vergessen?</strong> Der Text erwähnt einen Anhang, aber es wurde noch keine Datei angehängt.";

    if (target.mode === "before") target.element.before(banner);
    else target.element.prepend(banner);

    return banner;
  }

  function addAttachmentReminderStyles() {
    addStyle("zh-attachment-reminder-style", `
      #zh-attachment-reminder { margin: 8px 0; padding: 8px 12px; border: 1px solid #e0a800; border-radius: 4px; background: #fff8e1; color: #6b4e00; font-size: 12.5px; }
      #zh-attachment-reminder strong { margin-right: 4px; }
    `);
  }

  function updateAttachmentReminder() {
    if (!settings.attachmentReminder || !isOutgoingMessagePage()) {
      disableAttachmentReminder();
      return;
    }

    const banner = ensureAttachmentReminderBanner();
    if (!banner) return;

    const shouldWarn = hasAttachmentWidget() &&
      !hasComposeAttachment() &&
      ATTACHMENT_MENTION_PATTERN.test(getComposeBodyText());

    banner.hidden = !shouldWarn;
  }

  function enableAttachmentReminder() {
    if (!settings.attachmentReminder || !isOutgoingMessagePage()) {
      disableAttachmentReminder();
      return;
    }

    addAttachmentReminderStyles();
    updateAttachmentReminder();

    if (!attachmentReminderState.bound) {
      attachmentReminderState.bound = true;
      attachmentReminderState.timer = window.setInterval(updateAttachmentReminder, 1000);
    }
  }

  function disableAttachmentReminder() {
    document.getElementById("zh-attachment-reminder")?.remove();
    removeStyle("zh-attachment-reminder-style");

    if (attachmentReminderState.timer) {
      window.clearInterval(attachmentReminderState.timer);
    }

    attachmentReminderState = { bound: false, timer: null };
  }

  function findArticleWidget(doc = document) {
    const byId = doc.getElementById("WidgetArticle");
    if (byId) return byId;

    return [...doc.querySelectorAll(".WidgetSimple")]
      .find((widget) => /artikel hinzuf|add article/i.test(normalizeText(getElementText(widget.querySelector(".Header") || widget)))) || null;
  }

  function expandArticleWidget(doc = document) {
    const widget = findArticleWidget(doc);
    if (!widget || widget.dataset.zhArticleExpanded === "1") return;

    widget.dataset.zhArticleExpanded = "1";

    // Open it by default on every screen. Done via classes (not a click) so it
    // cannot trigger Znuny's anchor navigation/scroll; the CreateArticle
    // checkbox is set so submitting still creates the article.
    if (widget.classList.contains("Collapsed")) {
      widget.classList.remove("Collapsed");
      widget.classList.add("Expanded");
    }

    const createArticle = widget.querySelector("#CreateArticle");
    if (createArticle && createArticle.type === "checkbox" && !createArticle.checked) {
      createArticle.checked = true;
      createArticle.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  const PENDING_DATE_PRESETS = [3, 7, 14];

  function selectNearestDateNumber(select, target) {
    if (!select?.options?.length) return false;

    let best = null;
    let bestDiff = Infinity;

    [...select.options].forEach((option) => {
      const num = optionNumber(option);
      if (!Number.isFinite(num)) return;
      const diff = Math.abs(num - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = option;
      }
    });

    if (!best) return false;

    if (select.value !== best.value || !best.selected) {
      select.value = best.value;
      best.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  }

  function findPendingDateGroups(doc = document) {
    const selects = [...doc.querySelectorAll("select")]
      .filter((select) => !select.closest("#zh-search-primary-fields, .zh-priority-modal, #zh-priority-template-toolbar, #zh-attachment-reminder"));

    const byPrefix = new Map();

    selects.forEach((select) => {
      const name = select.name || select.id || "";
      const match = name.match(/^(.*?)(Year|Month|Day|Hour|Minute)$/);
      if (!match) return;

      const prefix = match[1];
      const part = match[2];
      if (!byPrefix.has(prefix)) byPrefix.set(prefix, {});
      byPrefix.get(prefix)[part] = select;
    });

    const groups = [];
    byPrefix.forEach((parts, prefix) => {
      if (parts.Year && parts.Month && parts.Day && parts.Hour && parts.Minute && isVisibleFormControl(parts.Year)) {
        groups.push({ prefix, ...parts });
      }
    });

    return groups;
  }

  function pageHasPendingStateSelected(doc = document) {
    return [...doc.querySelectorAll("select")].some((select) => {
      const signature = `${select.name || ""} ${select.id || ""}`.toLowerCase();
      if (!signature.includes("state")) return false;

      const text = normalizeText(select.selectedOptions?.[0]?.textContent || "").toLowerCase();
      return /warten|pending/.test(text);
    });
  }

  function setPendingDateOffset(group, days) {
    const now = new Date();
    const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    selectDateNumber(group.Day, target.getDate());
    selectDateNumber(group.Month, target.getMonth() + 1);
    selectDateNumber(group.Year, target.getFullYear());
    selectNearestDateNumber(group.Hour, now.getHours());
    selectNearestDateNumber(group.Minute, now.getMinutes());
  }

  function findPendingDateContainer(group) {
    const anchor = group.Minute;
    const fieldContainer = anchor.closest(".Field, .Row, fieldset, li");
    if (fieldContainer) return fieldContainer;

    const row = anchor.closest("tr");
    if (row) return row.querySelector("td:last-child") || row;

    return anchor.parentElement;
  }

  function ensurePendingDateButtons(group, doc = document) {
    if (group.Year.dataset.zhPendingButtonsBound === "1") return;

    const container = findPendingDateContainer(group);
    if (!container) return;

    group.Year.dataset.zhPendingButtonsBound = "1";

    const row = doc.createElement("div");
    row.className = "zh-pending-date-row";

    const label = doc.createElement("span");
    label.className = "zh-pending-date-label";
    label.textContent = "Warten bis:";
    row.appendChild(label);

    PENDING_DATE_PRESETS.forEach((days) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = days === 3 ? "+3 Tage (Standard)" : `+${days} Tage`;
      button.addEventListener("click", (event) => {
        stopEvent(event);
        setPendingDateOffset(group, days);
      });
      row.appendChild(button);
    });

    container.appendChild(row);
    setPendingDateOffset(group, 3);
  }

  function addPendingDateStyles(doc = document) {
    addStyleToDocument(doc, "zh-pending-date-style", `
      .zh-pending-date-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 0; }
      .zh-pending-date-label { color: #777; font-size: 12px; }
      .zh-pending-date-row button { font-size: 11px; padding: 3px 8px; border: 1px solid #bdbdbd; border-radius: 3px; background: #f7f7f7; color: #333; cursor: pointer; }
      .zh-pending-date-row button:hover { background: #fff; border-color: #888; }
    `);
  }

  function enablePendingDateQuickButtons(doc = document) {
    if (doc === document && window.top !== window.self) return;
    if (!pageHasPendingStateSelected(doc)) return;

    const groups = findPendingDateGroups(doc);
    if (!groups.length) return;

    addPendingDateStyles(doc);
    groups.forEach((group) => ensurePendingDateButtons(group, doc));
  }

  function disablePendingDateQuickButtons() {
    document.querySelectorAll(".zh-pending-date-row").forEach((row) => row.remove());
    document.querySelectorAll("select[data-zh-pending-buttons-bound]").forEach((select) => {
      delete select.dataset.zhPendingButtonsBound;
    });
    removeStyle("zh-pending-date-style");
  }

  function queueScan() {
    if (Date.now() < suppressMutationScanUntil) return;
    if (scanQueued) return;

    scanQueued = true;
    window.setTimeout(() => {
      scanQueued = false;
      runEnabledFeatures();
    }, 150);
  }

  function handleDocumentMutation() {
    const form = settings.ticketNumberSearch ? findVisibleSearchForm() : null;

    if (form?.dataset.zhSearchEnhanced === "1") {
      window.setTimeout(() => cleanupEnhancedSearchForm(form), 0);
    } else if (form && !searchModalFixQueued) {
      searchModalFixQueued = true;
      window.setTimeout(() => {
        searchModalFixQueued = false;
        fixTicketNumberSearch();
      }, 0);
    }

    queueScan();
  }

  function closeAttachmentPreview() {
    document.querySelectorAll(".zh-preview-backdrop").forEach((element) => element.remove());
  }

  function getExtension(text) {
    const clean = decodeURIComponent(String(text).split("?")[0].split("#")[0]).toLowerCase();
    const match = clean.match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function getFileName(anchor, index) {
    const text = anchor.innerText.trim();
    if (text) return text.split("\n")[0].trim();

    const title = anchor.getAttribute("title");
    if (title) return title.trim();

    return `Anhang-${index + 1}`;
  }

  function looksLikeAttachmentLink(anchor) {
    const href = (anchor.getAttribute("href") || "").toLowerCase();

    return (
      href.includes("action=agentticketattachment") ||
      href.includes("subaction=download") ||
      href.includes("subaction=attachment") ||
      href.includes("downloadattachment") ||
      href.includes("attachmentid=")
    );
  }

  function isUsableAttachmentHref(href) {
    const clean = String(href || "").trim();
    if (!clean) return false;

    return !/^(#|javascript:)/i.test(clean);
  }

  function attachmentUrlScore(href, isOriginalLink) {
    const clean = String(href || "").toLowerCase();
    let score = 0;

    if (clean.includes("action=agentticketattachment")) score += 30;
    if (clean.includes("subaction=download")) score += 20;
    if (clean.includes("subaction=attachment")) score += 15;
    if (clean.includes("downloadattachment")) score += 15;
    if (clean.includes("attachmentid=")) score += 10;
    if (!isOriginalLink) score += 1;

    return score;
  }

  function getAttachmentPreviewHrefs(anchor, fileName) {
    const expectedName = normalizeText(fileName).toLowerCase();
    return [anchor, ...document.querySelectorAll("a[href]")]
      .filter(Boolean)
      .filter((candidate, index, list) => list.indexOf(candidate) === index)
      .filter((candidate) => {
        const href = candidate.href || candidate.getAttribute("href") || "";
        if (!isUsableAttachmentHref(href)) return false;

        if (candidate === anchor) return true;
        if (!expectedName) return false;

        const candidateName = normalizeText(getFileName(candidate, 0)).toLowerCase();
        const candidateText = normalizeText(candidate.innerText || candidate.textContent || "").toLowerCase();

        return candidateName === expectedName || candidateText.includes(expectedName);
      })
      .map((candidate) => ({
        href: candidate.href || candidate.getAttribute("href") || "",
        isOriginalLink: candidate === anchor
      }))
      .sort((left, right) =>
        attachmentUrlScore(right.href, right.isOriginalLink) - attachmentUrlScore(left.href, left.isOriginalLink)
      )
      .map((candidate) => candidate.href);
  }

  function getAttachmentPreviewHref(anchor, fileName) {
    return getAttachmentPreviewHrefs(anchor, fileName)[0] || "";
  }

  function renderAttachmentDownloadFallback(content, href, message) {
    const fallback = document.createElement("div");
    fallback.className = "zh-preview-loading";
    fallback.textContent = message;

    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Anhang herunterladen";

    fallback.append(document.createElement("br"), document.createElement("br"), link);
    content.appendChild(fallback);
  }

  function renderDirectAttachmentPreview(content, href, fileName) {
    const type = guessAttachmentType(fileName || href, "");

    content.textContent = "";

    if (type === "pdf") {
      // Deliberately no inline iframe here: this path is only reached when
      // the normal fetch-based preview (which forces the blob's MIME type
      // to application/pdf before rendering it) failed or the server itself
      // reported HTML instead of a PDF, so the content can't be confirmed
      // safe to render inline. A same-origin iframe pointed straight at the
      // URL would otherwise let a mislabeled HTML/JS attachment execute
      // script with access to the Znuny session. Sandboxing isn't a fix
      // here either, since it also disables Chromium's PDF viewer outright.
      renderAttachmentDownloadFallback(content, href, "Vorschau nicht möglich, da der Anhang nicht sicher als PDF bestätigt werden konnte.");
      return true;
    }

    if (type === "image") {
      const image = document.createElement("img");
      image.src = href;
      content.appendChild(image);
      return true;
    }

    return false;
  }

  function guessAttachmentType(fileName, blobType) {
    const ext = getExtension(fileName);
    const mime = String(blobType || "").toLowerCase();

    if (ext === "pdf" || mime.includes("pdf")) return "pdf";
    if (
      ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext) ||
      mime.startsWith("image/")
    ) return "image";
    if (["txt", "log", "text"].includes(ext) || mime.startsWith("text/plain")) return "text";
    if (ext === "eml" || mime.includes("message/rfc822")) return "eml";
    if (ext === "docx" || mime.includes("wordprocessingml")) return "docx";
    if (
      ["xlsx", "xlsm", "xlsb", "xls", "ods"].includes(ext) ||
      mime.includes("spreadsheet") ||
      mime.includes("ms-excel") ||
      mime.includes("opendocument.spreadsheet")
    ) return "spreadsheet";
    if (ext === "doc" || mime.includes("msword")) return "word";

    return "unknown";
  }

  function decodeBytes(bytes, charset = "utf-8") {
    try {
      return new TextDecoder(charset).decode(bytes);
    } catch (error) {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }

  async function decodeAttachmentText(blob) {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const utf8Text = decodeBytes(bytes, "utf-8");
    const replacementCount = (utf8Text.match(/\uFFFD/g) || []).length;

    if (replacementCount > Math.max(3, utf8Text.length / 200)) {
      return decodeBytes(bytes, "windows-1252");
    }

    return utf8Text;
  }

  function decodeMimeWords(value) {
    return String(value || "").replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (match, charset, mode, encoded) => {
      try {
        let bytes;

        if (mode.toLowerCase() === "b") {
          const binary = atob(encoded.replace(/\s/g, ""));
          bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        } else {
          const qp = encoded
            .replace(/_/g, " ")
            .replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
          bytes = Uint8Array.from(qp, (char) => char.charCodeAt(0));
        }

        return decodeBytes(bytes, charset);
      } catch (error) {
        return match;
      }
    });
  }

  function parseMailHeaders(rawHeaderText) {
    const headers = {};
    let current = "";

    String(rawHeaderText || "").split(/\r?\n/).forEach((line) => {
      if (/^[\t ]/.test(line) && current) {
        headers[current][headers[current].length - 1] += ` ${line.trim()}`;
        return;
      }

      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (!match) return;

      current = match[1].toLowerCase();
      if (!headers[current]) headers[current] = [];
      headers[current].push(decodeMimeWords(match[2].trim()));
    });

    return headers;
  }

  function splitMailHeaderBody(rawText) {
    const match = String(rawText || "").match(/\r?\n\r?\n/);
    if (!match) return { headerText: rawText || "", bodyText: "" };

    return {
      headerText: rawText.slice(0, match.index),
      bodyText: rawText.slice(match.index + match[0].length)
    };
  }

  function getMailHeader(headers, name) {
    return (headers[String(name).toLowerCase()] || []).join(", ");
  }

  function getMimeBoundary(contentType) {
    const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
    return match ? (match[1] || match[2] || "") : "";
  }

  function decodeQuotedPrintable(value) {
    const cleaned = String(value || "").replace(/=\r?\n/g, "");
    const bytes = [];

    for (let index = 0; index < cleaned.length; index += 1) {
      if (cleaned[index] === "=" && /^[a-f0-9]{2}$/i.test(cleaned.slice(index + 1, index + 3))) {
        bytes.push(parseInt(cleaned.slice(index + 1, index + 3), 16));
        index += 2;
      } else {
        bytes.push(cleaned.charCodeAt(index) & 0xff);
      }
    }

    return decodeBytes(new Uint8Array(bytes), "utf-8");
  }

  function decodeBase64Body(value) {
    try {
      const binary = atob(String(value || "").replace(/\s/g, ""));
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return decodeBytes(bytes, "utf-8");
    } catch (error) {
      return value || "";
    }
  }

  function stripHtmlToText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    return normalizeText(doc.body?.innerText || doc.body?.textContent || "");
  }

  function decodeMailBody(bodyText, headers) {
    const transfer = getMailHeader(headers, "content-transfer-encoding").toLowerCase();
    const contentType = getMailHeader(headers, "content-type").toLowerCase();
    let decoded = String(bodyText || "");

    if (transfer.includes("quoted-printable")) decoded = decodeQuotedPrintable(decoded);
    else if (transfer.includes("base64")) decoded = decodeBase64Body(decoded);

    if (contentType.includes("text/html")) decoded = stripHtmlToText(decoded);
    return decoded.trim();
  }

  function extractEmlBody(headerText, bodyText) {
    const headers = parseMailHeaders(headerText);
    const boundary = getMimeBoundary(getMailHeader(headers, "content-type"));

    if (!boundary) return decodeMailBody(bodyText, headers);

    const parts = String(bodyText || "")
      .split(`--${boundary}`)
      .map((part) => part.replace(/--\s*$/, "").trim())
      .filter(Boolean)
      .map((part) => {
        const split = splitMailHeaderBody(part);
        const partHeaders = parseMailHeaders(split.headerText);
        const contentType = getMailHeader(partHeaders, "content-type").toLowerCase();

        return {
          contentType,
          text: decodeMailBody(split.bodyText, partHeaders)
        };
      });

    return (parts.find((part) => part.contentType.includes("text/plain")) ||
      parts.find((part) => part.contentType.includes("text/html")) ||
      parts.find((part) => part.text))?.text || "";
  }

  function renderTextPreview(content, text, fileName, truncated = false) {
    content.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "zh-preview-text";

    if (truncated) {
      const notice = document.createElement("div");
      notice.className = "zh-preview-notice";
      notice.textContent = "Vorschau gekürzt, da die Datei sehr groß ist.";
      wrap.appendChild(notice);
    }

    const pre = document.createElement("pre");
    pre.textContent = text || `Keine lesbaren Textinhalte in ${fileName || "dieser Datei"} gefunden.`;
    wrap.appendChild(pre);

    content.appendChild(wrap);
  }

  function renderEmlPreview(content, rawText, truncated = false) {
    content.textContent = "";

    const split = splitMailHeaderBody(rawText);
    const headers = parseMailHeaders(split.headerText);
    const body = extractEmlBody(split.headerText, split.bodyText);

    const wrap = document.createElement("div");
    wrap.className = "zh-preview-mail";

    if (truncated) {
      const notice = document.createElement("div");
      notice.className = "zh-preview-notice";
      notice.textContent = "Vorschau gekürzt, da die E-Mail sehr groß ist.";
      wrap.appendChild(notice);
    }

    const meta = document.createElement("dl");
    [
      ["Von", getMailHeader(headers, "from")],
      ["An", getMailHeader(headers, "to")],
      ["Cc", getMailHeader(headers, "cc")],
      ["Datum", getMailHeader(headers, "date")],
      ["Betreff", getMailHeader(headers, "subject")]
    ].forEach(([label, value]) => {
      if (!value) return;

      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      meta.append(dt, dd);
    });

    const pre = document.createElement("pre");
    pre.textContent = body || rawText || "Keine lesbaren E-Mail-Inhalte gefunden.";

    wrap.append(meta, pre);
    content.appendChild(wrap);
  }

  function renderDocxMessages(container, messages) {
    if (!Array.isArray(messages) || messages.length === 0) return;

    const details = document.createElement("details");
    details.className = "zh-preview-docx-messages";

    const summary = document.createElement("summary");
    summary.textContent = `${messages.length} Hinweis(e) zur DOCX-Konvertierung`;
    details.appendChild(summary);

    const list = document.createElement("ul");
    messages.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message.message || String(message);
      list.appendChild(item);
    });
    details.appendChild(list);
    container.appendChild(details);
  }

  async function renderDocxPreview(content, blob) {
    content.textContent = "";

    const mammothApi = globalThis.mammoth;
    if (!mammothApi?.convertToHtml) {
      throw new Error("Mammoth ist nicht geladen");
    }

    const result = await mammothApi.convertToHtml({
      arrayBuffer: await blob.arrayBuffer()
    });

    const wrap = document.createElement("div");
    wrap.className = "zh-preview-docx";

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "");
    iframe.srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 18px 22px; font: 14px/1.5 Arial, sans-serif; color: #111; background: #fff; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; max-width: 100%; }
  td, th { border: 1px solid #ccc; padding: 4px 6px; vertical-align: top; }
  a { color: #064f9e; }
</style>
</head>
<body>${result.value || "<p>Keine lesbaren DOCX-Inhalte gefunden.</p>"}</body>
</html>`;
    iframe.title = "DOCX-Vorschau";
    wrap.appendChild(iframe);

    renderDocxMessages(wrap, result.messages);
    content.appendChild(wrap);
  }

  function spreadsheetColumnName(index) {
    let value = index + 1;
    let name = "";

    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }

    return name;
  }

  function buildSpreadsheetTableHtml(sheetApi, sheet) {
    const range = sheet?.["!ref"] ? sheetApi.utils.decode_range(sheet["!ref"]) : null;
    if (!range) {
      return {
        html: "",
        notice: ""
      };
    }

    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    if (rowCount <= 0 || colCount <= 0) {
      return {
        html: "",
        notice: ""
      };
    }

    const visibleRowCount = Math.min(rowCount, SPREADSHEET_PREVIEW_MAX_ROWS);
    const maxCols = Math.min(colCount, SPREADSHEET_PREVIEW_MAX_COLS);
    const truncatedRows = rowCount > SPREADSHEET_PREVIEW_MAX_ROWS;
    const truncatedCols = colCount > SPREADSHEET_PREVIEW_MAX_COLS;

    if (!maxCols) {
      return {
        html: "",
        notice: truncatedRows || truncatedCols ? "Die Vorschau wurde gekürzt." : ""
      };
    }

    const headerCells = Array.from({ length: maxCols }, (_, index) =>
      `<th scope="col">${spreadsheetColumnName(range.s.c + index)}</th>`
    ).join("");

    const bodyRows = Array.from({ length: visibleRowCount }, (_, rowOffset) => {
      const rowIndex = range.s.r + rowOffset;
      const cells = Array.from({ length: maxCols }, (_, colOffset) => {
        const address = sheetApi.utils.encode_cell({ r: rowIndex, c: range.s.c + colOffset });
        const cell = sheet[address];
        const value = cell?.w ?? cell?.v ?? "";
        return `<td>${escapeHtml(value)}</td>`;
      }).join("");

      return `<tr><th scope="row">${rowIndex + 1}</th>${cells}</tr>`;
    }).join("");

    const noticeParts = [];
    if (truncatedRows) noticeParts.push(`maximal ${SPREADSHEET_PREVIEW_MAX_ROWS} Zeilen`);
    if (truncatedCols) noticeParts.push(`maximal ${SPREADSHEET_PREVIEW_MAX_COLS} Spalten`);

    return {
      html: `<table class="zh-spreadsheet-table"><thead><tr><th></th>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`,
      notice: noticeParts.length ? `Die Vorschau zeigt ${noticeParts.join(" und ")}.` : ""
    };
  }

  function buildSpreadsheetHtml(tableHtml, sheetName, notice) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 14px; font: 13px/1.35 Arial, sans-serif; color: #111; background: #fff; }
  h1 { margin: 0 0 10px; font-size: 16px; }
  table { border-collapse: collapse; max-width: none; }
  td, th { border: 1px solid #c7c7c7; padding: 4px 7px; vertical-align: top; white-space: pre-wrap; }
  thead th { position: sticky; top: 0; background: #f0f0f0; z-index: 2; }
  tbody th { position: sticky; left: 0; background: #f0f0f0; z-index: 1; text-align: right; color: #555; }
  tr:nth-child(even) td { background: #fafafa; }
  .zh-spreadsheet-notice { margin: 0 0 10px; padding: 7px 9px; border: 1px solid #e3b34d; background: #fff4cf; color: #4b3a00; font-size: 12px; }
</style>
</head>
<body>
<h1>${escapeHtml(sheetName)}</h1>
${notice ? `<p class="zh-spreadsheet-notice">${escapeHtml(notice)}</p>` : ""}
${tableHtml || "<p>Keine lesbaren Tabelleninhalte gefunden.</p>"}
</body>
</html>`;
  }

  async function renderSpreadsheetPreview(content, blob) {
    content.textContent = "";

    const sheetApi = globalThis.XLSX;
    if (!sheetApi?.read || !sheetApi.utils?.decode_range || !sheetApi.utils?.encode_cell) {
      throw new Error("SheetJS ist nicht geladen");
    }

    // Pass a same-realm Uint8Array with an explicit type. In Firefox content
    // scripts the ArrayBuffer from blob.arrayBuffer() can come from another
    // realm, which makes SheetJS's own instanceof check fail and fall back to
    // treating the bytes as a base64 string ("e.replace is not a function").
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const workbook = sheetApi.read(bytes, {
      type: "array",
      cellDates: true,
      cellNF: false,
      cellStyles: false
    });

    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) throw new Error("Keine Tabellenblaetter gefunden");

    const wrap = document.createElement("div");
    wrap.className = "zh-preview-spreadsheet";

    const tabs = document.createElement("div");
    tabs.className = "zh-preview-spreadsheet-tabs";

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "");
    iframe.title = "XLSX-Vorschau";

    const showSheet = (sheetName, button) => {
      [...tabs.querySelectorAll("button")].forEach((item) => item.classList.toggle("is-active", item === button));
      const table = buildSpreadsheetTableHtml(sheetApi, workbook.Sheets[sheetName]);
      iframe.srcdoc = buildSpreadsheetHtml(table.html, sheetName, table.notice);
    };

    sheetNames.forEach((sheetName, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = sheetName || `Tabelle ${index + 1}`;
      button.addEventListener("click", () => showSheet(sheetName, button));
      tabs.appendChild(button);
    });

    wrap.append(tabs, iframe);
    content.appendChild(wrap);

    showSheet(sheetNames[0], tabs.querySelector("button"));
  }

  function findAttachmentContainer(anchor) {
    let element = anchor.parentElement;

    for (let index = 0; index < 6 && element; index += 1) {
      const text = element.innerText || "";
      const hasSize = /\b\d+[,.]?\d*\s*(KB|MB|GB)\b/i.test(text);

      if (hasSize && text.length < 500) {
        return element;
      }

      element = element.parentElement;
    }

    return anchor.parentElement;
  }

  async function openAttachmentPreview(anchor, fileName) {
    closeAttachmentPreview();
    const previewHrefs = getAttachmentPreviewHrefs(anchor, fileName);
    const previewHref = previewHrefs[0] || "";

    const backdrop = document.createElement("div");
    backdrop.className = "zh-preview-backdrop";

    const modal = document.createElement("div");
    modal.className = "zh-preview-modal";

    const header = document.createElement("div");
    header.className = "zh-preview-header";

    const title = document.createElement("div");
    title.className = "zh-preview-title";
    title.textContent = fileName;

    const actions = document.createElement("div");
    actions.className = "zh-preview-actions";

    const openTab = document.createElement("a");
    openTab.href = previewHref || anchor.href;
    openTab.target = "_blank";
    openTab.rel = "noopener";
    openTab.textContent = "Tab";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Schliessen";

    actions.append(openTab, closeButton);
    header.append(title, actions);

    const content = document.createElement("div");
    content.className = "zh-preview-content";
    content.innerHTML = '<div class="zh-preview-loading">Lade Vorschau...</div>';

    modal.append(header, content);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    closeButton.addEventListener("click", (event) => {
      stopEvent(event);
      closeAttachmentPreview();
    });

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeAttachmentPreview();
    });

    const escHandler = (event) => {
      if (event.key === "Escape") {
        closeAttachmentPreview();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);

    try {
      if (previewHrefs.length === 0) throw new Error("Keine Anhang-URL gefunden");

      let response = null;
      let loadedHref = "";

      for (const href of previewHrefs) {
        try {
          response = await fetch(href, {
            credentials: "include",
            cache: "no-store"
          });

          if (response.ok) {
            loadedHref = href;
            break;
          }
        } catch (error) {
          response = null;
        }
      }

      if (!response?.ok) {
        if (renderDirectAttachmentPreview(content, previewHref, fileName)) return;
        throw new Error("Anhang konnte nicht geladen werden");
      }

      const blob = await response.blob();
      const type = guessAttachmentType(fileName, blob.type);

      content.textContent = "";

      if (type === "pdf" && blob.type.includes("html") && renderDirectAttachmentPreview(content, loadedHref || previewHref, fileName)) {
        return;
      }

      const previewBlob = type === "pdf" && !blob.type.toLowerCase().includes("pdf")
        ? new Blob([blob], { type: "application/pdf" })
        : blob;
      const blobUrl = URL.createObjectURL(previewBlob);

      if (type === "pdf") {
        const iframe = document.createElement("iframe");
        // No "sandbox" here: Chromium's built-in PDF viewer refuses to
        // activate inside a sandboxed iframe at all (a known Chromium
        // limitation, independent of which tokens are granted), so sandboxing
        // this frame breaks PDF rendering outright rather than adding
        // protection. The viewer itself already runs isolated at the browser
        // process level.
        iframe.src = blobUrl;
        content.appendChild(iframe);
      } else if (type === "image") {
        const image = document.createElement("img");
        image.src = blobUrl;
        content.appendChild(image);
      } else if (type === "text") {
        const textBlob = blob.size > TEXT_PREVIEW_LIMIT ? blob.slice(0, TEXT_PREVIEW_LIMIT) : blob;
        const text = await decodeAttachmentText(textBlob);
        renderTextPreview(content, text, fileName, blob.size > TEXT_PREVIEW_LIMIT);
      } else if (type === "eml") {
        const textBlob = blob.size > TEXT_PREVIEW_LIMIT ? blob.slice(0, TEXT_PREVIEW_LIMIT) : blob;
        const text = await decodeAttachmentText(textBlob);
        renderEmlPreview(content, text, blob.size > TEXT_PREVIEW_LIMIT);
      } else if (type === "docx") {
        await renderDocxPreview(content, blob);
      } else if (type === "spreadsheet") {
        await renderSpreadsheetPreview(content, blob);
      } else {
        const fallback = document.createElement("div");
        fallback.className = "zh-preview-loading";
        fallback.textContent = type === "word"
          ? "Alte DOC-Dateien kann Mammoth nicht direkt anzeigen. Bitte die Datei öffnen oder in DOCX umwandeln."
          : "Für diesen Dateityp ist keine direkte Vorschau möglich.";

        const link = document.createElement("a");
        link.href = blobUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Datei öffnen";

        fallback.append(document.createElement("br"), document.createElement("br"), link);
        content.appendChild(fallback);
      }

      openTab.href = blobUrl;
    } catch (error) {
      content.innerHTML = "";
      const failure = document.createElement("div");
      failure.className = "zh-preview-loading";
      failure.textContent = `Vorschau konnte nicht geladen werden: ${error.message}`;
      content.appendChild(failure);
    }
  }

  function closeArticleImageLightbox() {
    document.querySelectorAll(".zh-image-lightbox-backdrop").forEach((element) => element.remove());
  }

  function openArticleImageLightbox(img) {
    closeArticleImageLightbox();

    const backdrop = document.createElement("div");
    backdrop.className = "zh-image-lightbox-backdrop";

    const large = document.createElement("img");
    large.src = img.currentSrc || img.src;
    large.alt = img.alt || "";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "zh-image-lightbox-close";
    closeButton.textContent = "Schliessen";
    closeButton.addEventListener("click", (event) => {
      stopEvent(event);
      closeArticleImageLightbox();
    });

    backdrop.append(large, closeButton);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeArticleImageLightbox();
    });

    const escHandler = (event) => {
      if (event.key === "Escape") {
        closeArticleImageLightbox();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }

  function isEnlargeableArticleImage(img) {
    if (!img) return false;
    if (img.closest(".zh-preview-backdrop, .zh-image-lightbox-backdrop, #zh-ticket-article-search")) return false;
    if (isNonArticleSearchArea(img)) return false;

    const table = img.closest("table");
    if (table && isArticleOverviewTable(table)) return false;

    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;
    return width >= 24 && height >= 24;
  }

  function bindArticleImageZoom() {
    const selector = [
      ".ArticleBody img",
      ".ArticleContent img",
      ".ArticleMailContent img",
      ".ArticleMailContentHTML img",
      ".MessageBody img",
      ".RichText img",
      ".Article img"
    ].join(", ");

    [...document.querySelectorAll(selector)].forEach((img) => {
      if (img.dataset.zhZoomBound === "1") return;
      img.dataset.zhZoomBound = "1";

      const markClickable = () => {
        if (isEnlargeableArticleImage(img)) img.classList.add("zh-article-image-zoomable");
      };

      if (img.complete) markClickable();
      else img.addEventListener("load", markClickable, { once: true });

      img.addEventListener("click", (event) => {
        if (!img.classList.contains("zh-article-image-zoomable")) return;
        stopEvent(event);
        openArticleImageLightbox(img);
      });
    });
  }

  function disableArticleImageZoom() {
    closeArticleImageLightbox();
    document.querySelectorAll("[data-zh-zoom-bound]").forEach((img) => {
      delete img.dataset.zhZoomBound;
      img.classList.remove("zh-article-image-zoomable");
    });
  }

  function enableAttachmentPreview() {
    addStyle("zh-attachment-preview-style", `
      .zh-attachment-container { position: relative !important; padding-right: 150px !important; min-height: 52px !important; }
      .zh-attachment-btn { position: absolute; right: 38px; top: 9px; z-index: 50; font-size: 12px; font-weight: 700; padding: 6px 11px; cursor: pointer; border: 1px solid #d98200; border-radius: 999px; background: #ff9900; color: #111; box-shadow: 0 2px 5px rgba(0,0,0,.25); line-height: 1.2; white-space: nowrap; }
      .zh-attachment-btn:hover { background: #ffb13b; border-color: #b86f00; }
      .zh-attachment-btn:active { transform: translateY(1px); }
      .zh-preview-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 999998; display: flex; align-items: center; justify-content: center; }
      .zh-preview-modal { width: 88vw; height: 88vh; background: #f7f7f7; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,.45); display: flex; flex-direction: column; overflow: hidden; border: 1px solid #999; }
      .zh-preview-header { height: 38px; flex: 0 0 38px; background: #222; color: white; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 13px; border-bottom: 3px solid #ff9900; }
      .zh-preview-title { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 70vw; font-weight: bold; }
      .zh-preview-actions { display: flex; gap: 6px; align-items: center; }
      .zh-preview-actions button, .zh-preview-actions a { font-size: 11px; padding: 3px 8px; border: 1px solid #999; border-radius: 4px; background: #eee; color: #111; cursor: pointer; text-decoration: none; }
      .zh-preview-actions button:hover, .zh-preview-actions a:hover { background: #fff; }
      .zh-preview-content { flex: 1; min-height: 0; background: #ddd; display: flex; align-items: center; justify-content: center; overflow: auto; }
      .zh-preview-content iframe { width: 100%; height: 100%; border: none; background: white; }
      .zh-preview-content img { max-width: 100%; max-height: 100%; object-fit: contain; background: white; }
      .zh-preview-loading { font-size: 14px; color: #333; padding: 20px; text-align: center; }
      .zh-preview-text, .zh-preview-mail { align-self: stretch; width: 100%; min-height: 100%; box-sizing: border-box; background: #fff; color: #111; overflow: auto; padding: 14px 16px; }
      .zh-preview-text pre, .zh-preview-mail pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.45 Consolas, "Courier New", monospace; }
      .zh-preview-mail dl { display: grid; grid-template-columns: max-content 1fr; gap: 5px 12px; margin: 0 0 14px; padding: 0 0 12px; border-bottom: 1px solid #ddd; }
      .zh-preview-mail dt { font-weight: 700; color: #555; }
      .zh-preview-mail dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
      .zh-preview-notice { margin: 0 0 10px; padding: 7px 9px; border: 1px solid #e3b34d; background: #fff4cf; color: #4b3a00; font-size: 12px; }
      .zh-preview-docx { align-self: stretch; width: 100%; min-height: 100%; display: flex; flex-direction: column; background: #fff; }
      .zh-preview-docx iframe { flex: 1; min-height: 0; width: 100%; border: 0; background: #fff; }
      .zh-preview-docx-messages { flex: 0 0 auto; border-top: 1px solid #ddd; background: #fff8dd; color: #4b3a00; padding: 7px 10px; font-size: 12px; }
      .zh-preview-docx-messages summary { cursor: pointer; font-weight: 700; }
      .zh-preview-docx-messages ul { margin: 6px 0 0 18px; padding: 0; }
      .zh-preview-spreadsheet { align-self: stretch; width: 100%; min-height: 100%; display: flex; flex-direction: column; background: #fff; }
      .zh-preview-spreadsheet-tabs { flex: 0 0 auto; display: flex; gap: 5px; overflow-x: auto; padding: 7px 8px; background: #f1f1f1; border-bottom: 1px solid #cfcfcf; }
      .zh-preview-spreadsheet-tabs button { border: 1px solid #aaa; background: #fff; color: #111; padding: 4px 9px; cursor: pointer; white-space: nowrap; font-size: 12px; }
      .zh-preview-spreadsheet-tabs button.is-active { background: #ff9900; border-color: #b86f00; font-weight: 700; }
      .zh-preview-spreadsheet iframe { flex: 1; min-height: 0; width: 100%; border: 0; background: #fff; }
      .zh-article-image-zoomable { cursor: zoom-in; transition: outline-color .1s ease; }
      .zh-article-image-zoomable:hover { outline: 2px solid #ff9900; outline-offset: 2px; }
      .zh-image-lightbox-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 999999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
      .zh-image-lightbox-backdrop img { max-width: 92vw; max-height: 92vh; object-fit: contain; box-shadow: 0 10px 40px rgba(0,0,0,.5); border-radius: 4px; cursor: default; }
      .zh-image-lightbox-close { position: absolute; top: 16px; right: 20px; font-size: 13px; font-weight: 700; padding: 6px 12px; border: 1px solid #999; border-radius: 999px; background: #eee; color: #111; cursor: pointer; }
      .zh-image-lightbox-close:hover { background: #fff; }
    `);

    bindArticleImageZoom();

    [...document.querySelectorAll("a[href]")]
      .filter(looksLikeAttachmentLink)
      .forEach((anchor, index) => {
        if (anchor.dataset.zhAttachmentEnhanced === "1") return;

        const container = findAttachmentContainer(anchor);
        if (!container) return;

        anchor.dataset.zhAttachmentEnhanced = "1";
        container.classList.add("zh-attachment-container");

        const button = document.createElement("button");
        button.type = "button";
        button.className = "zh-attachment-btn";
        button.textContent = "Vorschau";
    button.title = "Anhang groß anzeigen";

        ["mousedown", "mouseup", "dblclick"].forEach((type) => {
          button.addEventListener(type, stopEvent, true);
        });

        button.addEventListener("click", (event) => {
          stopEvent(event);
          openAttachmentPreview(anchor, getFileName(anchor, index));
        }, true);

        container.appendChild(button);
      });
  }

  function disableAttachmentPreview() {
    closeAttachmentPreview();
    disableArticleImageZoom();
    removeStyle("zh-attachment-preview-style");

    document.querySelectorAll(".zh-attachment-btn").forEach((element) => element.remove());
    document.querySelectorAll(".zh-attachment-container").forEach((element) => element.classList.remove("zh-attachment-container"));
    document.querySelectorAll("[data-zh-attachment-enhanced]").forEach((element) => delete element.dataset.zhAttachmentEnhanced);
  }

  function fixTicketNumberSearch() {
    const form = findVisibleSearchForm();
    const attr = findSearchAttributeControl(form);
    if (!form) return;

    if (form.dataset.zhSearchEnhanced === "1") {
      cleanupEnhancedSearchForm(form);
      return;
    }

    addSearchModalStyles();
    installSearchAlertBypass();

    if (attr && !attr.__znunyHelperOriginalOptions) {
      attr.__znunyHelperOriginalOptions = [...attr.options].map((option) => ({
        value: option.value,
        text: option.textContent,
        selected: option.selected
      }));
    }

    if (attr?.__znunyHelperOriginalOptions && attr.options.length <= 1) {
      restoreSearchAttributeOptions(attr, false);
    }

    const fulltextControl = ensureFulltextControl(form);
    const ticketNumberControl = ensureTicketNumberControl(form);
    document.getElementById("zh-createdmonths-row")?.remove();
    ensureCreatedDateFilter(form);
    const primaryBlock = getOrCreateSearchPrimaryBlock(form);

    if (fulltextControl) {
      getOrCreateCleanSearchRow(primaryBlock, "zh-fulltext-row", "Volltext:", fulltextControl, "Suchbegriff eingeben");
      attachSearchHistory(fulltextControl, "fulltext");
    }

    if (ticketNumberControl) {
      getOrCreateCleanSearchRow(primaryBlock, "zh-ticketnumber-row", "Ticketnummer:", ticketNumberControl, "z. B. 86121234 oder 86126767");
      attachSearchHistory(ticketNumberControl, "ticketNumber");
      bindTicketNumberFulltextFallback(fulltextControl, ticketNumberControl);
    }

    ensureSearchDateRangeQuickButtons(form, primaryBlock);

    moveKnownSearchSectionsAfterPrimary(form, primaryBlock);
    hideOldUsedFilterScaffold(form);
    prepareSearchFormNewTab(form);
    rememberSearchOnSubmit(form, fulltextControl, ticketNumberControl, null);
    form.dataset.zhSearchEnhanced = "1";

    if (fulltextControl && fulltextControl.dataset.zhFocused !== "1") {
      fulltextControl.dataset.zhFocused = "1";
      window.setTimeout(() => {
        fulltextControl.focus();
        if (typeof fulltextControl.select === "function") {
          fulltextControl.select();
        }
      }, 80);
    }
  }

  function restoreTicketNumberSearch() {
    const form = findVisibleSearchForm();
    const attr = findSearchAttributeControl(form);
    if (!attr?.__znunyHelperOriginalOptions) return;

    restoreSearchAttributeOptions(attr, true);

    removeStyle("zh-search-modal-style");
  }

  function restoreSearchAttributeOptions(attr, dispatchChange) {
    if (!attr?.__znunyHelperOriginalOptions) return;

    attr.innerHTML = "";
    attr.__znunyHelperOriginalOptions.forEach((original) => {
      const option = document.createElement("option");
      option.value = original.value;
      option.textContent = original.text;
      option.selected = original.selected;
      attr.appendChild(option);
    });

    delete attr.__znunyHelperOriginalOptions;
    if (dispatchChange) {
      attr.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function cleanupEnhancedSearchForm(form) {
    hideOldUsedFilterScaffold(form);
  }

  function elementIsVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findVisibleSearchForm() {
    const forms = [...document.querySelectorAll("#SearchForm")];
    return forms.find(elementIsVisible) || forms[forms.length - 1] || null;
  }

  function findSearchAttributeControl(form) {
    return form?.querySelector("#Attribute") ||
      [...document.querySelectorAll("#Attribute")].find(elementIsVisible) ||
      document.querySelector("#Attribute");
  }

  function findFormControl(form, names) {
    const helperControl = form.querySelector('[data-zh-ticketnumber-control="1"]');
    if (helperControl && names.includes("TicketNumber")) return helperControl;

    for (const name of names) {
      const control = form.querySelector(`[name="${name}"], #${name}`);
      if (control) return control;
    }

    return null;
  }

  function findSearchFieldRow(control) {
    if (!control) return null;

    return control.closest("tr, li, .Field, .Row, .WidgetSimple, .ContentColumn") ||
      control.parentElement;
  }

  function ensureTicketNumberControl(form) {
    let ticketNumberControl = form.querySelector('[data-zh-ticketnumber-control="1"]');
    if (ticketNumberControl) return ticketNumberControl;

    ticketNumberControl = document.createElement("input");
    ticketNumberControl.id = "zh-ticketnumber-input";
    ticketNumberControl.name = "TicketNumber";
    ticketNumberControl.type = "text";
    ticketNumberControl.autocomplete = "off";
    ticketNumberControl.dataset.zhTicketnumberControl = "1";

    return ticketNumberControl;
  }

  function ensureFulltextControl(form) {
    let fulltextControl = findFormControl(form, ["Fulltext", "FullText", "FulltextSearch"]);
    if (fulltextControl) return fulltextControl;

    fulltextControl = document.createElement("input");
    fulltextControl.id = "zh-fulltext-input";
    fulltextControl.name = "Fulltext";
    fulltextControl.type = "text";
    fulltextControl.autocomplete = "off";
    fulltextControl.dataset.zhFulltextControl = "1";

    return fulltextControl;
  }

  function ensureHiddenInput(form, name, value) {
    let input = form.querySelector(`input[type="hidden"][name="${name}"][data-zh-created-date-filter="1"]`) ||
      form.querySelector(`input[type="hidden"][name="${name}"]`);

    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
    return input;
  }

  function optionText(option) {
    return normalizeText(`${option?.textContent || ""} ${option?.value || ""}`).toLowerCase();
  }

  function findOption(select, predicates) {
    if (!select?.options) return null;

    return [...select.options].find((option) => {
      const text = optionText(option);
      return predicates.some((predicate) => predicate(text, option));
    }) || null;
  }

  function selectOption(select, predicates) {
    const option = findOption(select, predicates);
    if (!option) return false;

    if (select.value !== option.value || !option.selected) {
      select.value = option.value;
      option.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  }

  function isDefaultTicketTimeAttributeText(text) {
    return (/letzte\s+ticket[-\s]?\u00e4nderungszeit|letzte\s+ticket[-\s]?aenderungszeit|ticket\s*change\s*time|ticketchangetime/i.test(text)) &&
      (/zwischen|between/i.test(text));
  }

  function findDefaultTicketTimeAttributeOption(attr) {
    if (!attr) return null;

    const current = [...attr.options].find((option) => isDefaultTicketTimeAttributeText(optionText(option)));
    if (current) return current;

    const original = (attr.__znunyHelperOriginalOptions || [])
      .find((option) => isDefaultTicketTimeAttributeText(`${option.text || ""} ${option.value || ""}`));

    if (!original) return null;

    const option = document.createElement("option");
    option.value = original.value;
    option.textContent = original.text;
    attr.appendChild(option);
    return option;
  }

  function getGeneratedFilterContainer(control, form) {
    return control?.closest("tr, li, fieldset, .Field, .Row, .WidgetSimple, .ContentColumn") ||
      findGeneratedSearchFieldRow(control, form);
  }

  function findDefaultTicketTimeFilterContainers(form) {
    if (!form) return [];

    const containers = [];
    const addContainer = (container) => {
      if (!container || container === form || container.closest("#zh-search-primary-fields")) return;
      if (container.querySelector("#Attribute")) return;
      if (!container.querySelector("input, select, textarea")) return;
      if (!containers.includes(container)) containers.push(container);
    };

    [...form.querySelectorAll("input, select, textarea")].forEach((control) => {
      if (control.closest("#zh-search-primary-fields")) return;

      const signature = `${control.name || ""} ${control.id || ""}`.toLowerCase();
      if (/ticket.*change.*time|change.*time.*ticket|ticketchange/i.test(signature)) {
        addContainer(getGeneratedFilterContainer(control, form));
      }
    });

    [...form.querySelectorAll("tr, li, fieldset, div")].forEach((element) => {
      if (element.closest("#zh-search-primary-fields")) return;
      if (element.querySelector("#Attribute")) return;

      const text = normalizeText(getElementText(element)).toLowerCase();
      if (isDefaultTicketTimeAttributeText(text)) {
        addContainer(element);
      }
    });

    return containers;
  }

  function getSameDateLastYear(date) {
    const lastYear = new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
    if (lastYear.getMonth() === date.getMonth()) return lastYear;

    return new Date(date.getFullYear() - 1, date.getMonth() + 1, 0);
  }

  function optionNumber(option) {
    const value = String(option?.value || "").trim();
    const text = normalizeText(option?.textContent || "").trim();
    const raw = value || text;
    const match = raw.match(/\d{1,4}/);
    return match ? Number.parseInt(match[0], 10) : NaN;
  }

  function selectDateNumber(select, number) {
    if (!select?.options) return false;

    const padded = String(number).padStart(2, "0");
    const exact = [...select.options].find((option) => {
      const value = String(option.value || "").trim();
      const text = normalizeText(option.textContent || "").trim();
      return value === String(number) || value === padded || text === String(number) || text === padded;
    });

    const numeric = exact || [...select.options].find((option) => optionNumber(option) === number);
    if (!numeric) return false;

    if (select.value !== numeric.value || !numeric.selected) {
      select.value = numeric.value;
      numeric.selected = true;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  }

  function fillTicketTimeRangeWithDates(form, start, end) {
    const containers = findDefaultTicketTimeFilterContainers(form);
    if (!containers.length) return false;

    const values = [
      start.getDate(), start.getMonth() + 1, start.getFullYear(),
      end.getDate(), end.getMonth() + 1, end.getFullYear()
    ];

    let filled = false;

    containers.forEach((container) => {
      const selects = [...container.querySelectorAll("select")]
        .filter((select) => select.id !== "Attribute")
        .filter((select) => !select.closest("#zh-search-primary-fields"))
        .filter((select) => !select.disabled)
        .filter((select) => [...select.options].some((option) => Number.isFinite(optionNumber(option))));

      if (selects.length < 6) return;

      values.forEach((value, index) => {
        filled = selectDateNumber(selects[index], value) || filled;
      });
    });

    return filled || containers.length > 0;
  }

  function fillDefaultTicketTimeRange(form) {
    const end = new Date();
    const start = getSameDateLastYear(end);
    return fillTicketTimeRangeWithDates(form, start, end);
  }

  function getDateDaysAgo(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  function getDateMonthsAgo(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
  }

  const SEARCH_DATE_RANGE_PRESETS = [
    { id: "week", label: "Letzte Woche", getStart: (now) => getDateDaysAgo(now, 7) },
    { id: "month", label: "Letzter Monat", getStart: (now) => getDateMonthsAgo(now, 1) },
    { id: "quarter", label: "Letztes Quartal", getStart: (now) => getDateMonthsAgo(now, 3) },
    { id: "year", label: "Letztes Jahr", getStart: (now) => getSameDateLastYear(now) }
  ];

  function applySearchDateRangePreset(form, preset) {
    const end = new Date();
    const start = preset.getStart(end);
    fillTicketTimeRangeWithDates(form, start, end);
    cleanupEmptyGeneratedSearchFilterRows(form);
  }

  function ensureSearchDateRangeQuickButtons(form, primaryBlock) {
    let row = document.getElementById("zh-search-daterange-row");
    if (!row) {
      row = document.createElement("div");
      row.id = "zh-search-daterange-row";
      row.className = "zh-search-field-row zh-search-daterange-row";

      const label = document.createElement("span");
      label.className = "zh-search-daterange-label";
      label.textContent = "Zeitraum:";
      row.appendChild(label);

      const buttons = document.createElement("div");
      buttons.className = "zh-search-daterange-buttons";

      SEARCH_DATE_RANGE_PRESETS.forEach((preset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = preset.label;
        button.dataset.presetId = preset.id;
        button.addEventListener("click", (event) => {
          stopEvent(event);
          const activeForm = findVisibleSearchForm() || form;
          applySearchDateRangePreset(activeForm, preset);
        });
        buttons.appendChild(button);
      });

      row.appendChild(buttons);
    }

    primaryBlock.appendChild(row);
  }

  function removeLegacyCreatedTimeFilters(form) {
    if (!form) return;

    form.querySelectorAll('[data-zh-created-date-filter="1"], input[name="TicketCreateTimeNewerMinutes"]').forEach((element) => {
      const name = String(element.name || "");
      if (/ticket.*create.*time|ticketcreate|TicketCreateTimeNewerMinutes/i.test(name)) {
        element.remove();
      } else {
        delete element.dataset.zhCreatedDateFilter;
      }
    });

    [...form.querySelectorAll("tr, li, fieldset, div")].forEach((element) => {
      if (element.closest("#zh-search-primary-fields")) return;
      if (element.querySelector("#Attribute")) return;

      const text = normalizeText(getElementText(element)).toLowerCase();
      const hasTicketCreateInput = [...element.querySelectorAll("input, select, textarea")]
        .some((control) => /ticket.*create.*time|create.*time.*ticket|ticketcreate/i.test(`${control.name || ""} ${control.id || ""}`));

      if ((/ticket[-\s]?erstellzeit|ticket\s*create\s*time/i.test(text) || hasTicketCreateInput) &&
          element.querySelector("input, select, textarea")) {
        element.remove();
      }
    });
  }

  function requestDefaultTicketTimeAttribute(form) {
    const attr = findSearchAttributeControl(form);
    const option = findDefaultTicketTimeAttributeOption(attr);
    if (!attr || !option) return false;

    if (form.dataset.zhDefaultTicketTimeAttributeRequested === "1" &&
        findDefaultTicketTimeFilterContainers(form).length) {
      return true;
    }

    form.dataset.zhDefaultTicketTimeAttributeRequested = "1";
    attr.value = option.value;
    option.selected = true;
    attr.dispatchEvent(new Event("input", { bubbles: true }));
    attr.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function ensureCreatedDateFilter(form) {
    removeLegacyCreatedTimeFilters(form);

    if (fillDefaultTicketTimeRange(form)) {
      cleanupEmptyGeneratedSearchFilterRows(form);
      return;
    }

    if (requestDefaultTicketTimeAttribute(form)) {
      [0, 150, 600].forEach((delay) => {
        window.setTimeout(() => {
          fillDefaultTicketTimeRange(form);
          cleanupEmptyGeneratedSearchFilterRows(form);
        }, delay);
      });
    }
  }

  function cleanupEmptyGeneratedSearchFilterRows(form) {
    if (!form) return;

    [...form.querySelectorAll("tr, li, div")].forEach((element) => {
      if (element.closest("#zh-search-primary-fields")) return;
      if (element.querySelector("#Attribute")) return;
      if (element.querySelector("select, textarea")) return;

      const inputs = [...element.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]')];
      if (inputs.length !== 1 || String(inputs[0].value || "").trim()) return;

      const text = normalizeText(getElementText(element));
      if (text && !/^[\s\-–—x×]+$/i.test(text)) return;

      const hasRemoveControl = element.querySelector('button, a, img, input[type="button"]');
      if (hasRemoveControl) element.remove();
    });
  }

  function isDuplicateTicketNumberInput(input, primaryControl) {
    if (!input || input === primaryControl) return false;
    if (input.closest("#zh-search-primary-fields")) return false;

    const placeholder = input.getAttribute("placeholder") || "";
    const value = input.value || "";

    return input.name === "TicketNumber" ||
      input.name === "TicketNumberRaw" ||
      /10\*5155|105658|ticket/i.test(placeholder) ||
      /10\*5155|105658/.test(value);
  }

  function findGeneratedSearchFieldRow(input, form) {
    let element = input.parentElement;
    let candidate = input.parentElement;

    while (element && element !== form) {
      if (element.matches("tr, li, .Field, .Row, .WidgetSimple, .ContentColumn")) return element;

      const controls = element.querySelectorAll("input, select, textarea").length;
      const text = normalizeText(getElementText(element));

      if (controls <= 2 && text.length <= 160) {
        candidate = element;
      }

      if (element.parentElement === form) return candidate || element;
      element = element.parentElement;
    }

    return candidate;
  }

  function hideDuplicateTicketNumberRows(form, primaryControl) {
    const candidates = [...form.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]')]
      .filter((input) => isDuplicateTicketNumberInput(input, primaryControl));

    candidates.forEach((input) => {
      const row = findGeneratedSearchFieldRow(input, form);
      input.disabled = true;
      input.classList.add("zh-search-hidden-scaffold");

      if (row && row !== form && !row.closest("#zh-search-primary-fields") && !row.querySelector("#Attribute")) {
        row.classList.add("zh-search-hidden-scaffold");
        row.remove();
      }
    });
  }

  function getSearchHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "{}");
      return {
        fulltext: Array.isArray(parsed.fulltext) ? parsed.fulltext : [],
        ticketNumber: Array.isArray(parsed.ticketNumber) ? parsed.ticketNumber : []
      };
    } catch (error) {
      return { fulltext: [], ticketNumber: [] };
    }
  }

  function saveSearchHistoryEntry(type, value) {
    const clean = String(value || "").trim();
    if (!clean) return;

    const history = getSearchHistory();
    history[type] = [clean, ...(history[type] || []).filter((item) => item !== clean)].slice(0, 10);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }

  function attachSearchHistory(control, type) {
    if (!control) return;

    const listId = `zh-${type}-history`;
    let list = document.getElementById(listId);
    const history = getSearchHistory()[type] || [];

    if (!list) {
      list = document.createElement("datalist");
      list.id = listId;
      document.body.appendChild(list);
    }

    list.innerHTML = "";
    history.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      list.appendChild(option);
    });

    control.setAttribute("list", listId);
    renderSearchHistoryHints(control, type);
  }

  function renderSearchHistoryHints(control, type) {
    const row = control?.closest?.(".zh-search-field-row");
    if (!row) return;

    let historyWrap = row.querySelector(`.zh-search-history[data-history-type="${type}"]`);
    const history = (getSearchHistory()[type] || []).slice(0, 5);

    if (!historyWrap) {
      historyWrap = document.createElement("div");
      historyWrap.className = "zh-search-history";
      historyWrap.dataset.historyType = type;
      row.appendChild(historyWrap);
    }

    historyWrap.innerHTML = "";
    history.forEach((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = value;
      button.title = value;
      button.addEventListener("click", (event) => {
        stopEvent(event);
        control.value = value;
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.focus();
      });
      historyWrap.appendChild(button);
    });

    historyWrap.hidden = history.length === 0;
  }

  function getSearchControlValue(control) {
    const value = String(control?.value || "").trim();
    const placeholder = String(control?.getAttribute?.("placeholder") || "").trim();

    if (control?.dataset?.zhAutoWildcard === "1" && value === "*") return "";
    if (placeholder && value.toLowerCase() === placeholder.toLowerCase()) return "";
    if (/^suchbegriff eingeben$/i.test(value)) return "";

    return value;
  }

  function isTicketNumberOnlySearch(fulltextControl, ticketNumberControl) {
    const ticketNumber = getSearchControlValue(ticketNumberControl);
    const fulltext = getSearchControlValue(fulltextControl);
    return Boolean(ticketNumber && !fulltext);
  }

  function syncTicketNumberFulltextFallback(fulltextControl, ticketNumberControl) {
    if (!fulltextControl) return;

    const ticketNumber = getSearchControlValue(ticketNumberControl);
    const fulltext = getSearchControlValue(fulltextControl);

    if (ticketNumber && !fulltext) {
      fulltextControl.value = "*";
      fulltextControl.dataset.zhAutoWildcard = "1";
      return;
    }

    if (!ticketNumber && fulltextControl.dataset.zhAutoWildcard === "1") {
      fulltextControl.value = "";
      delete fulltextControl.dataset.zhAutoWildcard;
    }
  }

  function bindTicketNumberFulltextFallback(fulltextControl, ticketNumberControl) {
    if (!fulltextControl || !ticketNumberControl || ticketNumberControl.dataset.zhFulltextFallbackBound === "1") return;

    ticketNumberControl.dataset.zhFulltextFallbackBound = "1";
    ["input", "change"].forEach((eventName) => {
      ticketNumberControl.addEventListener(eventName, () => {
        syncTicketNumberFulltextFallback(fulltextControl, ticketNumberControl);
      });
    });
    syncTicketNumberFulltextFallback(fulltextControl, ticketNumberControl);
  }

  function isSearchSubmitControl(target, form = null) {
    const control = target?.closest?.('button, a, [role="button"], input[type="submit"], input[type="button"]');
    if (!control) return false;
    if (form && !form.contains(control) && !control.closest(".Dialog, .Modal, #SearchDialog, .Popup")) return false;

    const text = normalizeText(control.value || control.innerText || control.textContent || "").toLowerCase();

    return text.includes("suche starten") ||
      (control.tagName === "INPUT" && String(control.type || "").toLowerCase() === "submit");
  }

  function submitSearchFormDirectly(form) {
    if (form.dataset.zhDirectSearchSubmitting === "1") return;
    form.dataset.zhDirectSearchSubmitting = "1";
    prepareSearchFormNewTab(form);
    window.setTimeout(() => {
      delete form.dataset.zhDirectSearchSubmitting;
    }, 5000);

    if (typeof HTMLFormElement !== "undefined" && HTMLFormElement.prototype.submit) {
      HTMLFormElement.prototype.submit.call(form);
    } else {
      form.submit();
    }
  }

  function getVisibleSearchControls() {
    const form = findVisibleSearchForm();
    if (!form) return null;

    return {
      form,
      fulltextControl: ensureFulltextControl(form),
      ticketNumberControl: form.querySelector('[data-zh-ticketnumber-control="1"]') ||
        findFormControl(form, ["TicketNumber", "TicketNumberRaw"]),
      createdMonthsControl: form.querySelector('[data-zh-createdmonths-control="1"]')
    };
  }

  function prepareSearchFormNewTab(form) {
    if (!form) return;

    if (!settings.searchResultsPopup) {
      form.removeAttribute("target");
      form.removeAttribute("rel");
      return;
    }

    form.target = "_blank";
    form.rel = "noopener noreferrer";
  }

  function prepareTicketNumberOnlySearch(form, fulltextControl, ticketNumberControl, createdMonthsControl) {
    const ticketNumber = getSearchControlValue(ticketNumberControl);
    if (!ticketNumber) return;

    ticketNumberControl.value = ticketNumber;

    if (fulltextControl) {
      fulltextControl.value = "*";
      fulltextControl.dataset.zhAutoWildcard = "1";
    } else {
      ensureHiddenInput(form, "Fulltext", "*");
    }

    ensureCreatedDateFilter(form, createdMonthsControl);
  }

  function isSearchValidationAlert(message) {
    const text = normalizeText(message || "").toLowerCase();
    return text.includes("zumindest einen suchbegriff") && text.includes("nach allem");
  }

  function runTicketNumberOnlySearchFromAlert(message) {
    if (!isSearchValidationAlert(message)) return false;

    const controls = getVisibleSearchControls();
    if (!controls?.form || !getSearchControlValue(controls.ticketNumberControl)) return false;

    const fulltext = getSearchControlValue(controls.fulltextControl);
    if (fulltext && fulltext !== "*") return false;

    prepareTicketNumberOnlySearch(
      controls.form,
      controls.fulltextControl,
      controls.ticketNumberControl,
      controls.createdMonthsControl
    );
    saveSearchHistoryEntry("ticketNumber", getSearchControlValue(controls.ticketNumberControl));
    renderSearchHistoryHints(controls.ticketNumberControl, "ticketNumber");

    window.setTimeout(() => submitSearchFormDirectly(controls.form), 0);
    return true;
  }

  function installSearchAlertBypass() {
    if (window.__znunyHelperSearchAlertBypass === "1") return;

    const originalAlert = window.alert.bind(window);
    window.__znunyHelperSearchAlertBypass = "1";

    window.alert = (message) => {
      if (runTicketNumberOnlySearchFromAlert(message)) return undefined;
      return originalAlert(message);
    };
  }

  function handleTicketNumberOnlySearch(event, form, fulltextControl, ticketNumberControl, createdMonthsControl) {
    if (!isTicketNumberOnlySearch(fulltextControl, ticketNumberControl)) return false;

    prepareTicketNumberOnlySearch(form, fulltextControl, ticketNumberControl, createdMonthsControl);
    saveSearchHistoryEntry("ticketNumber", getSearchControlValue(ticketNumberControl));
    renderSearchHistoryHints(ticketNumberControl, "ticketNumber");

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    submitSearchFormDirectly(form);
    return true;
  }

  function handleVisibleTicketNumberOnlySearch(event) {
    const controls = getVisibleSearchControls();
    if (!controls) return false;

    return handleTicketNumberOnlySearch(
      event,
      controls.form,
      controls.fulltextControl,
      controls.ticketNumberControl,
      controls.createdMonthsControl
    );
  }

  function rememberSearchOnSubmit(form, fulltextControl, ticketNumberControl, createdMonthsControl) {
    if (form.dataset.zhSearchHistoryBound === "1") return;
    form.dataset.zhSearchHistoryBound = "1";

    form.addEventListener("click", (event) => {
      if (!isSearchSubmitControl(event.target, form)) return;
      prepareSearchFormNewTab(form);
      handleVisibleTicketNumberOnlySearch(event);
    }, true);

    form.addEventListener("submit", (event) => {
      prepareSearchFormNewTab(form);
      if (handleVisibleTicketNumberOnlySearch(event)) return;

      ensureCreatedDateFilter(form, createdMonthsControl);
      saveSearchHistoryEntry("fulltext", getSearchControlValue(fulltextControl));
      saveSearchHistoryEntry("ticketNumber", getSearchControlValue(ticketNumberControl));
      renderSearchHistoryHints(fulltextControl, "fulltext");
      renderSearchHistoryHints(ticketNumberControl, "ticketNumber");
    }, true);

    if (document.documentElement.dataset.zhTicketSearchGlobalClick !== "1") {
      document.documentElement.dataset.zhTicketSearchGlobalClick = "1";
      ["pointerdown", "mousedown", "click"].forEach((eventName) => {
        document.addEventListener(eventName, (event) => {
          if (!isSearchSubmitControl(event.target)) return;
          prepareSearchFormNewTab(findVisibleSearchForm());
          handleVisibleTicketNumberOnlySearch(event);
        }, true);
      });
    }
  }

  function getOrCreateSearchPrimaryBlock(form) {
    let block = document.getElementById("zh-search-primary-fields");
    if (block) return block;

    block = document.createElement("div");
    block.id = "zh-search-primary-fields";

    const title = document.createElement("div");
    title.className = "zh-search-primary-title";
    title.textContent = "Suchen";
    block.appendChild(title);

    const firstContent = [...form.children].find((child) => {
      const text = getElementText(child).trim().toLowerCase();
      return text && text !== "suche";
    });

    form.insertBefore(block, firstContent || form.firstChild);
    return block;
  }

  function getOrCreateCleanSearchRow(primaryBlock, id, labelText, control, placeholder) {
    let row = document.getElementById(id);
    const sourceRow = findSearchFieldRow(control);

    if (!control.id) {
      control.id = `${id}-input`;
    }

    if (!row) {
      row = document.createElement("div");
      row.id = id;
      row.className = "zh-search-field-row";

      const label = document.createElement("label");
      label.textContent = labelText;
      label.htmlFor = control.id;
      row.appendChild(label);
    }

    control.placeholder = placeholder || "";
    control.classList.add("zh-search-primary-input");
    row.appendChild(control);
    primaryBlock.appendChild(row);

    if (sourceRow && sourceRow !== row && !sourceRow.closest("#zh-search-primary-fields")) {
      sourceRow.classList.add("zh-search-hidden-scaffold");
    }

    return row;
  }

  function moveKnownSearchSectionsAfterPrimary(form, primaryBlock) {
    const sectionTexts = ["vorlagen", "zus\u00e4tzliche filter"];

    sectionTexts.reverse().forEach((sectionText) => {
      const section = [...form.children].find((child) => {
        const text = getElementText(child).trim().toLowerCase();
        return text === sectionText || text.startsWith(`${sectionText}\n`);
      });

      if (section && section !== primaryBlock) {
        primaryBlock.after(section);
      }
    });
  }

  function hideOldUsedFilterScaffold(form) {
    [...form.querySelectorAll("h1, h2, h3, h4, strong, label, div, p, span")].forEach((element) => {
      if (element.closest("#zh-search-primary-fields")) return;

      const text = getElementText(element).trim().toLowerCase();
      if (["verwendete filter", "volltext:", "case:"].includes(text)) {
        element.classList.add("zh-search-hidden-scaffold");
      }
    });

    const emptyRows = [...form.querySelectorAll("div, li, tr")].filter((element) => {
      if (element.closest("#zh-search-primary-fields")) return false;
      if (element.querySelector("input, select, textarea, button")) return false;

      const text = getElementText(element).trim().toLowerCase();
      return ["verwendete filter", "volltext:", "case:"].includes(text);
    });

    emptyRows.forEach((element) => element.classList.add("zh-search-hidden-scaffold"));
  }

  function addSearchModalStyles() {
    addStyle("zh-search-modal-style", `
      #zh-search-primary-fields { padding: 12px 0 14px; border-bottom: 1px solid #d6d6d6; }
      #zh-search-primary-fields .zh-search-primary-title { width: 270px; margin: 0 auto 8px; font-weight: 700; text-align: left; }
      #zh-search-primary-fields .zh-search-field-row { display: grid; grid-template-columns: minmax(130px, 1fr) 270px minmax(130px, 1fr); align-items: center; gap: 8px; margin: 7px 0; }
      #zh-search-primary-fields .zh-search-field-row label { grid-column: 1; text-align: right; color: #777; }
      #zh-search-primary-fields .zh-search-primary-input { grid-column: 2; width: 270px; max-width: 45vw; box-sizing: border-box; }
      #zh-search-primary-fields .zh-search-history { grid-column: 2; display: flex; flex-wrap: wrap; gap: 4px; margin: -3px 0 2px; max-width: 270px; }
      #zh-search-primary-fields .zh-search-history[hidden] { display: none !important; }
      #zh-search-primary-fields .zh-search-history button { max-width: 128px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; line-height: 1.3; padding: 2px 6px; border: 1px solid #bdbdbd; border-radius: 3px; background: #f7f7f7; color: #333; cursor: pointer; }
      #zh-search-primary-fields .zh-search-history button:hover { background: #fff; border-color: #888; }
      .zh-search-daterange-label { grid-column: 1; text-align: right; color: #777; }
      .zh-search-daterange-buttons { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; width: 270px; max-width: 45vw; box-sizing: border-box; }
      .zh-search-daterange-buttons button { font-size: 11px; padding: 3px 8px; border: 1px solid #bdbdbd; border-radius: 3px; background: #f7f7f7; color: #333; cursor: pointer; white-space: nowrap; }
      .zh-search-daterange-buttons button:hover { background: #fff; border-color: #888; }
      .zh-search-hidden-scaffold { display: none !important; }
    `);
  }

  function findArticleOverviewTable(doc = document) {
    return [...doc.querySelectorAll("table")].find((table) => {
      return isArticleOverviewTable(table);
    });
  }

  function getElementText(element) {
    return element?.innerText || element?.textContent || "";
  }

  function isArticleOverviewTable(table) {
    const headers = [...table.querySelectorAll("th")].map((th) => getElementText(th).trim().toUpperCase());

    return headers.some((header) => header === "NR." || header === "NR") &&
      headers.some((header) => header.includes("SENDER")) &&
      headers.some((header) => header.includes("BETREFF")) &&
      headers.some((header) => header.includes("ERSTELLT"));
  }

  function getAccessibleSearchDocuments() {
    const docs = [document];

    document.querySelectorAll("iframe, frame").forEach((frame) => {
      try {
        const frameDoc = frame.contentDocument || frame.contentWindow?.document;
        if (frameDoc?.body) docs.push(frameDoc);
      } catch (error) {
        // Cross-origin frames cannot be searched directly.
      }
    });

    return docs;
  }

  function getTicketArticleSearchRoots() {
    return getAccessibleSearchDocuments().map((doc) =>
      doc.querySelector("#MainBox") ||
      doc.querySelector("#Content") ||
      doc.querySelector(".Content") ||
      doc.querySelector("#Center") ||
      doc.body
    ).filter(Boolean);
  }

  function getArticleSearchTerms(query) {
    const phrase = normalizeText(query).replace(/\s+/g, " ").trim();
    return phrase ? [phrase] : [];
  }

  function foldSearchChar(char, mode) {
    const lower = char.toLowerCase();

    if (lower === "\u00df") return "ss";

    if (mode === "german") {
      if (lower === "\u00e4") return "ae";
      if (lower === "\u00f6") return "oe";
      if (lower === "\u00fc") return "ue";
    }

    if (mode === "base") {
      if (lower === "\u00e4") return "a";
      if (lower === "\u00f6") return "o";
      if (lower === "\u00fc") return "u";
    }

    return lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function keepFoldedSearchChar(value) {
    return /^[a-z0-9]+$/.test(value);
  }

  function foldSearchText(value, mode) {
    return Array.from(String(value || ""))
      .map((char) => foldSearchChar(char, mode))
      .filter(keepFoldedSearchChar)
      .join("");
  }

  function foldSearchTextWithMap(value, mode) {
    const source = String(value || "");
    let folded = "";
    const map = [];

    Array.from(source).forEach((char, index) => {
      const foldedChar = foldSearchChar(char, mode);
      if (!keepFoldedSearchChar(foldedChar)) return;

      folded += foldedChar;

      for (let offset = 0; offset < foldedChar.length; offset += 1) {
        map.push(index);
      }
    });

    return { folded, map };
  }

  function getFoldedTermVariants(term) {
    return [...new Set([
      foldSearchText(term, "german"),
      foldSearchText(term, "base")
    ].filter(Boolean))];
  }

  function textMatchesSearchTerms(text, terms) {
    if (terms.length === 0) return false;

    const foldedTextVariants = [
      foldSearchText(text, "german"),
      foldSearchText(text, "base")
    ];

    return terms.every((term) => {
      const termVariants = getFoldedTermVariants(term);
      return foldedTextVariants.some((foldedText) =>
        termVariants.some((foldedTerm) => foldedText.includes(foldedTerm))
      );
    });
  }

  function addArticleSearchRowMatch(row) {
    if (!row || articleSearchState.rowMatches.includes(row)) return;

    row.classList.add("zh-ticket-search-row-hit");
    articleSearchState.rowMatches.push(row);
  }

  function findRangesForFoldMode(text, terms, mode) {
    const { folded, map } = foldSearchTextWithMap(text, mode);
    const ranges = [];

    terms.forEach((term) => {
      const foldedTerm = foldSearchText(term, mode);
      if (!foldedTerm) return;

      let start = folded.indexOf(foldedTerm);
      while (start !== -1) {
        const end = start + foldedTerm.length - 1;
        const originalStart = map[start];
        const originalEnd = map[end] + 1;

        if (Number.isInteger(originalStart) && Number.isInteger(originalEnd)) {
          ranges.push([originalStart, originalEnd]);
        }

        start = folded.indexOf(foldedTerm, start + Math.max(foldedTerm.length, 1));
      }
    });

    return ranges;
  }

  function mergeSearchRanges(ranges) {
    const sorted = ranges
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    const merged = [];

    sorted.forEach(([start, end]) => {
      const last = merged[merged.length - 1];

      if (!last || start > last[1]) {
        merged.push([start, end]);
      } else {
        last[1] = Math.max(last[1], end);
      }
    });

    return merged;
  }

  function findNormalizedSearchRanges(text, terms) {
    return mergeSearchRanges([
      ...findRangesForFoldMode(text, terms, "german"),
      ...findRangesForFoldMode(text, terms, "base")
    ]);
  }

  function clearArticleSearchHighlights() {
    clearArticleTextHighlights();

    document.querySelectorAll(".zh-ticket-search-row-hit").forEach((row) => {
      row.classList.remove("zh-ticket-search-row-hit");
    });

    document.querySelectorAll(".zh-ticket-search-row-active").forEach((row) => {
      row.classList.remove("zh-ticket-search-row-active");
    });

    articleSearchState.matches = [];
    articleSearchState.rowMatches = [];
    articleSearchState.blockMatches = [];
    articleSearchState.activeIndex = -1;
  }

  function clearArticleTextHighlights() {
    getAccessibleSearchDocuments().forEach((doc) => {
      doc.querySelectorAll("mark.zh-ticket-search-hit").forEach((mark) => {
        const text = doc.createTextNode(mark.textContent || "");
        mark.replaceWith(text);
        text.parentElement?.normalize();
      });

      doc.querySelectorAll(".zh-ticket-search-active").forEach((mark) => {
        mark.classList.remove("zh-ticket-search-active");
      });
    });

    getAccessibleSearchDocuments().forEach((doc) => {
      doc.querySelectorAll(".zh-ticket-search-block-hit, .zh-ticket-search-block-active").forEach((element) => {
        element.classList.remove("zh-ticket-search-block-hit", "zh-ticket-search-block-active");
      });
    });

    articleSearchState.matches = [];
    articleSearchState.blockMatches = [];
  }

  function textNodeCanBeHighlighted(node) {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue.trim()) return false;

    if (parent.closest("#zh-ticket-article-search")) return false;
    if (parent.closest("script, style, textarea, input, select, button, mark")) return false;
    if (parent.closest(".zh-preview-backdrop, .zh-note-popup")) return false;
    if (isNonArticleSearchArea(parent)) return false;

    const closestTable = parent.closest("table");
    if (closestTable && isArticleOverviewTable(closestTable)) return false;

    const rect = parent.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function highlightArticleSearchTerms(root, terms) {
    const createdMarks = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!textNodeCanBeHighlighted(node)) return NodeFilter.FILTER_REJECT;
        return findNormalizedSearchRanges(node.nodeValue, terms).length > 0 ?
          NodeFilter.FILTER_ACCEPT :
          NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    let current = walker.nextNode();

    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }

    nodes.forEach((node) => {
      const ownerDocument = node.ownerDocument || document;
      const fragment = ownerDocument.createDocumentFragment();
      const text = node.nodeValue;
      const ranges = findNormalizedSearchRanges(text, terms);
      let cursor = 0;

      ranges.forEach(([start, end]) => {
        if (start > cursor) {
          fragment.appendChild(ownerDocument.createTextNode(text.slice(cursor, start)));
        }

        const mark = ownerDocument.createElement("mark");
        mark.className = "zh-ticket-search-hit";
        mark.textContent = text.slice(start, end);
        createdMarks.push(mark);
        fragment.appendChild(mark);
        cursor = end;
      });

      if (cursor < text.length) {
        fragment.appendChild(ownerDocument.createTextNode(text.slice(cursor)));
      }

      node.replaceWith(fragment);
    });

    return createdMarks;
  }

  function markArticleOverviewRows(terms) {
    const table = findArticleOverviewTable();
    if (!table) return;

    [...table.querySelectorAll("tbody tr")].forEach((row) => {
      if (textMatchesSearchTerms(row.innerText, terms)) {
        addArticleSearchRowMatch(row);
      }
    });
  }

  function elementCanBeArticleSearchBlock(element) {
    if (!element || element.id === "zh-ticket-article-search") return false;
    if (element.closest("#zh-ticket-article-search")) return false;
    if (element.closest(".zh-preview-backdrop, .zh-note-popup")) return false;

    const closestTable = element.closest("table");
    if (closestTable && isArticleOverviewTable(closestTable)) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const text = normalizeText(element.innerText || "");
    return text.length >= 3 && text.length <= 5000;
  }

  function markVisibleArticleBlocks(terms) {
    getTicketArticleSearchRoots().forEach((root) => {
      const candidates = [...root.querySelectorAll("p, div, td, li, blockquote, pre, section, article")]
        .filter(elementCanBeArticleSearchBlock)
        .filter((element) => textMatchesSearchTerms(element.innerText, terms));

      candidates.forEach((element) => {
        const hasMatchingChild = candidates.some((candidate) =>
          candidate !== element && element.contains(candidate)
        );

        if (hasMatchingChild || articleSearchState.blockMatches.includes(element)) return;

        element.classList.add("zh-ticket-search-block-hit");
        articleSearchState.blockMatches.push(element);
      });
    });
  }

  function shouldUseDeepArticleSearch(terms) {
    return terms.some((term) => foldSearchText(term, "german").length >= 2);
  }

  function isNonArticleSearchArea(element) {
    return Boolean(element.closest(
      "#zh-ticket-article-search, .zh-preview-backdrop, .zh-note-popup, #Sidebar, .Sidebar, .SidebarColumn, .LayoutSidebar, .WidgetSimple.TicketInformation, .ActionRow, .LayoutActionRow, .Header, #Navigation, #ToolBar"
    ));
  }

  function getOpenedArticleSearchRoots(doc = document) {
    const selectors = [
      ".ArticleBody",
      ".ArticleContent",
      ".ArticleMailContent",
      ".ArticleMailContentHTML",
      ".MessageBody",
      ".RichText",
      ".Plain",
      ".Article"
    ];

    const candidates = selectors.flatMap((selector) => [...doc.querySelectorAll(selector)])
      .filter((element) => !isNonArticleSearchArea(element))
      .filter((element) => {
        const table = element.closest("table");
        if (table && isArticleOverviewTable(table)) return false;

        const rect = element.getBoundingClientRect();
        const text = normalizeText(getElementText(element));
        return rect.width > 0 && rect.height > 0 && text.length >= 2;
      });

    const minimalCandidates = candidates.filter((element) =>
      !candidates.some((candidate) => candidate !== element && element.contains(candidate))
    );

    if (minimalCandidates.length > 0) return minimalCandidates;

    return getTicketArticleSearchRoots()
      .filter((root) => root.ownerDocument === doc)
      .flatMap((root) => {
        const table = findArticleOverviewTable(doc);
        if (!table) return root;

        const tableBottom = table.getBoundingClientRect().bottom;
        const fallbackCandidates = [...root.querySelectorAll("div, td, pre, blockquote, section, article")]
          .filter((element) => !isNonArticleSearchArea(element))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            const text = normalizeText(getElementText(element));
            return rect.width > 0 && rect.height > 0 && rect.top > tableBottom && text.length >= 2 && text.length <= 20000;
          });

        const fallback = fallbackCandidates.filter((element) =>
          !fallbackCandidates.some((candidate) => candidate !== element && element.contains(candidate))
        );

        return fallback.length > 0 ? fallback : [root];
      });
  }

  function getTicketArticleRows() {
    const table = findArticleOverviewTable();
    return table ? [...table.querySelectorAll("tbody tr")] : [];
  }

  function getArticleRowUrl(row) {
    const directLink = row.querySelector(
      'a[href*="AgentTicketZoom"], a[href*="ArticleID"], a[href*="Article"]'
    );

    if (directLink?.href) return directLink.href;

    const clickSource = row.getAttribute("onclick") || "";
    const quotedUrl = clickSource.match(/['"]([^'"]*index\.pl[^'"]*)['"]/)?.[1];

    if (quotedUrl) {
      return new URL(quotedUrl, window.location.href).href;
    }

    const articleId = row.innerHTML.match(/ArticleID[=:]\s*["']?(\d+)/i)?.[1];
    const ticketId = window.location.href.match(/[?;]TicketID=(\d+)/i)?.[1];

    if (articleId && ticketId) {
      const url = new URL(window.location.href);
      url.search = `?Action=AgentTicketZoom;TicketID=${ticketId};ArticleID=${articleId}`;
      return url.href;
    }

    return "";
  }

  function htmlToSearchText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, noscript, #zh-ticket-article-search, #Sidebar, .Sidebar, .SidebarColumn, .LayoutSidebar, .ActionRow, .LayoutActionRow, #Navigation, #ToolBar").forEach((element) => element.remove());
    doc.querySelectorAll("table").forEach((table) => {
      if (isArticleOverviewTable(table)) table.remove();
    });
    return normalizeText(getElementText(doc.body));
  }

  async function searchLinkedArticleRows(terms, runId) {
    const rows = getTicketArticleRows();
    const requests = rows.map(async (row) => {
      if (articleSearchState.rowMatches.includes(row)) return;

      const url = getArticleRowUrl(row);
      if (!url) return;

      try {
        let text = articleSearchState.fetchCache.get(url);

        if (!text) {
          const response = await fetch(url, {
            credentials: "include",
            cache: "no-store"
          });

          if (!response.ok) return;
          text = htmlToSearchText(await response.text());
          articleSearchState.fetchCache.set(url, text);
        }

        if (runId !== articleSearchState.runId) return;

        if (textMatchesSearchTerms(text, terms)) {
          addArticleSearchRowMatch(row);
        }
      } catch (error) {
        console.warn("Znuny Helper article search fetch failed:", error);
      }
    });

    await Promise.all(requests);

    if (runId === articleSearchState.runId) {
      if (articleSearchState.matches.length === 0 && articleSearchState.rowMatches.length > 0 && articleSearchState.activeIndex < 0) {
        focusArticleSearchMatch(0);
      } else {
        updateArticleSearchStatus();
      }
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getCleanArticleSearchText(root) {
    const clone = root.cloneNode(true);

    clone.querySelectorAll("#zh-ticket-article-search, .zh-preview-backdrop, .zh-note-popup, script, style, noscript, input, select, textarea, button, #Sidebar, .Sidebar, .SidebarColumn, .LayoutSidebar, .ActionRow, .LayoutActionRow, #Navigation, #ToolBar").forEach((element) => {
      element.remove();
    });

    clone.querySelectorAll("table").forEach((table) => {
      if (isArticleOverviewTable(table)) table.remove();
    });

    return normalizeText(getElementText(clone));
  }

  function getSearchableOpenedArticleText() {
    return getAccessibleSearchDocuments().map((doc) => {
      return getOpenedArticleSearchRoots(doc)
        .map(getCleanArticleSearchText)
        .join("\n");
    }).join("\n");
  }

  function clickArticleRow(row) {
    const clickable =
      row.querySelector('a[href], button, [onclick], [role="button"]') ||
      row;

    clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function highlightCurrentlyOpenedArticle(terms) {
    clearArticleTextHighlights();
    addTicketArticleSearchStyles();

    getAccessibleSearchDocuments().flatMap((doc) => getOpenedArticleSearchRoots(doc)).forEach((root) => {
      articleSearchState.matches.push(...highlightArticleSearchTerms(root, terms));
    });
  }

  async function searchRowsByOpeningArticles(terms, runId) {
    const rows = getTicketArticleRows();
    if (rows.length === 0 || rows.length > 40) {
      updateArticleSearchStatus();
      return;
    }

    const matchedRows = [];
    suppressMutationScanUntil = Date.now() + Math.max(3000, rows.length * 520);
    setArticleSearchStatusText("Suche...");

    for (const row of rows) {
      if (runId !== articleSearchState.runId) return;
      if (articleSearchState.rowMatches.includes(row)) continue;

      clickArticleRow(row);
      await sleep(420);

      if (runId !== articleSearchState.runId) return;

      if (textMatchesSearchTerms(getSearchableOpenedArticleText(), terms)) {
        addArticleSearchRowMatch(row);
        matchedRows.push(row);
      }
    }

    if (runId !== articleSearchState.runId || matchedRows.length === 0) {
      updateArticleSearchStatus();
      return;
    }

    focusArticleSearchMatch(0);
  }

  function setArticleSearchStatusText(text) {
    const container = document.getElementById("zh-ticket-article-search");
    const status = container?.querySelector(".zh-ticket-search-status");
    if (status) status.textContent = text;
  }

  function updateArticleSearchStatus() {
    const container = document.getElementById("zh-ticket-article-search");
    const status = container?.querySelector(".zh-ticket-search-status");
    if (!status) return;

    if (
      articleSearchState.matches.length === 0 &&
      articleSearchState.rowMatches.length === 0 &&
      articleSearchState.blockMatches.length === 0
    ) {
      status.textContent = "0 Treffer";
      return;
    }

    if (articleSearchState.rowMatches.length > 0) {
      const current = articleSearchState.activeIndex >= 0 ? articleSearchState.activeIndex + 1 : 1;
      const textHits = articleSearchState.matches.length > 0 ? `, ${articleSearchState.matches.length} Treffer` : "";
      status.textContent = `${current}/${articleSearchState.rowMatches.length} Artikel${textHits}`;
      return;
    }

    if (articleSearchState.matches.length > 0) {
      const articleCount = articleSearchState.rowMatches.length + articleSearchState.blockMatches.length;
      const rowText = articleCount > 0 ? `, ${articleCount} Artikel` : "";
      status.textContent = `${articleSearchState.activeIndex + 1}/${articleSearchState.matches.length}${rowText}`;
      return;
    }

    status.textContent = `${articleSearchState.rowMatches.length + articleSearchState.blockMatches.length} Artikel`;
  }

  async function focusArticleSearchMatch(index) {
    document.querySelectorAll(".zh-ticket-search-row-active").forEach((row) => {
      row.classList.remove("zh-ticket-search-row-active");
    });

    getAccessibleSearchDocuments().forEach((doc) => {
      doc.querySelectorAll(".zh-ticket-search-block-active").forEach((element) => {
        element.classList.remove("zh-ticket-search-block-active");
      });
    });

    if (articleSearchState.rowMatches.length > 0) {
      articleSearchState.activeIndex = (index + articleSearchState.rowMatches.length) % articleSearchState.rowMatches.length;

      const activeRow = articleSearchState.rowMatches[articleSearchState.activeIndex];
      activeRow.classList.add("zh-ticket-search-row-active");
      activeRow.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      clickArticleRow(activeRow);
      await sleep(420);

      if (articleSearchState.terms.length > 0) {
        highlightCurrentlyOpenedArticle(articleSearchState.terms);

        if (articleSearchState.matches.length > 0) {
          articleSearchState.matches[0].classList.add("zh-ticket-search-active");
          articleSearchState.matches[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      }

      updateArticleSearchStatus();
      return;
    }

    if (articleSearchState.matches.length === 0 && articleSearchState.blockMatches.length > 0) {
      articleSearchState.activeIndex = (index + articleSearchState.blockMatches.length) % articleSearchState.blockMatches.length;

      const activeBlock = articleSearchState.blockMatches[articleSearchState.activeIndex];
      activeBlock.classList.add("zh-ticket-search-block-active");
      activeBlock.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      updateArticleSearchStatus();
      return;
    }

    if (articleSearchState.matches.length === 0) {
      updateArticleSearchStatus();
      return;
    }

    articleSearchState.matches.forEach((match) => match.classList.remove("zh-ticket-search-active"));
    articleSearchState.activeIndex = (index + articleSearchState.matches.length) % articleSearchState.matches.length;

    const active = articleSearchState.matches[articleSearchState.activeIndex];
    active.classList.add("zh-ticket-search-active");
    active.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    updateArticleSearchStatus();
  }

  function applyArticleSearch(query) {
    const runId = articleSearchState.runId + 1;
    articleSearchState.runId = runId;
    clearArticleSearchHighlights();

    const terms = getArticleSearchTerms(query);
    articleSearchState.terms = terms;
    if (terms.length === 0) {
      updateArticleSearchStatus();
      return;
    }

    addTicketArticleSearchStyles();
    const useDeepSearch = shouldUseDeepArticleSearch(terms);

    markArticleOverviewRows(terms);

    if (articleSearchState.rowMatches.length === 0 && useDeepSearch) {
      searchRowsByOpeningArticles(terms, runId);
      return;
    }

    if (articleSearchState.rowMatches.length > 0) {
      focusArticleSearchMatch(0);
    } else {
      updateArticleSearchStatus();
    }
  }

  function scheduleArticleSearch(query) {
    window.clearTimeout(articleSearchState.debounceTimer);
    articleSearchState.debounceTimer = window.setTimeout(() => applyArticleSearch(query), 180);
  }

  function addTicketArticleSearchStyles() {
    const css = `
      #zh-ticket-article-search { display: inline-flex; align-items: center; gap: 5px; margin-left: 18px; vertical-align: middle; }
      #zh-ticket-article-search input { width: 270px; max-width: 32vw; height: 26px; box-sizing: border-box; border: 1px solid #b8c0ca; border-radius: 4px; padding: 3px 8px; font-size: 12px; background: #fff; color: #111; }
      #zh-ticket-article-search button { height: 24px; min-width: 28px; border: 1px solid #aeb6c1; border-radius: 4px; background: #f7f8fa; color: #222; cursor: pointer; font-size: 12px; line-height: 1; }
      #zh-ticket-article-search button:hover { background: #fff; border-color: #77808c; }
      #zh-ticket-article-search .zh-ticket-search-status { min-width: 54px; color: #303842; font-size: 11px; white-space: nowrap; }
      mark.zh-ticket-search-hit { background: #fff176; color: #111; padding: 0 1px; border-radius: 2px; }
      mark.zh-ticket-search-active { background: #ff9900; outline: 2px solid #333; }
      tr.zh-ticket-search-row-hit > td { box-shadow: inset 0 0 0 9999px rgba(255, 241, 118, .42); }
      tr.zh-ticket-search-row-active > td { box-shadow: inset 0 0 0 9999px rgba(255, 153, 0, .28); outline: 2px solid #ff9900; outline-offset: -2px; }
      .zh-ticket-search-block-hit { box-shadow: inset 0 0 0 9999px rgba(255, 241, 118, .28); }
      .zh-ticket-search-block-active { outline: 2px solid #ff9900; outline-offset: 2px; }
    `;

    getAccessibleSearchDocuments().forEach((doc) => {
      addStyleToDocument(doc, "zh-ticket-article-search-style", css);
    });
  }

  function getTicketArticleSearchTarget() {
    return document.querySelector(".ActionRow") ||
      document.querySelector(".LayoutActionRow") ||
      document.querySelector(".TicketHeader") ||
      document.querySelector(".Headline") ||
      document.querySelector("h1")?.parentElement ||
      document.body;
  }

  function enableTicketArticleSearch() {
    if (!isTicketZoomPage()) return;

    addTicketArticleSearchStyles();

    if (document.getElementById("zh-ticket-article-search")) return;

    const container = document.createElement("div");
    container.id = "zh-ticket-article-search";

    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Im Ticket suchen...";
    input.autocomplete = "off";

    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.textContent = "<";
    previousButton.title = "Vorheriger Treffer";

    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = ">";
    nextButton.title = "Naechster Treffer";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "x";
    clearButton.title = "Suche leeren";

    const status = document.createElement("span");
    status.className = "zh-ticket-search-status";
    status.textContent = "0 Treffer";

    [input, previousButton, nextButton, clearButton, status].forEach(blockTicketNavigation);

    input.addEventListener("input", () => scheduleArticleSearch(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        stopEvent(event);
        focusArticleSearchMatch(articleSearchState.activeIndex + (event.shiftKey ? -1 : 1));
      }

      if (event.key === "Escape") {
        input.value = "";
        applyArticleSearch("");
      }
    });

    previousButton.addEventListener("click", (event) => {
      stopEvent(event);
      focusArticleSearchMatch(articleSearchState.activeIndex - 1);
    });

    nextButton.addEventListener("click", (event) => {
      stopEvent(event);
      focusArticleSearchMatch(articleSearchState.activeIndex + 1);
    });

    clearButton.addEventListener("click", (event) => {
      stopEvent(event);
      input.value = "";
      applyArticleSearch("");
      input.focus();
    });

    container.append(input, previousButton, nextButton, clearButton, status);
    getTicketArticleSearchTarget().appendChild(container);
  }

  function disableTicketArticleSearch() {
    window.clearTimeout(articleSearchState.debounceTimer);
    clearArticleSearchHighlights();
    document.getElementById("zh-ticket-article-search")?.remove();
    removeStyle("zh-ticket-article-search-style");
  }

  function copyTextToClipboard(text) {
    const value = String(text || "");
    if (!value) return Promise.resolve(false);

    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(value)
        .then(() => true)
        .catch(() => copyTextFallback(value));
    }

    return Promise.resolve(copyTextFallback(value));
  }

  function copyTextFallback(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }

    textarea.remove();
    return ok;
  }

  function addTicketNumberCopyStyles() {
    addStyle("zh-ticket-number-copy-style", `
      .zh-ticket-number-copy { cursor: pointer; border-radius: 4px; padding: 0 4px; margin: 0 -4px; transition: background-color .15s ease, color .15s ease; }
      .zh-ticket-number-copy:hover { background: rgba(57, 118, 187, .16); text-decoration: underline; }
      .zh-ticket-number-copy:focus-visible { outline: 2px solid #3976bb; outline-offset: 1px; }
      .zh-ticket-number-copy.zh-ticket-number-copied { background: #b7f0c0; color: #0a5d1e; text-decoration: none; }
    `);
  }

  function findTicketNumberTextNode(headline) {
    const walker = document.createTreeWalker(headline, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
      if (/\d{4,}/.test(node.nodeValue || "")) return node;
    }

    return null;
  }

  function enableTicketNumberCopy() {
    if (!isTicketZoomPage()) return;

    addTicketNumberCopyStyles();

    const headline = document.querySelector(".MainBox.TicketZoom .Headline h1") ||
      document.querySelector(".TicketZoom .Headline h1") ||
      document.querySelector(".Headline h1");
    if (!headline || headline.querySelector(".zh-ticket-number-copy")) return;

    const node = findTicketNumberTextNode(headline);
    if (!node) return;

    const match = node.nodeValue.match(/\d{4,}/);
    if (!match) return;

    const after = node.splitText(match.index);
    after.nodeValue = after.nodeValue.slice(match[0].length);

    const span = document.createElement("span");
    span.className = "zh-ticket-number-copy";
    span.textContent = match[0];
    span.title = "Case-/Ticketnummer kopieren";
    span.setAttribute("role", "button");
    span.tabIndex = 0;

    after.parentNode.insertBefore(span, after);

    const copy = () => {
      copyTextToClipboard(match[0]).then((ok) => {
        span.title = ok ? "Kopiert!" : "Kopieren nicht möglich";
        span.classList.add("zh-ticket-number-copied");
        window.setTimeout(() => {
          span.classList.remove("zh-ticket-number-copied");
          span.title = "Case-/Ticketnummer kopieren";
        }, 900);
      });
    };

    span.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copy();
    });
    span.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      copy();
    });
  }

  function disableTicketNumberCopy() {
    document.querySelectorAll(".zh-ticket-number-copy").forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
    removeStyle("zh-ticket-number-copy-style");
  }

  function getMainText() {
    return normalizeText(document.body ? document.body.innerText || "" : "");
  }

  function extractCase() {
    const match = getMainText().match(/Case\s*([0-9]+)/i);
    return match ? match[1] : "";
  }

  function isRelevantEbCase() {
    return /installation|\u00fcbergabe|uebergabe|ubergabe/i.test(getMainText());
  }

  function splitHardwareEntries(text) {
    const rawLines = normalizeText(text).split("\n").filter(Boolean);
    const result = [];
    let index = 0;

    while (index < rawLines.length) {
      const line = rawLines[index];

      if (/^\d+\s*x\s+/i.test(line) || /^37[01]\d{4}\s*[-\u2013\u2014>]/.test(line)) {
        result.push(line);
        index += 1;
        continue;
      }

      if (/-->\s*37[01]\d{4}\s*$/.test(line)) {
        if (index > 0 && !/^\d+\s*x\s+/i.test(rawLines[index - 1]) && !/37[01]\d{4}/.test(rawLines[index - 1])) {
          result.push(`${rawLines[index - 1]}\n${line}`);
        } else {
          result.push(line);
        }
      }

      index += 1;
    }

    return result;
  }

  function normalizeAssignedInventoryLine(line) {
    const match = normalizeText(line).match(/^(.*?)\s*(?:-->|->|=>)\s*(37[01]\d{4})\s*$/);
    if (!match) return "";

    const description = match[1].trim();
    const inventoryNumber = match[2];

    return description ? `${description} ${inventoryNumber}` : inventoryNumber;
  }

  function splitInventoryMarkerEntries(text) {
    const lines = normalizeText(text).split("\n").filter(Boolean);
    const result = [];
    let markerSeen = false;
    let inventorySeen = false;

    for (const line of lines) {
      if (/Es wurden folgende Inventarmarken vergeben:/i.test(line)) {
        markerSeen = true;
        continue;
      }

      if (!markerSeen) continue;

      const assignedLine = normalizeAssignedInventoryLine(line);
      if (assignedLine) {
        result.push(assignedLine);
        inventorySeen = true;
        continue;
      }

      if (inventorySeen && /^\d+\s*x\s+/i.test(line)) {
        break;
      }
    }

    return result;
  }

  function isInventoryLine(line) {
    return /\b(?:inv\.?\s*(?:nr\.?|nummer)?|inventar(?:nr\.?|nummer)?|inventarmarke)\s*[:#-]?\s*37[01]\d{4}\b/i.test(line) ||
      /\b37[01]\d{4}\b/.test(line);
  }

  function extractInventoryNumber(line) {
    return line.match(/\b(37[01]\d{4})\b/)?.[1] || "";
  }

  function isSerialLine(line) {
    return /\b(?:s\/n|sn|serial|serien(?:nr\.?|nummer)?)\s*[:#-]?\s*\S+/i.test(line);
  }

  function normalizeSerialLine(line) {
    const serial = line.match(/\b(?:s\/n|sn|serial|serien(?:nr\.?|nummer)?)\s*[:#-]?\s*(.+)$/i)?.[1]?.trim();
    return serial || line;
  }

  function isHardwareDescriptionLine(line) {
    if (!line || isInventoryLine(line) || isSerialLine(line)) return false;
    if (/^(hallo|sehr geehrte|viele gr|im auftrag|mit freundlichen|danke|gru[sz])/i.test(line)) return false;
    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(line)) return false;
    if (/^https?:\/\//i.test(line)) return false;
    if (/^(case|ticket|beschaffungsantrag)\b/i.test(line)) return false;

    return /[a-z]/i.test(line);
  }

  function splitHardwareEntriesFromInventoryBlocks(text) {
    const lines = normalizeText(text).split("\n").filter(Boolean);
    const result = [];
    let pendingDescription = "";
    let pendingSerial = "";

    lines.forEach((line) => {
      if (isSerialLine(line)) {
        pendingSerial = normalizeSerialLine(line);
        return;
      }

      if (isInventoryLine(line)) {
        const inventoryNumber = extractInventoryNumber(line);
        if (!inventoryNumber) return;

        const parts = [];
        if (pendingDescription) parts.push(pendingDescription);
        if (pendingSerial) parts.push(pendingSerial);
        parts.push(inventoryNumber);
        result.push(parts.join(" "));

        pendingDescription = "";
        pendingSerial = "";
        return;
      }

      if (isHardwareDescriptionLine(line)) {
        pendingDescription = line;
      }
    });

    return result;
  }

  function splitHardwareEntriesSmart(text) {
    const assignedInventoryEntries = splitInventoryMarkerEntries(text);
    if (assignedInventoryEntries.length > 0) return assignedInventoryEntries;

    return [
      ...splitHardwareEntries(text),
      ...splitHardwareEntriesFromInventoryBlocks(text)
    ];
  }

  function uniqueHardwareEntries(entries) {
    const byInventoryNumber = new Map();
    const withoutInventoryNumber = [];

    entries.map((entry) => normalizeAssignedInventoryLine(entry) || normalizeText(entry)).filter(Boolean).forEach((entry) => {
      const inventoryNumber = extractInventoryNumber(entry);

      if (!inventoryNumber) {
        withoutInventoryNumber.push(entry);
        return;
      }

      const current = byInventoryNumber.get(inventoryNumber);
      if (!current || entry.length > current.length) {
        byInventoryNumber.set(inventoryNumber, entry);
      }
    });

    return [...new Set([...byInventoryNumber.values(), ...withoutInventoryNumber])];
  }

  function extractFromMainDocument() {
    const text = getMainText();
    const markerMatch = text.match(/Es wurden folgende Inventarmarken vergeben:[\s\S]*/i);
    return splitHardwareEntriesSmart(markerMatch ? markerMatch[0] : text);
  }

  function extractFromIframes() {
    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    const results = [];

    for (const frame of frames) {
      try {
        const doc = frame.contentDocument || frame.contentWindow?.document;
        const text = normalizeText(doc?.body?.innerText || "");
        if (!text) continue;

        const markerMatch = text.match(/Es wurden folgende Inventarmarken vergeben:[\s\S]*/i);
        results.push(...splitHardwareEntriesSmart(markerMatch ? markerMatch[0] : text));
      } catch (error) {
        // Cross-origin frames cannot be inspected.
      }
    }

    return results;
  }

  function extractSelectedHardwareLines() {
    const selected = window.getSelection ? String(window.getSelection()).trim() : "";
    return selected ? splitHardwareEntriesSmart(selected) : [];
  }

  function extractHardwareLines() {
    let entries = extractFromMainDocument();
    if (entries.length === 0) entries = extractFromIframes();
    if (entries.length === 0) entries = extractSelectedHardwareLines();

    return uniqueHardwareEntries(entries);
  }

  function buildEbUrl(caseValue, hardwareLines) {
    const params = new URLSearchParams();
    if (caseValue) params.set("case", caseValue);
    if (hardwareLines.length > 0) params.set("hardware_text", hardwareLines.join("\n"));
    return `${EB_BASE_URL}?${params.toString()}`;
  }

  function askForHardwareText() {
    const text = window.prompt("Hardwaretext einfuegen, falls er nicht automatisch erkannt wurde:", "");
    return text ? uniqueHardwareEntries(splitHardwareEntriesSmart(text)) : [];
  }

  function enableEbHelper() {
    if (window.top !== window.self || !window.location.href.includes("Action=AgentTicketZoom")) return;
    if (!isRelevantEbCase() || document.getElementById("zh-eb-open-button")) return;

    const target =
      document.querySelector(".ActionRow") ||
      document.querySelector(".LayoutActionRow") ||
      document.querySelector(".TicketHeader") ||
      document.querySelector(".Headline") ||
      document.body;

    if (!target) return;

    const button = document.createElement("button");
    button.id = "zh-eb-open-button";
    button.type = "button";
    button.textContent = "Empfangsbestaetigung erstellen";
    button.style.marginLeft = "12px";
    button.style.padding = "8px 14px";
    button.style.background = "#3976bb";
    button.style.color = "#fff";
    button.style.border = "0";
    button.style.borderRadius = "6px";
    button.style.cursor = "pointer";
    button.style.fontWeight = "600";

    button.addEventListener("click", () => {
      const caseValue = extractCase();
      let hardwareLines = extractHardwareLines();

      if (!caseValue) {
        alert("Keine Case-Nummer gefunden.");
        return;
      }

      if (hardwareLines.length === 0) {
        hardwareLines = askForHardwareText();
      }

      if (hardwareLines.length === 0) {
        alert("Keine Hardwarezeilen gefunden.");
        return;
      }

      window.open(buildEbUrl(caseValue, hardwareLines), "_blank");
    });

    target.prepend(button);
  }

  function disableEbHelper() {
    document.getElementById("zh-eb-open-button")?.remove();
  }

  function getPriorityTemplates() {
    priorityTemplateConfig = normalizePriorityTemplateConfig(priorityTemplateConfig);
    return priorityTemplateConfig.templates;
  }

  function isVisibleFormControl(control) {
    if (!control) return false;
    if (control.type === "hidden") return false;

    const view = control.ownerDocument?.defaultView || window;
    const style = view.getComputedStyle(control);
    if (style.display === "none" || style.visibility === "hidden") return false;

    const rect = control.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function cleanFieldLabel(text) {
    return normalizeText(text)
      .replace(/^\*+/, "")
      .replace(/:$/, "")
      .trim()
      .toLowerCase();
  }

  function findPriorityLabelCandidates(labels, doc = document) {
    const wanted = labels.map((label) => cleanFieldLabel(label));
    return [...doc.querySelectorAll("label, dt, th, td, div, span")]
      .filter((element) => {
        if (element.closest("#zh-priority-template-toolbar, .zh-priority-modal")) return false;
        const text = cleanFieldLabel(getElementText(element));
        return wanted.some((label) => text === label || text.endsWith(label));
      });
  }

  function getVisiblePriorityControls(doc = document) {
    return [...doc.querySelectorAll("input, select, textarea")]
      .filter((control) => !control.closest("#zh-priority-template-toolbar, .zh-priority-modal"))
      .filter(isVisibleFormControl);
  }

  function findPriorityControlNearLabel(labels, doc = document) {
    const candidates = findPriorityLabelCandidates(labels, doc);
    const controls = getVisiblePriorityControls(doc);

    for (const candidate of candidates) {
      const candidateRect = candidate.getBoundingClientRect();
      const sameRow = controls
        .filter((control) => Boolean(candidate.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING))
        .map((control) => ({
          control,
          rect: control.getBoundingClientRect()
        }))
        .filter((item) => Math.abs(item.rect.top - candidateRect.top) <= 28 || Math.abs(item.rect.bottom - candidateRect.bottom) <= 28)
        .filter((item) => item.rect.left >= candidateRect.left)
        .sort((left, right) => Math.abs(left.rect.left - candidateRect.right) - Math.abs(right.rect.left - candidateRect.right));

      if (sameRow[0]?.control) return sameRow[0].control;

      const row = candidate.closest("tr, li, .Row, .Field");
      const rowControl = [...(row?.querySelectorAll("input, select, textarea") || [])].find(isVisibleFormControl);
      if (rowControl) return rowControl;

      let sibling = candidate.nextElementSibling;
      while (sibling) {
        const siblingControl = sibling.matches?.("input, select, textarea") && isVisibleFormControl(sibling)
          ? sibling
          : [...sibling.querySelectorAll?.("input, select, textarea") || []].find(isVisibleFormControl);
        if (siblingControl) return siblingControl;
        sibling = sibling.nextElementSibling;
      }
    }

    return null;
  }

  function findPriorityFieldRow(labels, doc = document) {
    const candidates = findPriorityLabelCandidates(labels, doc);

    for (const candidate of candidates) {
      let element = candidate;
      let fallback = null;
      while (element && element !== doc.body) {
        if (element.querySelector?.("input, select, textarea, iframe, [contenteditable='true']")) {
          const controlCount = element.querySelectorAll("input, select, textarea").length;
          const labelCount = [...element.querySelectorAll("label, dt, th, td, div, span")]
            .filter((item) => /:?\s*$/.test(getElementText(item).trim()))
            .length;

          if (controlCount <= 4 && labelCount <= 8) {
            return element;
          }

          fallback ||= element;
        }

        const sibling = element.nextElementSibling;
        if (sibling?.querySelector?.("input, select, textarea, iframe, [contenteditable='true']")) {
          return element.parentElement || sibling;
        }

        if (fallback && element.matches?.("fieldset, .WidgetSimple")) {
          return fallback;
        }
        element = element.parentElement;
      }

      if (fallback) return fallback;
    }

    return null;
  }

  function findPriorityFieldSection(labels, doc = document) {
    const row = findPriorityFieldRow(labels, doc);
    if (!row) return null;

    const section = row.closest("fieldset, .WidgetSimple, .Field, .Row, tr, li");
    return section || row;
  }

  function findPriorityControl(labels, ids = [], doc = document) {
    for (const id of ids) {
      const direct = [
        doc.getElementById(id),
        doc.querySelector(`[name="${id}"]`),
        ...doc.querySelectorAll(`[id^="${id}_"], [id$="_${id}"], [name^="${id}_"], [name$="_${id}"]`)
      ].find((control) => control && isVisibleFormControl(control));
      if (direct) return direct;
    }

    const nearLabel = findPriorityControlNearLabel(labels, doc);
    if (nearLabel) return nearLabel;

    const row = findPriorityFieldRow(labels, doc);
    if (!row) return null;

    return [...row.querySelectorAll("input, select, textarea")]
      .find(isVisibleFormControl) || null;
  }

  function getControlText(control) {
    return normalizeText(control?.value || control?.textContent || "");
  }

  function matchesAutocompleteText(text, value) {
    const cleanText = normalizeText(text).toLowerCase();
    const expected = String(value || "").trim().toLowerCase();
    if (!expected) return false;
    if (cleanText === expected || cleanText.includes(expected)) return true;

    const tokens = expected.split(/\s+/).filter((token) => token.length > 1);
    return tokens.length > 0 && tokens.every((token) => cleanText.includes(token));
  }

  function findAutocompleteSuggestion(value) {
    const expected = String(value || "").trim().toLowerCase();
    if (!expected) return null;

    const selectors = [
      ".ui-autocomplete li",
      ".ui-menu-item",
      ".select2-results li",
      ".select2-results__option",
      "[role='option']",
      ".autocomplete-suggestion",
      ".AutoCompleteResult"
    ];

    const candidates = [...document.querySelectorAll(selectors.join(","))]
      .filter(elementIsVisible)
      .filter((element) => !element.closest("#zh-priority-template-toolbar, .zh-priority-modal"));

    return candidates.find((element) => normalizeText(getElementText(element)).toLowerCase() === expected) ||
      candidates.find((element) => matchesAutocompleteText(getElementText(element), value)) ||
      null;
  }

  function clickAutocompleteSuggestion(value) {
    const suggestion = findAutocompleteSuggestion(value);
    if (!suggestion) return false;

    const target = suggestion.querySelector("a, button, div, span") || suggestion;
    ["mousedown", "mouseup", "click"].forEach((eventName) => {
      target.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
    });
    if (typeof target.click === "function") target.click();

    return true;
  }

  function dispatchControlEvents(control, includeBlur = true) {
    const events = includeBlur ? ["input", "change", "keyup", "blur"] : ["input", "change", "keyup"];
    events.forEach((eventName) => {
      control.dispatchEvent(new Event(eventName, { bubbles: true }));
    });
  }

  function setControlValue(control, value, options = {}) {
    if (!control || !value) return false;

    if (control.tagName === "SELECT") {
      const option = [...control.options].find((item) =>
        normalizeText(item.textContent).toLowerCase() === String(value).toLowerCase() ||
        String(item.value).toLowerCase() === String(value).toLowerCase()
      );
      if (option) {
        control.value = option.value;
        option.selected = true;
      } else {
        control.value = value;
      }
    } else {
      if (options.focus !== false) control.focus({ preventScroll: true });
      control.value = value;
    }

    dispatchControlEvents(control, options.blur !== false);

    return true;
  }

  function clickPriorityTokenRemovers(row) {
    if (!row) return;

    const controls = [...row.querySelectorAll("a, button, span, div")]
      .filter((element) => !element.closest("#zh-priority-template-toolbar, .zh-priority-modal"))
      .filter(elementIsVisible)
      .filter((element) => {
        const text = normalizeText(getElementText(element)).toLowerCase();
        const title = String(element.getAttribute("title") || element.getAttribute("aria-label") || "").toLowerCase();
        const className = String(element.className || "").toLowerCase();
        return text === "x" ||
          title.includes("entfernen") ||
          title.includes("remove") ||
          className.includes("remove") ||
          className.includes("close") ||
          className.includes("delete");
      });

    controls.slice(0, 3).forEach((element) => {
      ["mousedown", "mouseup", "click"].forEach((eventName) => {
        element.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
      });
      if (typeof element.click === "function") element.click();
    });
  }

  function findPriorityTokenContainer(control) {
    if (!control) return null;

    let element = control.parentElement;
    let fallback = control.parentElement;
    while (element && element !== document.body) {
      const controlCount = element.querySelectorAll("input, select, textarea").length;
      const text = normalizeText(getElementText(element));
      if (controlCount <= 3 && text.length <= 180) {
        return element;
      }

      fallback ||= element;
      if (element.matches("tr, li, .Row, .Field")) return element;
      element = element.parentElement;
    }

    return fallback;
  }

  function priorityRowHasValue(row, value) {
    return row ? matchesAutocompleteText(getElementText(row), value) : false;
  }

  function getAutocompleteQueries(value) {
    const clean = String(value || "").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    const queries = [clean];

    if (parts.length >= 2) {
      const first = parts[0];
      const last = parts.slice(1).join(" ");
      queries.push(`${last}, ${first}`, last);
    }

    return [...new Set(queries.filter(Boolean))];
  }

  function setPriorityAutocompleteField(labels, ids, value) {
    if (!value) return false;

    const control = findPriorityControl(labels, ids);
    if (!control) return false;

    const changed = setControlValue(control, value, { blur: true });
    control.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Escape",
      view: window
    }));
    control.blur?.();
    closePriorityAutocompleteDropdowns();

    return changed;
  }

  function setPriorityPlainField(labels, ids, value, doc = document) {
    if (!value) return false;

    const control = findPriorityControl(labels, ids, doc);
    if (!control) return false;

    return setControlValue(control, value, { blur: true, focus: false });
  }

  function closePriorityAutocompleteDropdowns(doc = document) {
    doc.activeElement?.blur?.();

    doc.querySelectorAll(".ui-autocomplete, .select2-drop, .select2-dropdown, .autocomplete-suggestions, .AutoCompleteResult")
      .forEach((element) => {
        element.style.display = "none";
      });
  }

  function getSelectOptionText(option) {
    return normalizeText(option?.textContent || "").replace(/\u00a0/g, " ").trim();
  }

  function findSelectOptionByTemplateValue(select, value) {
    if (!select || !value) return null;

    const expected = normalizeText(value).toLowerCase();
    const options = [...select.options];

    return options.find((option) => getSelectOptionText(option).toLowerCase() === expected) ||
      options.find((option) => String(option.value || "").toLowerCase() === expected) ||
      options.find((option) => getSelectOptionText(option).toLowerCase().replace(/^\d+\s*:\s*/, "") === expected) ||
      options.find((option) => matchesAutocompleteText(getSelectOptionText(option), value)) ||
      null;
  }

  function updateModernizedSelectDisplay(select, label) {
    const doc = select.ownerDocument || document;
    const field = select.closest(".Field") || select.parentElement;
    const searchInput = doc.getElementById(`${select.id}_Search`) ||
      field?.querySelector(".InputField_Search");
    const inputContainer = searchInput?.closest(".InputField_InputContainer") ||
      field?.querySelector(".InputField_InputContainer");

    if (searchInput) {
      searchInput.value = "";
      searchInput.setAttribute("title", label);
      searchInput.blur?.();
    }

    let selection = inputContainer?.querySelector(".InputField_Selection");
    if (!selection && inputContainer) {
      selection = doc.createElement("div");
      selection.className = "InputField_Selection";
      selection.style.left = "5px";
      selection.style.display = "block";

      const text = doc.createElement("div");
      text.className = "Text";
      selection.appendChild(text);

      inputContainer.appendChild(selection);
    }

    const textElement = selection?.querySelector(".Text");
    if (textElement) textElement.textContent = label;

    selection?.querySelector(".Remove")?.remove();
    if (selection) selection.style.display = "block";
  }

  function isModernizedSelectWidgetVisible(select) {
    const doc = select.ownerDocument || document;
    const field = select.closest(".Field") || select.parentElement;
    const searchInput = doc.getElementById(`${select.id}_Search`) ||
      field?.querySelector(".InputField_Search");
    const inputContainer = searchInput?.closest(".InputField_InputContainer") ||
      field?.querySelector(".InputField_InputContainer");
    return Boolean(inputContainer && isVisibleFormControl(inputContainer));
  }

  function setPrioritySelectField(ids, value, labels = [], doc = document) {
    const select = findPrioritySelectControl(ids, labels, doc);
    const option = findSelectOptionByTemplateValue(select, value);
    if (!select || !option) return false;

    const changed = select.value !== option.value || !option.selected;
    [...select.options].forEach((item) => {
      item.selected = item === option;
    });
    select.value = option.value;

    updateModernizedSelectDisplay(select, getSelectOptionText(option));
    if (changed) {
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fragmentFromLines(text, doc = document) {
    const fragment = doc.createDocumentFragment();
    String(text || "")
      .split("\n")
      .forEach((line, index) => {
        if (index > 0) fragment.appendChild(doc.createElement("br"));
        fragment.appendChild(doc.createTextNode(line));
      });
    return fragment;
  }

  function insertRichTextInto(target, value, prepend) {
    const doc = target.ownerDocument || document;
    if (prepend) {
      const fragment = fragmentFromLines(value, doc);
      fragment.appendChild(doc.createElement("br"));
      target.insertBefore(fragment, target.firstChild);
    } else {
      target.replaceChildren(fragmentFromLines(value, doc));
    }
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setPriorityRichText(value, options = {}, doc = document) {
    if (!value) return false;

    const prepend = Boolean(options.prepend);
    const row = findPriorityFieldSection(["Text"], doc);
    const textarea = [...(row?.querySelectorAll("textarea") || [])]
      .find((control) => {
        const signature = `${control.name || ""} ${control.id || ""}`.toLowerCase();
        return /richtext|body|article|text/.test(signature);
      });
    if (textarea) {
      setControlValue(textarea, prepend ? `${value}\n${textarea.value || ""}` : value, { focus: false });
    }

    const editable =
      row?.querySelector?.("[contenteditable='true']") ||
      doc.querySelector(".cke_editable[contenteditable='true'], [contenteditable='true']");

    if (editable) {
      insertRichTextInto(editable, value, prepend);
      return true;
    }

    const iframe = row?.querySelector?.("iframe") || doc.querySelector(".cke_wysiwyg_frame, iframe");
    try {
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
      if (iframeDoc?.body) {
        insertRichTextInto(iframeDoc.body, value, prepend);
        return true;
      }
    } catch (error) {
      // Ignore cross-document editor access errors.
    }

    return Boolean(textarea);
  }

  function applyPriorityTemplate(template, doc = document) {
    const fields = template.fields || {};
    const view = doc.defaultView || window;
    const startScrollX = view.scrollX;
    const startScrollY = view.scrollY;
    let userScrolled = false;

    const markUserScroll = () => {
      userScrolled = true;
    };
    const userScrollEvents = ["wheel", "touchmove", "keydown", "mousedown"];
    userScrollEvents.forEach((type) => view.addEventListener(type, markUserScroll, { passive: true }));

    const applyFields = () => {
      setPrioritySelectField(["TypeID"], fields.type, [], doc);
      setPrioritySelectField(["NewQueueID", "Dest"], fields.queue, ["An Queue", "Queue"], doc);
      setPrioritySelectField(["ServiceID"], fields.service, [], doc);
      setPrioritySelectField(["NewOwnerID", "NewUserID", "OwnerID"], fields.owner, ["Besitzer", "Owner"], doc);
      setPrioritySelectField(["DynamicField_Kategorie"], fields.category, [], doc);
      setPriorityPlainField(["Betreff"], ["Subject"], fields.subject, doc);
      setPriorityRichText(fields.body, {}, doc);
      closePriorityAutocompleteDropdowns(doc);
    };

    const applyAndKeepPosition = () => {
      applyFields();
      // Znuny re-renders dependent fields after a select change and can scroll
      // the page (to top or bottom). Restore the previous position unless the
      // user scrolled on purpose in the meantime.
      if (!userScrolled && Math.abs(view.scrollY - startScrollY) > 30) {
        view.scrollTo({ top: startScrollY, left: startScrollX });
      }
    };

    // Repeat a few times: after a select change Znuny may re-render the form and
    // wipe the free-text fields, which is why a template sometimes only applied
    // fully on the second click.
    applyAndKeepPosition();
    [150, 350, 700, 1200].forEach((delay) => view.setTimeout(applyAndKeepPosition, delay));
    view.setTimeout(() => {
      userScrollEvents.forEach((type) => view.removeEventListener(type, markUserScroll));
    }, 1300);
  }

  function findPrioritySelectControl(ids, labels = [], doc = document) {
    for (const id of [].concat(ids)) {
      const select = doc.getElementById(id);
      if (select && (isVisibleFormControl(select) || isModernizedSelectWidgetVisible(select))) return select;
    }

    if (labels.length) {
      const row = findPriorityFieldRow(labels, doc);
      const select = row?.querySelector("select");
      if (select && (isVisibleFormControl(select) || isModernizedSelectWidgetVisible(select))) return select;
    }

    return null;
  }

  function getPrioritySelectFieldText(ids, labels = [], doc = document) {
    const select = findPrioritySelectControl(ids, labels, doc);
    if (!select) return "";
    return getSelectOptionText(select.selectedOptions?.[0]);
  }

  function getPriorityPlainFieldValue(labels, ids, doc = document) {
    const control = findPriorityControl(labels, ids, doc);
    return control ? String(control.value || "").trim() : "";
  }

  function getPriorityRichTextValue(doc = document) {
    const row = findPriorityFieldSection(["Text"], doc);

    const textarea = [...(row?.querySelectorAll("textarea") || [])]
      .find((control) => {
        const signature = `${control.name || ""} ${control.id || ""}`.toLowerCase();
        return /richtext|body|article|text/.test(signature);
      });
    if (textarea?.value) return textarea.value;

    const editable = row?.querySelector?.("[contenteditable='true']") ||
      doc.querySelector(".cke_editable[contenteditable='true'], [contenteditable='true']");
    if (editable) return editable.innerText || "";

    const iframe = row?.querySelector?.("iframe") || doc.querySelector(".cke_wysiwyg_frame, iframe");
    try {
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
      if (iframeDoc?.body) return iframeDoc.body.innerText || "";
    } catch (error) {
      // Ignore cross-document editor access errors.
    }

    return "";
  }

  function capturePriorityTemplateFields(doc = document) {
    return {
      type: getPrioritySelectFieldText(["TypeID"], [], doc),
      queue: getPrioritySelectFieldText(["NewQueueID", "Dest"], ["An Queue", "Queue"], doc),
      service: getPrioritySelectFieldText(["ServiceID"], [], doc),
      owner: getPrioritySelectFieldText(["NewOwnerID", "NewUserID", "OwnerID"], ["Besitzer", "Owner"], doc),
      category: getPrioritySelectFieldText(["DynamicField_Kategorie"], [], doc),
      subject: getPriorityPlainFieldValue(["Betreff"], ["Subject"], doc),
      body: getPriorityRichTextValue(doc)
    };
  }

  function saveCurrentFieldsAsPriorityTemplate(doc = document) {
    const title = window.prompt("Name für die neue Vorlage:", "");
    if (!title || !title.trim()) return;

    const fields = capturePriorityTemplateFields(doc);
    const hasAnyValue = Object.values(fields).some((value) => value);
    if (!hasAnyValue) {
      window.alert("Es wurden keine ausgefüllten Felder gefunden, die als Vorlage gespeichert werden können.");
      return;
    }

    const palette = ["#3976bb", "#4caf50", "#e07b00", "#8e44ad", "#c0392b", "#009688"];
    const usedColors = getPriorityTemplates().map((template) => template.color);
    const color = palette.find((candidate) => !usedColors.includes(candidate)) || palette[0];

    priorityTemplateConfig = normalizePriorityTemplateConfig({
      templates: [
        ...getPriorityTemplates(),
        { title: title.trim(), color, fields }
      ]
    });
    savePriorityTemplateConfig();
    enablePriorityTemplates(doc);
  }

  function isAllowedHsrwCustomerEmail(email) {
    const domain = String(email || "").toLowerCase().split("@").pop() || "";
    return ["hsrw.org", "hsrw.eu", "hochschule-rhein-waal.de"]
      .some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
  }

  function extractEmails(value) {
    return String(value || "").match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  }

  function getPriorityExternalCustomerEmail() {
    const preferredText = [];

    [...document.querySelectorAll("input, textarea, select")].forEach((control) => {
      if (control.closest("#zh-priority-template-toolbar, .zh-priority-modal")) return;

      const signature = [
        control.name,
        control.id,
        control.getAttribute("aria-label"),
        control.getAttribute("placeholder"),
        getElementText(control.closest("tr, li, .Field, .Row") || control.parentElement)
      ].join(" ").toLowerCase();

      if (!/customer|kunde|kundenbenutzer|mail|e-mail|email|von|from/.test(signature)) return;

      preferredText.push(control.value || "");
      if (control.tagName === "SELECT") {
        preferredText.push(control.selectedOptions?.[0]?.textContent || "");
      }
    });

    const preferredEmails = preferredText.flatMap(extractEmails);
    const fallbackEmails = extractEmails(document.body?.innerText || "");
    const emails = [...new Set([...preferredEmails, ...fallbackEmails].map((email) => email.toLowerCase()))];

    return emails.find((email) => !isAllowedHsrwCustomerEmail(email)) || "";
  }

  function schedulePriorityExternalCustomerBottomNotice() {
    appendPriorityExternalCustomerBottomNotice();
    [200, 700, 1500].forEach((delay) => {
      window.setTimeout(appendPriorityExternalCustomerBottomNotice, delay);
    });
  }

  function hasPriorityExternalCustomerMarker() {
    const titleText = normalizeText(`${document.querySelector("h1")?.textContent || ""} ${document.title || ""}`);
    const pageText = normalizeText(document.body?.innerText || "");

    return /\[!?extern\]/i.test(titleText) ||
      /\b!?extern\b/i.test(titleText) ||
      /\[!?extern\]/i.test(pageText);
  }

  function getPriorityExternalCustomerWarningText(shortText = false) {
    const externalEmail = getPriorityExternalCustomerEmail();
    if (externalEmail) {
      return shortText
        ? "ACHTUNG: Kunde ist extern"
        : `Kunde scheint extern zu sein (${externalEmail}). Bitte vor dem Übermitteln prüfen, ob die Ticketdaten entsprechend angepasst werden müssen.`;
    }

    if (hasPriorityExternalCustomerMarker()) {
      return shortText
        ? "ACHTUNG: Kunde ist extern"
        : "Ticket ist als EXTERN markiert. Bitte vor dem Übermitteln prüfen, ob die Ticketdaten entsprechend angepasst werden müssen.";
    }

    return "";
  }

  function appendPriorityExternalCustomerNotice(toolbar) {
    const warningText = getPriorityExternalCustomerWarningText(false);
    if (!warningText) return;

    const notice = document.createElement("div");
    notice.id = "zh-priority-external-customer-warning";
    const strong = document.createElement("strong");
    strong.textContent = "EXTERN:";
    notice.appendChild(strong);
    notice.appendChild(document.createTextNode(` ${warningText}`));
    toolbar.appendChild(notice);
  }

  function findPriorityCustomerVisibleTarget() {
    const candidates = [...document.querySelectorAll("label, div, span, p, td, th, strong")]
      .filter((element) => !element.closest("#zh-priority-template-toolbar, .zh-priority-modal"))
      .filter((element) => {
        const text = normalizeText(getElementText(element))
          .toLowerCase()
          .replace(/\u00fc/g, "ue")
          .replace(/\u00dc/g, "ue")
          .replace(/Ã¼/g, "ue")
          .replace(/Ãœ/g, "ue");
        return /ist\s+sichtbar\s+f(?:ue|uer)\s+kunde/.test(text);
      })
      .sort((left, right) => normalizeText(getElementText(left)).length - normalizeText(getElementText(right)).length);

    const label = candidates.find(elementIsVisible) || candidates[0];
    if (!label) return null;

    return label.closest("tr, li, .Field, .Row") || label.parentElement;
  }

  function appendPriorityExternalCustomerBottomNotice() {
    const warningText = getPriorityExternalCustomerWarningText(true);
    const existing = document.getElementById("zh-priority-external-customer-bottom-warning");
    if (!warningText) {
      existing?.remove();
      return;
    }

    const target = findPriorityCustomerVisibleTarget();
    if (!target) return;

    const notice = existing || document.createElement("div");
    notice.id = "zh-priority-external-customer-bottom-warning";
    notice.textContent = warningText;

    const checkbox = target.querySelector('input[type="checkbox"]') ||
      target.parentElement?.querySelector('input[type="checkbox"]');

    if (checkbox) checkbox.insertAdjacentElement("afterend", notice);
    else target.appendChild(notice);
  }

  function addPriorityTemplateStyles(doc = document) {
    addStyleToDocument(doc, "zh-priority-template-style", `
      #zh-priority-template-toolbar { color-scheme: light; margin: 12px 26px; border: 1px solid #e2e4e8; border-radius: 8px; background: #fff; overflow: hidden; font-size: 12.5px; color: #2b2f36; }
      #zh-priority-template-toolbar.zh-priority-template-side { margin: 0; }
      .zh-priority-side-layout { display: grid !important; grid-template-columns: minmax(0, 1fr) minmax(220px, 300px); column-gap: 16px; align-items: start; }
      .zh-priority-side-layout > #zh-priority-template-toolbar { grid-column: 2; grid-row: 1; }
      .zh-priority-side-layout > :not(#zh-priority-template-toolbar) { grid-column: 1; min-width: 0; max-width: 100%; box-sizing: border-box; overflow-x: clip; }
      .zh-priority-side-layout fieldset,
      .zh-priority-side-layout .Row,
      .zh-priority-side-layout .Field,
      .zh-priority-side-layout .InputField,
      .zh-priority-side-layout .InputField_Container,
      .zh-priority-side-layout .InputField_InputContainer,
      .zh-priority-side-layout .InputField_Search,
      .zh-priority-side-layout table { max-width: 100%; box-sizing: border-box; }
      @supports not (overflow-x: clip) {
        .zh-priority-side-layout > :not(#zh-priority-template-toolbar) { overflow-x: hidden; }
      }
      .zh-priority-toolbar-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: #f4f5f7; border-bottom: 1px solid #e2e4e8; }
      .zh-priority-toolbar-head strong { font-size: 12.5px; letter-spacing: .02em; color: #2b2f36; }
      .zh-priority-toolbar-edit { border: 1px solid #c9ccd2; background: #fff; color: #3a3f47; border-radius: 5px; padding: 3px 9px; font-size: 11.5px; cursor: pointer; }
      .zh-priority-toolbar-edit:hover { background: #eef0f3; }
      .zh-priority-toolbar-groups { display: grid; gap: 12px; padding: 11px 12px; }
      .zh-priority-toolbar-group { display: grid; gap: 6px; }
      .zh-priority-toolbar-group-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #8a909a; }
      .zh-priority-toolbar-group-buttons { display: flex; flex-wrap: wrap; gap: 6px; }
      .zh-priority-toolbar-actions { display: flex; justify-content: flex-end; padding: 9px 12px; border-top: 1px solid #e2e4e8; background: #fafbfc; }
      .zh-priority-template-button { border: 1px solid rgba(0,0,0,.16); border-radius: 6px; padding: 5px 11px; cursor: pointer; font-weight: 600; line-height: 1.3; font-size: 12px; color: #fff; transition: filter .1s ease; }
      .zh-priority-template-button:hover { filter: brightness(1.08); }
      .zh-priority-template-save-current { border: 1px solid #3976bb; background: #fff; color: #2a5c96; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-weight: 600; font-size: 12px; }
      .zh-priority-template-save-current:hover { background: #eaf1fb; }
      #zh-priority-external-customer-warning { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 9px; border: 1px solid #d98200; border-left: 4px solid #ff9900; background: #fff4cf; color: #4b3400; font-size: 12px; line-height: 1.35; }
      #zh-priority-external-customer-warning strong { color: #8a3b00; margin: 0; width: auto; }
      #zh-priority-external-customer-bottom-warning { display: inline-block; margin: 0 0 0 12px; padding: 5px 9px; border: 1px solid #c30000; border-left: 5px solid #d40000; background: #ffe0e0; color: #8a0000; font-size: 12px; font-weight: 700; line-height: 1.3; vertical-align: middle; }
      .zh-priority-modal-backdrop { color-scheme: light; position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(17,20,26,.55); }
      .zh-priority-modal { color-scheme: light; width: min(1040px, 100%); max-height: 100%; display: flex; flex-direction: column; overflow: hidden; background: #fff; color: #222; border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
      .zh-priority-modal header, .zh-priority-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 13px 18px; background: #f4f5f7; flex: 0 0 auto; }
      .zh-priority-modal header { border-radius: 10px 10px 0 0; border-bottom: 1px solid #e2e4e8; }
      .zh-priority-modal footer { border-top: 1px solid #e2e4e8; border-radius: 0 0 10px 10px; flex-wrap: wrap; }
      .zh-priority-modal h2 { margin: 0; font-size: 16px; color: #222; }
      .zh-priority-modal-body { flex: 1 1 auto; overflow: auto; background: #f6f7f9; }
      .zh-priority-modal-tools { display: flex; align-items: center; gap: 10px; padding: 11px 18px; background: #fff; border-bottom: 1px solid #e7e9ed; position: sticky; top: 0; z-index: 2; }
      .zh-priority-modal-tools input[type="search"] { flex: 1 1 auto; min-width: 0; padding: 7px 10px; border: 1px solid #cbd0d6; border-radius: 7px; font-size: 12.5px; }
      .zh-priority-modal-tools input[type="search"]:focus { outline: none; border-color: #3976bb; box-shadow: 0 0 0 2px rgba(57,118,187,.15); }
      .zh-priority-modal-tools .zh-priority-add { flex: 0 0 auto; border: 1px solid #3976bb; background: #fff; color: #2a5c96; border-radius: 7px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      .zh-priority-modal-tools .zh-priority-add:hover { background: #eaf1fb; }
      .zh-priority-groups { padding: 14px 18px 18px; display: grid; gap: 16px; }
      .zh-priority-group-section { display: grid; gap: 8px; }
      .zh-priority-group-title { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #8a909a; }
      .zh-priority-group-title[draggable="true"] { cursor: grab; }
      .zh-priority-group-title[draggable="true"]:active { cursor: grabbing; }
      .zh-priority-group-handle { color: #b3b8c0; font-size: 13px; }
      .zh-priority-group-count { background: #e7e9ed; color: #5a6069; border-radius: 999px; padding: 1px 7px; font-size: 10.5px; letter-spacing: 0; }
      .zh-priority-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; align-items: start; }
      .zh-priority-tile { border: 1px solid #e3e5e9; border-left-width: 4px; border-left-style: solid; border-left-color: #3976bb; border-radius: 9px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.04); overflow: hidden; }
      .zh-priority-tile-head { display: flex; align-items: center; gap: 8px; padding: 9px 10px 5px; }
      .zh-priority-tile-drag { flex: 0 0 auto; cursor: grab; color: #b3b8c0; font-size: 14px; line-height: 1; user-select: none; }
      .zh-priority-tile-drag:active { cursor: grabbing; }
      .zh-priority-tile.zh-priority-dragging { opacity: .45; }
      .zh-priority-tile.zh-priority-drop-target { outline: 2px dashed #3976bb; outline-offset: -2px; }
      .zh-priority-tile-color { flex: 0 0 auto; width: 26px; height: 26px; padding: 1px; border: 1px solid #d4d8de; border-radius: 6px; background: #fff; cursor: pointer; }
      .zh-priority-tile-main { flex: 1 1 auto; min-width: 0; }
      .zh-priority-tile-title { font-weight: 600; }
      .zh-priority-tile-main input, .zh-priority-tile-meta input, .zh-priority-tile-meta select { width: 100%; box-sizing: border-box; border: 1px solid transparent; background: transparent; border-radius: 5px; padding: 3px 5px; font-size: 12.5px; color: #222; }
      .zh-priority-tile-main input:hover, .zh-priority-tile-meta input:hover, .zh-priority-tile-meta select:hover { border-color: #dfe2e7; }
      .zh-priority-tile-main input:focus, .zh-priority-tile-meta input:focus, .zh-priority-tile-meta select:focus { outline: none; border-color: #3976bb; background: #fff; box-shadow: 0 0 0 2px rgba(57,118,187,.14); }
      .zh-priority-tile-meta { display: flex; align-items: center; gap: 6px; padding: 0 10px 9px; }
      .zh-priority-tile-group { flex: 1 1 auto; min-width: 0; font-size: 11.5px; color: #7a808a; cursor: pointer; }
      .zh-priority-tile-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 3px; }
      .zh-priority-tile-actions button { border: 1px solid #d4d8de; background: #fff; color: #4a5058; border-radius: 6px; width: 26px; height: 26px; padding: 0; font-size: 12px; line-height: 1; cursor: pointer; }
      .zh-priority-tile-actions button:hover { background: #eef0f3; }
      .zh-priority-tile-actions .zh-priority-tile-toggle { width: auto; padding: 0 8px; font-size: 11px; }
      .zh-priority-tile-actions .zh-priority-tile-remove { color: #a30000; border-color: #e6bcbc; }
      .zh-priority-tile-actions .zh-priority-tile-remove:hover { background: #ffecec; }
      .zh-priority-tile-fields { display: none; padding: 10px; border-top: 1px dashed #e7e9ed; background: #fbfbfc; }
      .zh-priority-tile.is-open .zh-priority-tile-fields { display: grid; }
      .zh-priority-tile-fields-grid { display: grid; grid-template-columns: repeat(2, minmax(110px, 1fr)); gap: 9px; }
      .zh-priority-tile-fields-grid .zh-priority-field-wide { grid-column: 1 / -1; }
      .zh-priority-field { display: grid; gap: 3px; min-width: 0; }
      .zh-priority-field label { color: #7a808a; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
      .zh-priority-field input, .zh-priority-field textarea { width: 100%; box-sizing: border-box; font-size: 12.5px; padding: 6px 8px; border: 1px solid #cbd0d6; border-radius: 6px; background: #fff; color: #222; }
      .zh-priority-field input:focus, .zh-priority-field textarea:focus { outline: none; border-color: #3976bb; box-shadow: 0 0 0 2px rgba(57,118,187,.15); }
      .zh-priority-field textarea { min-height: 48px; resize: vertical; font-family: inherit; }
      .zh-priority-empty { padding: 28px; text-align: center; color: #8a909a; font-size: 12.5px; }
      .zh-priority-modal button { cursor: pointer; border-radius: 6px; }
      .zh-priority-modal header button { border: 1px solid #c9ccd2; background: #fff; color: #333; padding: 6px 12px; font-size: 12.5px; }
      .zh-priority-modal header button:hover { background: #eef0f3; }
      .zh-priority-modal footer button { border: 1px solid #c9ccd2; background: #fff; color: #333; padding: 7px 14px; font-size: 12.5px; }
      .zh-priority-modal footer button:hover { background: #eef0f3; }
      .zh-priority-modal footer .zh-priority-template-save { border-color: #2f6a2f; background: #e9f7e9; color: #1e5c1e; font-weight: 700; }
      .zh-priority-modal footer .zh-priority-template-save:hover { background: #dcf1dc; }
      @media (max-width: 820px) {
        .zh-priority-side-layout { display: block !important; }
        .zh-priority-side-layout > #zh-priority-template-toolbar { margin: 0 0 12px; }
        .zh-priority-tiles { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
      }
      @media (max-width: 560px) {
        .zh-priority-tile-fields-grid { grid-template-columns: 1fr; }
      }
    `);
  }

  function createPriorityTemplateField(name, label, value, multiline = false, wide = false) {
    const wrapper = document.createElement("div");
    wrapper.className = wide ? "zh-priority-field zh-priority-field-wide" : "zh-priority-field";

    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    wrapper.appendChild(labelElement);

    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    input.value = value || "";
    wrapper.appendChild(input);

    return wrapper;
  }

  function commitPriorityTemplateTiles(list) {
    priorityTemplateConfig = normalizePriorityTemplateConfig({
      groups: getPriorityGroups(),
      templates: readPriorityTemplateEditorRows(list)
    });
    renderPriorityTemplateEditorRows(list);
  }

  function findPriorityTileById(list, id) {
    return [...list.querySelectorAll(".zh-priority-tile")]
      .find((tile) => tile.dataset.templateId === id) || null;
  }

  function movePriorityTileToGroup(tile, groupName) {
    const select = tile.querySelector('select[name="group"]');
    if (!select) return;

    if (![...select.options].some((option) => option.value === groupName)) {
      const option = document.createElement("option");
      option.value = groupName;
      option.textContent = groupName || "Ohne Gruppe";
      select.insertBefore(option, select.lastElementChild);
    }

    select.value = groupName;
  }

  function createPriorityTemplateTile(template, list) {
    const tile = document.createElement("div");
    tile.className = "zh-priority-tile";
    tile.dataset.templateId = template.id || "";
    tile.style.borderLeftColor = template.color || "#3976bb";
    if (priorityTemplateOpenIds.has(template.id)) tile.classList.add("is-open");

    const head = document.createElement("div");
    head.className = "zh-priority-tile-head";

    const dragHandle = document.createElement("span");
    dragHandle.className = "zh-priority-tile-drag";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Zum Sortieren ziehen";
    dragHandle.draggable = true;
    dragHandle.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", `tile:${tile.dataset.templateId}`);
      event.dataTransfer.effectAllowed = "move";
      try {
        event.dataTransfer.setDragImage(tile, 24, 24);
      } catch (error) {
        // setDragImage is not supported everywhere; the default image is fine.
      }
      tile.classList.add("zh-priority-dragging");
    });
    dragHandle.addEventListener("dragend", () => tile.classList.remove("zh-priority-dragging"));

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.name = "color";
    colorInput.className = "zh-priority-tile-color";
    colorInput.value = /^#[0-9a-f]{6}$/i.test(template.color) ? template.color : "#3976bb";
    colorInput.title = "Farbe";
    colorInput.addEventListener("input", () => {
      tile.style.borderLeftColor = colorInput.value;
    });

    const main = document.createElement("div");
    main.className = "zh-priority-tile-main";

    const titleInput = document.createElement("input");
    titleInput.name = "title";
    titleInput.className = "zh-priority-tile-title";
    titleInput.value = template.title || "";
    titleInput.placeholder = "Buttonname";
    main.appendChild(titleInput);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "zh-priority-tile-toggle";
    toggleButton.textContent = "Felder";
    toggleButton.title = "Felder ein-/ausblenden";
    toggleButton.addEventListener("click", () => {
      const open = tile.classList.toggle("is-open");
      if (open) priorityTemplateOpenIds.add(tile.dataset.templateId);
      else priorityTemplateOpenIds.delete(tile.dataset.templateId);
    });

    head.append(dragHandle, colorInput, main, toggleButton);

    const meta = document.createElement("div");
    meta.className = "zh-priority-tile-meta";

    const groupSelect = document.createElement("select");
    groupSelect.name = "group";
    groupSelect.className = "zh-priority-tile-group";
    groupSelect.title = "Gruppe";

    const knownGroups = getPriorityGroups();
    const groupNames = [...new Set([template.group, ...knownGroups].filter(Boolean))];
    [["", "Ohne Gruppe"], ...groupNames.map((name) => [name, name])].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      groupSelect.appendChild(option);
    });

    const newGroupOption = document.createElement("option");
    newGroupOption.value = "__new";
    newGroupOption.textContent = "＋ Neue Gruppe…";
    groupSelect.appendChild(newGroupOption);

    groupSelect.value = template.group || "";
    groupSelect.addEventListener("change", () => {
      if (groupSelect.value !== "__new") {
        commitPriorityTemplateTiles(list);
        return;
      }

      const name = window.prompt("Name der neuen Gruppe:", "");
      if (!name || !name.trim()) {
        groupSelect.value = template.group || "";
        return;
      }

      const groupName = name.trim();
      if (![...groupSelect.options].some((option) => option.value === groupName)) {
        const option = document.createElement("option");
        option.value = groupName;
        option.textContent = groupName;
        groupSelect.insertBefore(option, newGroupOption);
      }
      groupSelect.value = groupName;
      commitPriorityTemplateTiles(list);
    });

    const actions = document.createElement("div");
    actions.className = "zh-priority-tile-actions";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "zh-priority-tile-remove";
    removeButton.textContent = "✕";
    removeButton.title = "Vorlage entfernen";
    removeButton.addEventListener("click", () => {
      priorityTemplateOpenIds.delete(tile.dataset.templateId);
      tile.remove();
      commitPriorityTemplateTiles(list);
    });

    actions.append(removeButton);
    meta.append(groupSelect, actions);

    tile.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types?.includes("text/plain")) return;
      event.preventDefault();
      tile.classList.add("zh-priority-drop-target");
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("zh-priority-drop-target"));
    tile.addEventListener("drop", (event) => {
      const data = event.dataTransfer.getData("text/plain") || "";
      if (!data.startsWith("tile:")) return;
      event.preventDefault();
      event.stopPropagation();
      tile.classList.remove("zh-priority-drop-target");

      const dragged = findPriorityTileById(list, data.slice(5));
      if (!dragged || dragged === tile) return;

      const container = tile.parentElement;
      movePriorityTileToGroup(dragged, container?.dataset.group || "");

      const rect = tile.getBoundingClientRect();
      if (event.clientY > rect.top + rect.height / 2) {
        container.insertBefore(dragged, tile.nextElementSibling);
      } else {
        container.insertBefore(dragged, tile);
      }
      commitPriorityTemplateTiles(list);
    });

    const fields = document.createElement("div");
    fields.className = "zh-priority-tile-fields";

    const grid = document.createElement("div");
    grid.className = "zh-priority-tile-fields-grid";
    grid.append(
      createPriorityTemplateField("type", "Typ", template.fields?.type),
      createPriorityTemplateField("queue", "Queue", template.fields?.queue),
      createPriorityTemplateField("service", "Service", template.fields?.service),
      createPriorityTemplateField("owner", "Besitzer", template.fields?.owner),
      createPriorityTemplateField("category", "Kategorie", template.fields?.category),
      createPriorityTemplateField("subject", "Betreff", template.fields?.subject),
      createPriorityTemplateField("body", "Text", template.fields?.body, true, true)
    );
    fields.appendChild(grid);

    tile.append(head, meta, fields);
    return tile;
  }

  function readPriorityTemplateEditorRows(list) {
    const rows = [...list.querySelectorAll(".zh-priority-tile")];

    return rows.map((row, index) => {
      const getValue = (name) => row.querySelector(`[name="${name}"]`)?.value?.trim() || "";
      const title = getValue("title") || `Vorlage ${index + 1}`;
      const id = row.dataset.templateId || `priority-template-${index + 1}-${normalizeCategoryId(title) || Date.now()}`;

      return {
        id,
        title,
        color: getValue("color") || "#3976bb",
        group: getValue("group"),
        fields: {
          type: getValue("type"),
          queue: getValue("queue"),
          service: getValue("service"),
          owner: getValue("owner"),
          category: getValue("category"),
          subject: getValue("subject"),
          body: getValue("body")
        }
      };
    });
  }

  function applyPriorityTemplateFilter(list) {
    const filter = priorityTemplateFilter.trim().toLowerCase();
    let totalVisible = 0;

    list.querySelectorAll(".zh-priority-group-section").forEach((section) => {
      let visibleCount = 0;

      section.querySelectorAll(".zh-priority-tile").forEach((tile) => {
        const title = (tile.querySelector('[name="title"]')?.value || "").toLowerCase();
        const group = (tile.querySelector('[name="group"]')?.value || "").toLowerCase();
        const match = !filter || title.includes(filter) || group.includes(filter);
        tile.style.display = match ? "" : "none";
        if (match) visibleCount += 1;
      });

      section.style.display = visibleCount ? "" : "none";
      const countSpan = section.querySelector(".zh-priority-group-count");
      if (countSpan) countSpan.textContent = String(visibleCount);
      totalVisible += visibleCount;
    });

    const empty = list.querySelector(".zh-priority-empty");
    if (empty) empty.style.display = totalVisible ? "none" : "";
  }

  function renderPriorityTemplateEditorRows(list) {
    list.innerHTML = "";

    const templates = getPriorityTemplates();

    const empty = document.createElement("div");
    empty.className = "zh-priority-empty";
    empty.textContent = templates.length ? "Keine Vorlage passt zum Filter." : "Noch keine Vorlagen vorhanden.";
    empty.style.display = "none";
    list.appendChild(empty);

    const byGroup = new Map();
    templates.forEach((template) => {
      const groupName = template.group || "";
      if (!byGroup.has(groupName)) byGroup.set(groupName, []);
      byGroup.get(groupName).push(template);
    });

    const orderedGroups = orderPriorityGroups(byGroup);
    const hasGroups = orderedGroups.some((name) => name !== "");

    orderedGroups.forEach((groupName) => {
      const groupTemplates = byGroup.get(groupName) || [];
      if (!groupTemplates.length) return;

      const section = document.createElement("div");
      section.className = "zh-priority-group-section";

      if (hasGroups) {
        const heading = document.createElement("div");
        heading.className = "zh-priority-group-title";
        heading.draggable = Boolean(groupName);
        if (groupName) heading.title = "Gruppe zum Sortieren ziehen";

        const handle = document.createElement("span");
        handle.className = "zh-priority-group-handle";
        handle.textContent = groupName ? "⠿" : "";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = groupName || "Ohne Gruppe";

        const countSpan = document.createElement("span");
        countSpan.className = "zh-priority-group-count";
        countSpan.textContent = String(groupTemplates.length);

        heading.append(handle, nameSpan, countSpan);
        heading.addEventListener("dragstart", (event) => {
          if (!groupName) return;
          event.dataTransfer.setData("text/plain", `group:${groupName}`);
          event.dataTransfer.effectAllowed = "move";
        });
        section.appendChild(heading);
      }

      const tiles = document.createElement("div");
      tiles.className = "zh-priority-tiles";
      tiles.dataset.group = groupName;
      groupTemplates.forEach((template) => tiles.appendChild(createPriorityTemplateTile(template, list)));
      section.appendChild(tiles);

      section.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types?.includes("text/plain")) return;
        event.preventDefault();
      });
      section.addEventListener("drop", (event) => {
        const data = event.dataTransfer.getData("text/plain") || "";
        if (!data.startsWith("group:")) return;
        event.preventDefault();

        const draggedGroup = data.slice(6);
        if (!draggedGroup || draggedGroup === groupName) return;

        const order = getPriorityGroups().filter((name) => name && name !== draggedGroup);
        const targetIndex = order.indexOf(groupName);
        if (targetIndex < 0) order.push(draggedGroup);
        else order.splice(targetIndex, 0, draggedGroup);

        priorityTemplateConfig = normalizePriorityTemplateConfig({
          groups: order,
          templates: readPriorityTemplateEditorRows(list)
        });
        renderPriorityTemplateEditorRows(list);
      });

      tiles.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types?.includes("text/plain")) return;
        event.preventDefault();
      });
      tiles.addEventListener("drop", (event) => {
        const data = event.dataTransfer.getData("text/plain") || "";
        if (!data.startsWith("tile:")) return;
        event.preventDefault();
        event.stopPropagation();

        const dragged = findPriorityTileById(list, data.slice(5));
        if (!dragged) return;

        movePriorityTileToGroup(dragged, groupName);
        tiles.appendChild(dragged);
        commitPriorityTemplateTiles(list);
      });

      list.appendChild(section);
    });

    applyPriorityTemplateFilter(list);
  }

  function closePriorityTemplateManager() {
    document.querySelector(".zh-priority-modal-backdrop")?.remove();
  }

  function openPriorityTemplateManager() {
    closePriorityTemplateManager();
    addPriorityTemplateStyles();

    const backdrop = document.createElement("div");
    backdrop.className = "zh-priority-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "zh-priority-modal";
    backdrop.appendChild(modal);

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "Prioritäts-Vorlagen bearbeiten";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Schließen";
    closeButton.addEventListener("click", closePriorityTemplateManager);
    header.append(title, closeButton);
    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "zh-priority-modal-body";

    const tools = document.createElement("div");
    tools.className = "zh-priority-modal-tools";

    const filterInput = document.createElement("input");
    filterInput.type = "search";
    filterInput.placeholder = "Vorlagen filtern (Name oder Gruppe)…";
    filterInput.value = priorityTemplateFilter;
    filterInput.addEventListener("input", () => {
      priorityTemplateFilter = filterInput.value;
      applyPriorityTemplateFilter(list);
    });
    tools.appendChild(filterInput);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "zh-priority-add";
    addButton.textContent = "+ Vorlage";
    addButton.addEventListener("click", () => {
      const templates = readPriorityTemplateEditorRows(list);
      templates.push({
        title: "Neue Vorlage",
        color: "#3976bb",
        group: "",
        fields: { type: "", queue: "", service: "", owner: "", category: "", subject: "", body: "" }
      });
      priorityTemplateConfig = normalizePriorityTemplateConfig({ groups: getPriorityGroups(), templates });
      renderPriorityTemplateEditorRows(list);
    });
    tools.appendChild(addButton);
    body.appendChild(tools);

    const list = document.createElement("div");
    list.className = "zh-priority-groups";
    body.appendChild(list);
    modal.appendChild(body);
    renderPriorityTemplateEditorRows(list);

    const footer = document.createElement("footer");

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Standard wiederherstellen";
    resetButton.addEventListener("click", () => {
      priorityTemplateConfig = normalizePriorityTemplateConfig({ templates: DEFAULT_PRIORITY_TEMPLATES });
      renderPriorityTemplateEditorRows(list);
    });

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Exportieren";
    exportButton.title = "Vorlagen als Datei speichern, um sie zu teilen";
    exportButton.addEventListener("click", () => {
      priorityTemplateConfig = normalizePriorityTemplateConfig({ groups: getPriorityGroups(), templates: readPriorityTemplateEditorRows(list) });
      downloadJsonFile("znuny-helper-vorlagen.json", priorityTemplateConfig);
    });

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Importieren";
    importButton.title = "Vorlagen aus einer Datei laden";
    importButton.addEventListener("click", () => {
      importJsonFile((data) => {
        if (!data || !Array.isArray(data.templates)) {
          window.alert("Diese Datei enthält keine gültigen Vorlagen.");
          return;
        }

        priorityTemplateConfig = normalizePriorityTemplateConfig(data);
        renderPriorityTemplateEditorRows(list);
      });
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "zh-priority-template-save";
    saveButton.textContent = "Speichern";
    saveButton.addEventListener("click", () => {
      priorityTemplateConfig = normalizePriorityTemplateConfig({ groups: getPriorityGroups(), templates: readPriorityTemplateEditorRows(list) });
      savePriorityTemplateConfig();
      closePriorityTemplateManager();
      enablePriorityTemplates();
    });

    footer.append(resetButton, exportButton, importButton, saveButton);
    modal.appendChild(footer);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closePriorityTemplateManager();
    });

    document.body.appendChild(backdrop);
  }

  function getPriorityToolbarTarget(doc = document) {
    const settingsWidget = [...doc.querySelectorAll(".WidgetSimple")]
      .find((widget) => /ticket-einstellungen/i.test(normalizeText(getElementText(widget.querySelector(".Header") || widget))));

    if (settingsWidget) {
      const settingsContent = settingsWidget.querySelector(".Content");
      if (settingsContent) {
        return { mode: "prepend-side", element: settingsContent };
      }
      return { mode: "before", element: settingsWidget };
    }

    const firstWidget = [...doc.querySelectorAll(".WidgetSimple, fieldset")]
      .find((element) => /ticket-einstellungen|artikel hinzuf/i.test(normalizeText(getElementText(element))));
    if (firstWidget?.parentElement) {
      return { mode: "before", element: firstWidget };
    }

    return { mode: "prepend", element: doc.querySelector("form") || doc.body };
  }

  function enablePriorityTemplates(doc = document) {
    if (doc === document && window.top !== window.self) return;

    const href = doc.defaultView?.location?.href || window.location.href;
    if (!isPriorityTemplatePage(href)) return;

    addPriorityTemplateStyles(doc);

    const target = getPriorityToolbarTarget(doc);

    const templates = getPriorityTemplates();
    const signature = JSON.stringify({
      mode: target.mode,
      templates: templates.map((template) => [template.id, template.title, template.color, template.group])
    });

    const existing = doc.getElementById("zh-priority-template-toolbar");
    if (existing && existing.dataset.zhSignature === signature) return;
    if (existing) {
      existing.parentElement?.classList.remove("zh-priority-side-layout");
      existing.remove();
    }

    const toolbar = doc.createElement("div");
    toolbar.id = "zh-priority-template-toolbar";
    toolbar.dataset.zhSignature = signature;
    if (target.mode === "prepend-side") {
      toolbar.classList.add("zh-priority-template-side");
      target.element.classList.add("zh-priority-side-layout");
    }

    const byGroup = new Map();
    templates.forEach((template) => {
      const groupName = template.group || "";
      if (!byGroup.has(groupName)) byGroup.set(groupName, []);
      byGroup.get(groupName).push(template);
    });

    const orderedGroups = orderPriorityGroups(byGroup);
    const hasGroups = orderedGroups.some((name) => name !== "");

    const head = doc.createElement("div");
    head.className = "zh-priority-toolbar-head";

    const headTitle = doc.createElement("strong");
    headTitle.textContent = "Vorlagen";
    head.appendChild(headTitle);

    const configButton = doc.createElement("button");
    configButton.type = "button";
    configButton.className = "zh-priority-toolbar-edit";
    configButton.textContent = "Bearbeiten";
    configButton.title = "Vorlagen verwalten";
    configButton.addEventListener("click", openPriorityTemplateManager);
    head.appendChild(configButton);
    toolbar.appendChild(head);

    const groupsWrap = doc.createElement("div");
    groupsWrap.className = "zh-priority-toolbar-groups";

    orderedGroups.forEach((groupName) => {
      const groupTemplates = byGroup.get(groupName) || [];
      if (!groupTemplates.length) return;

      const section = doc.createElement("div");
      section.className = "zh-priority-toolbar-group";

      if (hasGroups) {
        const groupLabel = doc.createElement("div");
        groupLabel.className = "zh-priority-toolbar-group-label";
        groupLabel.textContent = groupName || "Ohne Gruppe";
        section.appendChild(groupLabel);
      }

      const buttons = doc.createElement("div");
      buttons.className = "zh-priority-toolbar-group-buttons";
      groupTemplates.forEach((template) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "zh-priority-template-button";
        button.textContent = template.title;
        button.style.background = template.color || "#3976bb";
        button.title = "Felder mit dieser Vorlage befüllen";
        button.addEventListener("click", () => applyPriorityTemplate(template, doc));
        buttons.appendChild(button);
      });

      section.appendChild(buttons);
      groupsWrap.appendChild(section);
    });

    toolbar.appendChild(groupsWrap);

    const actions = doc.createElement("div");
    actions.className = "zh-priority-toolbar-actions";

    const saveCurrentButton = doc.createElement("button");
    saveCurrentButton.type = "button";
    saveCurrentButton.className = "zh-priority-template-save-current";
    saveCurrentButton.textContent = "Als Vorlage speichern";
    saveCurrentButton.title = "Aktuell ausgefüllte Felder als neue Vorlage speichern";
    saveCurrentButton.addEventListener("click", () => saveCurrentFieldsAsPriorityTemplate(doc));
    actions.appendChild(saveCurrentButton);
    toolbar.appendChild(actions);

    if (doc === document && isPriorityTicketPage(href)) schedulePriorityExternalCustomerBottomNotice();

    if (target.mode === "after") target.element.after(toolbar);
    else if (target.mode === "before") target.element.before(toolbar);
    else target.element.prepend(toolbar);
  }

  function disablePriorityTemplates() {
    closePriorityTemplateManager();
    document.querySelectorAll(".zh-priority-side-layout").forEach((element) => {
      element.classList.remove("zh-priority-side-layout");
    });
    document.getElementById("zh-priority-template-toolbar")?.remove();
    removeStyle("zh-priority-template-style");
  }

  function saveTicketState() {
    syncSet("local", { [TICKET_STATE_KEY]: ticketState });
  }

  function hasManualCategory(ticketId) {
    return Object.prototype.hasOwnProperty.call(ticketState.categories, ticketId);
  }

  function getManualCategory(ticketId) {
    return hasManualCategory(ticketId) ? ticketState.categories[ticketId] : null;
  }

  function setManualCategory(ticketId, category) {
    if (category === "__auto") {
      delete ticketState.categories[ticketId];
    } else {
      ticketState.categories[ticketId] = category;
    }

    saveTicketState();
  }

  function parseAge(text) {
    return ((text.match(/(\d+)\s*d/)?.[1] || 0) * 1440) +
      ((text.match(/(\d+)\s*h/)?.[1] || 0) * 60) +
      Number(text.match(/(\d+)\s*m/)?.[1] || 0);
  }

  function findTicketTable(doc = document) {
    return [...doc.querySelectorAll("table")].find((table) => {
      const text = getElementText(table).toUpperCase();
      return text.includes("CASE") && text.includes("ALTER") && text.includes("SENDER") && text.includes("TITEL");
    });
  }

  function getIndexes(table) {
    const headers = [...table.querySelectorAll("th")].map((th) => getElementText(th).trim().toUpperCase());

    return {
      case: headers.findIndex((header) => header.includes("CASE")),
      age: headers.findIndex((header) => header.includes("ALTER")),
      sender: headers.findIndex((header) => header.includes("SENDER")),
      title: headers.findIndex((header) => header.includes("TITEL")),
      status: headers.findIndex((header) => header.includes("STATUS")),
      customer: headers.findIndex((header) => header.includes("KUNDENNUMMER"))
    };
  }

  function getCellText(row, index) {
    if (index < 0) return "";
    return getElementText(row.querySelectorAll("td")[index]).trim() || "";
  }

  function getTicketId(row, indexes) {
    const cell = row.querySelectorAll("td")[indexes.case];
    if (!cell) return "";
    if (cell.dataset.zhTicketId) return cell.dataset.zhTicketId;

    const id = getElementText(cell).trim().match(/\b\d{7,}\b/)?.[0] || "";
    if (id) cell.dataset.zhTicketId = id;

    return id;
  }

  function getAgeMinutes(row, indexes) {
    return parseAge(getCellText(row, indexes.age));
  }

  function getSearchText(row, indexes) {
    return [
      getCellText(row, indexes.case),
      getCellText(row, indexes.sender),
      getCellText(row, indexes.title),
      getCellText(row, indexes.status),
      getCellText(row, indexes.customer)
    ].join(" ").toLowerCase();
  }

  function isTicketListPage() {
    return Boolean(findTicketTable());
  }

  function isSearchResultsPage() {
    const href = window.location.href;
    const bodyText = document.body?.innerText || "";

    return /Action=Agent(?:Ticket)?Search/i.test(href) ||
      /^\s*Suchergebnisse:/im.test(bodyText);
  }

  function isTicketZoomHref(href) {
    return /Action=AgentTicketZoom/i.test(String(href || "")) &&
      /(?:[?;&]|%3B)(?:TicketID|TicketNumber|Case)(?:=|%3D)\d+/i.test(String(href || ""));
  }

  function normalizeTicketZoomUrl(href) {
    try {
      return new URL(href, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function getSearchResultTicketUrl(target) {
    const anchor = target?.closest?.("a[href]");
    if (anchor && isTicketZoomHref(anchor.getAttribute("href") || anchor.href)) {
      return normalizeTicketZoomUrl(anchor.getAttribute("href") || anchor.href);
    }

    const row = target?.closest?.("tr");
    if (!row) return "";

    const rowLink = row.querySelector('a[href*="AgentTicketZoom"], a[href*="TicketID="], a[href*="TicketNumber="]');
    if (rowLink && isTicketZoomHref(rowLink.getAttribute("href") || rowLink.href)) {
      return normalizeTicketZoomUrl(rowLink.getAttribute("href") || rowLink.href);
    }

    const clickSource = row.getAttribute("onclick") || "";
    const quotedUrl = clickSource.match(/['"]([^'"]*index\.pl[^'"]*)['"]/)?.[1];
    if (quotedUrl && isTicketZoomHref(quotedUrl)) {
      return normalizeTicketZoomUrl(quotedUrl);
    }

    const ticketNumber = row.innerText.match(/\b\d{7,}\b/)?.[0] || "";
    if (!ticketNumber) return "";

    const url = new URL(window.location.href);
    url.search = `?Action=AgentTicketZoom;TicketNumber=${ticketNumber}`;
    return url.href;
  }

  function prepareSearchResultLinksForNewTabs() {
    if (!isSearchResultsPage()) return;

    document.querySelectorAll('a[href*="AgentTicketZoom"], a[href*="TicketID="], a[href*="TicketNumber="]').forEach((anchor) => {
      if (!isTicketZoomHref(anchor.getAttribute("href") || anchor.href)) return;
      if (!settings.searchResultsPopup) {
        anchor.removeAttribute("target");
        anchor.removeAttribute("rel");
        return;
      }
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    });
  }

  function handleSearchResultTicketClick(event) {
    if (!settings.searchResultsPopup) return;
    if (!isSearchResultsPage()) return;
    if (event.defaultPrevented || event.button > 0) return;
    if (event.target?.closest?.("input, select, textarea, button, .zh-cat-ui, .zh-note-wrap")) return;

    const anchor = event.target?.closest?.("a[href]");
    if (anchor && isTicketZoomHref(anchor.getAttribute("href") || anchor.href)) {
      const url = normalizeTicketZoomUrl(anchor.getAttribute("href") || anchor.href);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.open(url, "_blank", "noopener");
      return;
    }

    const url = getSearchResultTicketUrl(event.target);
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    window.open(url, "_blank", "noopener");
  }

  function enableSearchResultLinksNewTabs() {
    prepareSearchResultLinksForNewTabs();

    if (document.documentElement.dataset.zhSearchResultTabsBound === "1") return;
    document.documentElement.dataset.zhSearchResultTabsBound = "1";
    document.addEventListener("click", handleSearchResultTicketClick, true);
  }

  function normalizeListUrl(url) {
    try {
      const parsed = new URL(url, window.location.href);
      parsed.hash = "";
      return parsed.href;
    } catch (error) {
      return "";
    }
  }

  function findNextTicketListUrl(doc = document) {
    const links = [...doc.querySelectorAll("a[href]")]
      .map((link) => ({
        link,
        text: normalizeText(link.innerText || link.textContent || ""),
        href: normalizeListUrl(link.getAttribute("href") || link.href)
      }))
      .filter((item) => item.href)
      .filter((item) => /Action=AgentTicket|Action=AgentSearch|Action=AgentDashboard/i.test(item.href));

    const explicitNext = links.find((item) =>
      /^(>|›|weiter|next)$/i.test(item.text) ||
      /^(>>|»)$/.test(item.text)
    );

    if (explicitNext) return explicitNext.href;

    const currentPage = Number(getElementText(doc.body).match(/Seite:\s*(\d+)/i)?.[1] || 0);
    const numericLinks = links
      .map((item) => ({ ...item, page: Number(item.text.match(/^\d+$/)?.[0] || 0) }))
      .filter((item) => item.page > 0)
      .sort((left, right) => left.page - right.page);

    if (currentPage > 0) {
      return numericLinks.find((item) => item.page === currentPage + 1)?.href || "";
    }

    return numericLinks[0]?.href || "";
  }

  function getExistingTicketIds(table, indexes) {
    const ids = new Set();

    table.querySelectorAll("tbody tr").forEach((row) => {
      const ticketId = getTicketId(row, indexes);
      if (ticketId) ids.add(ticketId);
    });

    return ids;
  }

  function ensureInfiniteScrollStatus(table) {
    let status = document.getElementById("zh-infinite-scroll-status");
    if (status) return status;

    status = document.createElement("div");
    status.id = "zh-infinite-scroll-status";
    status.textContent = "";

    const resolvedTable = table || findTicketTable();
    resolvedTable?.parentElement?.appendChild(status);
    return status;
  }

  function addInfiniteScrollStyles() {
    addStyle("zh-infinite-scroll-style", `
      #zh-infinite-scroll-status { padding: 10px 12px; color: #555; font-size: 12px; text-align: center; background: #f4f4f4; border-top: 1px solid #ddd; }
      #zh-infinite-scroll-status:empty { display: none; }
    `);
  }

  function setInfiniteScrollStatus(text, table) {
    if (!text) {
      document.getElementById("zh-infinite-scroll-status")?.remove();
      return;
    }

    const status = ensureInfiniteScrollStatus(table);
    status.textContent = text;
  }

  const INFINITE_SCROLL_MAX_FAILURES = 3;
  const INFINITE_SCROLL_RETRY_DELAY_MS = 4000;

  async function loadNextTicketListPage() {
    if (infiniteScrollState.loading || infiniteScrollState.done || !infiniteScrollState.nextUrl) return;

    const table = findTicketTable();
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return;

    infiniteScrollState.loading = true;
    setInfiniteScrollStatus("Weitere Tickets werden geladen …", table);

    try {
      const response = await fetch(infiniteScrollState.nextUrl, {
        credentials: "include",
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const nextDoc = new DOMParser().parseFromString(html, "text/html");
      const nextTable = findTicketTable(nextDoc);
      const nextBody = nextTable?.querySelector("tbody");

      if (!nextTable || !nextBody) {
        infiniteScrollState.done = true;
        setInfiniteScrollStatus("Weitere Tickets konnten nicht automatisch geladen werden.", table);
        return;
      }

      const indexes = getIndexes(table);
      const nextIndexes = getIndexes(nextTable);
      const existingIds = getExistingTicketIds(table, indexes);

      [...nextBody.querySelectorAll("tr")].forEach((row) => {
        const ticketId = getTicketId(row, nextIndexes);
        if (ticketId && existingIds.has(ticketId)) return;

        const clone = document.importNode(row, true);
        tbody.appendChild(clone);
        if (ticketId) existingIds.add(ticketId);
      });

      const loadedUrl = infiniteScrollState.nextUrl;
      const followingUrl = findNextTicketListUrl(nextDoc);
      infiniteScrollState.nextUrl =
        followingUrl && normalizeListUrl(followingUrl) !== normalizeListUrl(loadedUrl) ? followingUrl : "";
      infiniteScrollState.done = !infiniteScrollState.nextUrl;
      infiniteScrollState.hasLoadedPage = true;
      infiniteScrollState.failCount = 0;
      infiniteScrollState.nextRetryAt = 0;

      if (settings.ticketCategories && isCategoryTicketListPage()) {
        applyTicketCategories();
      }

      setInfiniteScrollStatus(infiniteScrollState.done ? "Alle Tickets geladen." : "", table);
    } catch (error) {
      console.warn("Znuny Helper infinite scroll failed:", error);
      infiniteScrollState.failCount += 1;

      if (infiniteScrollState.failCount >= INFINITE_SCROLL_MAX_FAILURES) {
        infiniteScrollState.done = true;
        setInfiniteScrollStatus("Weitere Tickets konnten nicht geladen werden. Bitte Seite neu laden.", table);
      } else {
        infiniteScrollState.nextRetryAt = Date.now() + INFINITE_SCROLL_RETRY_DELAY_MS;
        setInfiniteScrollStatus("Weitere Tickets konnten nicht geladen werden, wird erneut versucht …", table);
      }
    } finally {
      infiniteScrollState.loading = false;
      const delay = Math.max(80, infiniteScrollState.nextRetryAt - Date.now());
      window.setTimeout(maybeLoadNextTicketListPage, delay);
    }
  }

  function maybeLoadNextTicketListPage() {
    if (!settings.ticketListInfiniteScroll) return;
    if (infiniteScrollState.loading || infiniteScrollState.done) return;
    if (!infiniteScrollState.nextUrl) return;
    if (Date.now() < infiniteScrollState.nextRetryAt) return;

    const distanceToBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (distanceToBottom < 650) {
      loadNextTicketListPage();
    }
  }

  function enableTicketListInfiniteScroll() {
    if (!isTicketListPage()) {
      disableTicketListInfiniteScroll();
      return;
    }

    const currentUrl = normalizeListUrl(window.location.href);

    addInfiniteScrollStyles();

    if (infiniteScrollState.enabledUrl !== currentUrl) {
      const nextUrl = findNextTicketListUrl();
      infiniteScrollState = {
        enabledUrl: currentUrl,
        nextUrl,
        loading: false,
        done: !nextUrl,
        bound: infiniteScrollState.bound,
        hasLoadedPage: false,
        failCount: 0,
        nextRetryAt: 0
      };
      setInfiniteScrollStatus("");
    } else if (!infiniteScrollState.nextUrl && !infiniteScrollState.hasLoadedPage && !infiniteScrollState.loading) {
      // Only recover nextUrl from the live DOM before any page has loaded (pagination
      // can render late). Afterward the live pager is stale and re-checking it here
      // would keep resetting an already-exhausted or in-flight state.
      const nextUrl = findNextTicketListUrl();
      if (nextUrl) {
        infiniteScrollState.nextUrl = nextUrl;
        infiniteScrollState.done = false;
      }
    }

    if (!infiniteScrollState.bound) {
      infiniteScrollState.bound = true;
      window.addEventListener("scroll", maybeLoadNextTicketListPage, { passive: true });
      window.addEventListener("resize", maybeLoadNextTicketListPage);
    }

    window.setTimeout(maybeLoadNextTicketListPage, 120);
  }

  function disableTicketListInfiniteScroll() {
    document.getElementById("zh-infinite-scroll-status")?.remove();
    removeStyle("zh-infinite-scroll-style");
    infiniteScrollState.nextUrl = "";
    infiniteScrollState.done = true;
    infiniteScrollState.hasLoadedPage = false;
    infiniteScrollState.failCount = 0;
    infiniteScrollState.nextRetryAt = 0;
  }

  function autoDetectCategory(row, indexes) {
    const text = getSearchText(row, indexes);

    const priority = getCategoryGroups()
      .filter((group) => group.id)
      .sort((a, b) => a.order - b.order)
      .map((group) => group.id);
    const keywords = getCategoryKeywords();

    for (const groupId of priority) {
      const words = keywords[groupId] || [];
      if (words.some((word) => text.includes(word.toLowerCase()))) return groupId;
    }

    return "";
  }

  function getEffectiveCategory(row, indexes) {
    const ticketId = getTicketId(row, indexes);
    const manual = getManualCategory(ticketId);
    return manual !== null ? manual : autoDetectCategory(row, indexes);
  }

  function isStarred(row, indexes) {
    const cells = [...row.querySelectorAll("td")];
    const beforeCase = cells.slice(0, indexes.case);

    return beforeCase.some((cell) => {
      const text = cell.innerText.trim();
      const html = cell.innerHTML.toLowerCase();

      return text.includes("*") ||
        html.includes("star") ||
        html.includes("important") ||
        html.includes("flag") ||
        html.includes("priority");
    });
  }

  function addTicketCategoryStyles() {
    addStyle("zh-ticket-category-style", `
      .zh-cat-ui { display: inline-block; width: 104px; height: 19px; margin-left: 6px; vertical-align: middle; position: relative; }
      .zh-badge, .zh-category-select { width: 100px; box-sizing: border-box; position: absolute; left: 0; top: 0; }
      .zh-badge { font-size: 10px; padding: 1px 5px; border-radius: 3px; border: 1px solid rgba(0,0,0,.22); color: #111; text-align: center; height: 19px; line-height: 15px; overflow: hidden; display: inline-block; font-weight: 400; }
      .zh-badge-auto { font-style: italic; border-style: dashed; border-color: rgba(0,0,0,.35); }
      .zh-category-select { visibility: hidden; opacity: 0; font-size: 11px; height: 20px; border: 1px solid #999; border-radius: 3px; background: white; color: black; z-index: 10000; }
      .zh-cat-ui:hover .zh-category-select, .zh-cat-ui:focus-within .zh-category-select { visibility: visible; opacity: 1; }
      .zh-cat-ui:hover .zh-badge, .zh-cat-ui:focus-within .zh-badge { visibility: hidden; opacity: 0; }
      .zh-note-wrap { display: inline-block; position: relative; margin-left: 4px; vertical-align: middle; }
      .zh-note-btn { cursor: pointer; border: none; background: transparent; font-size: 13px; padding: 0 2px; opacity: .45; }
      .zh-note-btn:hover, .zh-note-btn.has-note { opacity: 1; background: #ffeb99; border-radius: 4px; }
      .zh-note-popup { position: fixed; width: 240px; background: #fffef5; border: 1px solid #c9b458; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.24); padding: 8px; z-index: 999999; }
      .zh-note-popup-title { font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #333; }
      .zh-note-popup textarea { width: 100%; height: 75px; resize: vertical; box-sizing: border-box; font-size: 12px; border: 1px solid #aaa; border-radius: 4px; padding: 5px; }
      .zh-note-actions { display: flex; justify-content: flex-end; gap: 5px; margin-top: 5px; }
      .zh-note-actions button { font-size: 11px; padding: 3px 7px; border: 1px solid #999; border-radius: 4px; background: #eee; cursor: pointer; }
      .zh-auto-marker { font-size: 10px; opacity: .6; margin-left: 3px; }
      .zh-category-tools { margin: 7px 0; }
      .zh-category-manage-btn { font-size: 11px; padding: 3px 8px; border: 1px solid #aaa; border-radius: 3px; background: #f5f5f5; color: #222; cursor: pointer; }
      .zh-category-manage-btn:hover { background: #fff; }
      .zh-row-starred td:first-child { box-shadow: inset 3px 0 0 #ff9900; }
      .zh-age-warn { color: #b26a00 !important; font-weight: bold; }
      .zh-age-hot { color: #b00000 !important; font-weight: bold; }
      .zh-age-old { color: #6f2dbd !important; font-weight: bold; }
      .zh-category-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999998; display: flex; align-items: center; justify-content: center; }
      .zh-category-modal { width: min(920px, 94vw); max-height: 88vh; overflow: auto; background: #fff; border: 1px solid #777; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.35); color: #111; }
      .zh-category-modal header { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-bottom: 1px solid #ddd; background: #f1f1f1; }
      .zh-category-modal h2 { margin: 0; font-size: 15px; }
      .zh-category-modal-body { padding: 10px; }
      .zh-category-editor-hint { font-size: 11px; color: #555; margin-bottom: 8px; padding: 6px 8px; background: #eef4ff; border: 1px solid #cfe0ff; border-radius: 4px; }
      .zh-category-editor-row { display: grid; grid-template-columns: 26px minmax(150px, 1.4fr) 96px 56px auto; grid-template-areas: "order title short color actions" "keywords keywords keywords keywords keywords"; gap: 6px 8px; align-items: center; margin-bottom: 6px; padding: 7px 9px; border: 1px solid #e4e4e4; border-radius: 6px; background: #fff; }
      .zh-category-editor-order { grid-area: order; text-align: center; color: #888; font-size: 12px; }
      .zh-category-editor-row input, .zh-category-editor-row textarea { width: 100%; box-sizing: border-box; font-size: 12px; }
      .zh-category-editor-row [name="title"] { grid-area: title; }
      .zh-category-editor-row [name="short"] { grid-area: short; }
      .zh-category-editor-row [name="color"] { grid-area: color; height: 30px; padding: 2px; }
      .zh-category-editor-row [name="keywords"] { grid-area: keywords; min-height: 30px; max-height: 140px; resize: vertical; }
      .zh-category-editor-actions { grid-area: actions; display: flex; gap: 4px; flex-wrap: nowrap; }
      .zh-category-modal button { font-size: 11px; padding: 3px 7px; border: 1px solid #999; border-radius: 3px; background: #eee; cursor: pointer; }
      .zh-category-modal footer { display: flex; justify-content: space-between; gap: 8px; padding: 10px 12px; border-top: 1px solid #ddd; background: #f7f7f7; }
    `);
  }

  function blockTicketNavigation(element) {
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "dblclick"].forEach((eventName) => {
      element.addEventListener(eventName, (event) => event.stopPropagation());
    });
  }

  function closeAllNotePopups() {
    document.querySelectorAll(".zh-note-popup").forEach((popup) => popup.remove());
    openNoteTicketId = null;
  }

  function openNotePopup(button, ticketId) {
    closeAllNotePopups();
    openNoteTicketId = ticketId;

    const rect = button.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.className = "zh-note-popup";
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
    popup.style.top = `${rect.bottom + 6}px`;

    const title = document.createElement("div");
    title.className = "zh-note-popup-title";
    title.textContent = `Notiz für Ticket ${ticketId}`;

    const textarea = document.createElement("textarea");
    textarea.placeholder = "Lokale Notiz...";
    textarea.value = ticketState.notes[ticketId] || "";

    const actions = document.createElement("div");
    actions.className = "zh-note-actions";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Loeschen";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Abbrechen";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Speichern";

    actions.append(deleteButton, cancelButton, saveButton);
    popup.append(title, textarea, actions);

    [popup, textarea, deleteButton, cancelButton, saveButton].forEach(blockTicketNavigation);

    saveButton.addEventListener("click", (event) => {
      stopEvent(event);
      const value = textarea.value.trim();

      if (value) {
        ticketState.notes[ticketId] = value;
      } else {
        delete ticketState.notes[ticketId];
      }

      saveTicketState();
      closeAllNotePopups();
      applyTicketCategories();
    });

    deleteButton.addEventListener("click", (event) => {
      stopEvent(event);
      delete ticketState.notes[ticketId];
      saveTicketState();
      closeAllNotePopups();
      applyTicketCategories();
    });

    cancelButton.addEventListener("click", (event) => {
      stopEvent(event);
      closeAllNotePopups();
    });

    document.body.appendChild(popup);
    window.setTimeout(() => textarea.focus(), 30);
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".zh-note-popup") && !event.target.closest(".zh-note-btn")) {
      closeAllNotePopups();
    }
  });

  function decorateCaseCell(row, indexes) {
    const cell = row.querySelectorAll("td")[indexes.case];
    const ticketId = getTicketId(row, indexes);

    if (!cell || !ticketId || cell.querySelector(".zh-cat-ui")) return;

    if (!cell.dataset.zhOriginalBackground) {
      cell.dataset.zhOriginalBackground = cell.style.background || "";
      cell.dataset.zhOriginalFontWeight = cell.style.fontWeight || "";
    }

    const ui = document.createElement("span");
    ui.className = "zh-cat-ui";

    const badge = document.createElement("span");
    badge.className = "zh-badge";

    const select = document.createElement("select");
    select.className = "zh-category-select";

    const autoOption = document.createElement("option");
    autoOption.value = "__auto";
    autoOption.textContent = "Auto (Vorschlag)";
    select.appendChild(autoOption);

    getCategoryGroups().forEach((group) => {
      const option = document.createElement("option");
      option.value = group.id;
      option.textContent = group.title;
      select.appendChild(option);
    });

    blockTicketNavigation(ui);
    blockTicketNavigation(select);

    select.addEventListener("change", (event) => {
      stopEvent(event);
      setManualCategory(ticketId, select.value);
      window.setTimeout(applyTicketCategories, 50);
    });

    ui.append(badge, select);
    cell.appendChild(ui);

    const noteWrap = document.createElement("span");
    noteWrap.className = "zh-note-wrap";

    const noteButton = document.createElement("button");
    noteButton.type = "button";
    noteButton.className = "zh-note-btn";
    noteButton.textContent = "N";
    noteButton.title = "Lokale Notiz";

    blockTicketNavigation(noteWrap);
    blockTicketNavigation(noteButton);

    noteButton.addEventListener("click", (event) => {
      stopEvent(event);
      if (openNoteTicketId === ticketId) {
        closeAllNotePopups();
      } else {
        openNotePopup(noteButton, ticketId);
      }
    });

    noteWrap.appendChild(noteButton);
    cell.appendChild(noteWrap);
  }

  function decorateAgeCell(row, indexes) {
    const ageCell = row.querySelectorAll("td")[indexes.age];
    if (!ageCell) return;

    ageCell.classList.remove("zh-age-warn", "zh-age-hot", "zh-age-old");

    const age = getAgeMinutes(row, indexes);

    if (age >= 100 * 1440) ageCell.classList.add("zh-age-old");
    else if (age >= 30 * 1440) ageCell.classList.add("zh-age-hot");
    else if (age >= 7 * 1440) ageCell.classList.add("zh-age-warn");
  }

  function removeGroupHeaders(tbody) {
    tbody.querySelectorAll(".zh-group-header").forEach((row) => row.remove());
  }

  function ensureCategoryManageButton(table) {
    if (document.getElementById("zh-category-manage-btn")) return;

    const wrap = document.createElement("div");
    wrap.className = "zh-category-tools";

    const button = document.createElement("button");
    button.id = "zh-category-manage-btn";
    button.type = "button";
    button.className = "zh-category-manage-btn";
    button.textContent = "Kategorien bearbeiten";
    button.addEventListener("click", (event) => {
      stopEvent(event);
      openCategoryManager();
    });

    wrap.appendChild(button);
    table.parentElement.insertBefore(wrap, table);
  }

  function closeCategoryManager() {
    document.querySelectorAll(".zh-category-modal-backdrop").forEach((element) => element.remove());
  }

  function autoSizeCategoryKeywords(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 30), 140)}px`;
  }

  function createCategoryEditorRow(group, keywords) {
    const row = document.createElement("div");
    row.className = "zh-category-editor-row";
    row.dataset.categoryId = group.id;

    const order = document.createElement("div");
    order.className = "zh-category-editor-order";
    order.textContent = String(group.order);

    const title = document.createElement("input");
    title.name = "title";
    title.value = group.title;
    title.placeholder = "Titel";

    const short = document.createElement("input");
    short.name = "short";
    short.value = group.short;
    short.placeholder = "Kurz";

    const color = document.createElement("input");
    color.name = "color";
    color.type = "color";
    color.value = /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : "#eeeeee";
    color.disabled = group.id === "";

    const keywordBox = document.createElement("textarea");
    keywordBox.name = "keywords";
    keywordBox.value = (keywords[group.id] || []).join(", ");
    keywordBox.placeholder = "Keywords, getrennt mit Komma oder Zeile";
    keywordBox.disabled = group.id === "";
    keywordBox.addEventListener("input", () => autoSizeCategoryKeywords(keywordBox));

    const actions = document.createElement("div");
    actions.className = "zh-category-editor-actions";

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "Hoch";
    up.dataset.action = "up";
    up.disabled = group.id === "";
    up.title = "Höhere Priorität bei der automatischen Erkennung";

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "Runter";
    down.dataset.action = "down";
    down.disabled = group.id === "";
    down.title = "Niedrigere Priorität bei der automatischen Erkennung";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Loeschen";
    remove.dataset.action = "remove";
    remove.disabled = group.id === "";

    actions.append(up, down, remove);
    row.append(order, title, short, color, keywordBox, actions);
    return row;
  }

  function readCategoryManagerRows(container) {
    const groups = [];
    const keywords = {};

    [...container.querySelectorAll(".zh-category-editor-row[data-category-id]")].forEach((row, index) => {
      const oldId = row.dataset.categoryId;
      const title = row.querySelector('[name="title"]').value.trim() || "Kategorie";
      const short = row.querySelector('[name="short"]').value.trim() || title;
      const id = oldId === "" ? "" : normalizeCategoryId(oldId || short || title);
      const color = oldId === "" ? "" : row.querySelector('[name="color"]').value;
      const words = row.querySelector('[name="keywords"]').value
        .split(/[\n,]+/)
        .map((word) => word.trim())
        .filter(Boolean);

      groups.push({
        id,
        title,
        short,
        color,
        order: index + 1
      });
      keywords[id] = words;
    });

    return normalizeCategoryConfig({ groups, keywords });
  }

  function renderCategoryManagerRows(list) {
    list.innerHTML = "";

    const hint = document.createElement("div");
    hint.className = "zh-category-editor-hint";
    hint.textContent = "Die Reihenfolge (Hoch/Runter) bestimmt auch die Priorität bei der automatischen Erkennung: Passt der Text auf mehrere Kategorien, gewinnt die weiter oben stehende.";
    list.appendChild(hint);

    const groups = getCategoryGroups();
    const keywords = getCategoryKeywords();
    groups.forEach((group) => {
      const row = createCategoryEditorRow(group, keywords);
      list.appendChild(row);
      autoSizeCategoryKeywords(row.querySelector('[name="keywords"]'));
    });
  }

  function openCategoryManager() {
    closeCategoryManager();

    const backdrop = document.createElement("div");
    backdrop.className = "zh-category-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "zh-category-modal";

    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "Ticket-Kategorien bearbeiten";
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "Schliessen";
    closeButton.addEventListener("click", closeCategoryManager);
    header.append(title, closeButton);

    const body = document.createElement("div");
    body.className = "zh-category-modal-body";
    const list = document.createElement("div");
    body.appendChild(list);

    const footer = document.createElement("footer");
    const leftActions = document.createElement("div");
    const rightActions = document.createElement("div");

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Kategorie hinzufuegen";
    addButton.addEventListener("click", () => {
      const current = readCategoryManagerRows(list);
      const nextId = `kategorie-${Date.now()}`;
      current.groups.push({
        id: nextId,
        title: "Neue Kategorie",
        short: "Neu",
        color: "#eeeeee",
        order: current.groups.length + 1
      });
      categoryConfig = normalizeCategoryConfig(current);
      renderCategoryManagerRows(list);
    });

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Standard wiederherstellen";
    resetButton.addEventListener("click", () => {
      categoryConfig = normalizeCategoryConfig({ groups: DEFAULT_GROUPS, keywords: DEFAULT_KEYWORDS });
      renderCategoryManagerRows(list);
    });

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "Exportieren";
    exportButton.title = "Kategorien als Datei speichern, um sie zu teilen";
    exportButton.addEventListener("click", () => {
      categoryConfig = readCategoryManagerRows(list);
      downloadJsonFile("znuny-helper-kategorien.json", categoryConfig);
    });

    const importButton = document.createElement("button");
    importButton.type = "button";
    importButton.textContent = "Importieren";
    importButton.title = "Kategorien aus einer Datei laden";
    importButton.addEventListener("click", () => {
      importJsonFile((data) => {
        if (!data || !Array.isArray(data.groups)) {
          window.alert("Diese Datei enthält keine gültigen Ticket-Kategorien.");
          return;
        }

        categoryConfig = normalizeCategoryConfig(data);
        renderCategoryManagerRows(list);
      });
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Speichern";
    saveButton.addEventListener("click", () => {
      categoryConfig = readCategoryManagerRows(list);
      saveCategoryConfig();
      closeCategoryManager();
      disableTicketCategories();
      applyTicketCategories();
    });

    leftActions.append(addButton, resetButton, exportButton, importButton);
    rightActions.append(saveButton);
    footer.append(leftActions, rightActions);

    list.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      stopEvent(event);
      categoryConfig = readCategoryManagerRows(list);
      const row = button.closest(".zh-category-editor-row");
      const id = row?.dataset.categoryId;
      const index = categoryConfig.groups.findIndex((group) => group.id === id);

      if (index < 0) return;

      if (button.dataset.action === "remove") {
        categoryConfig.groups.splice(index, 1);
        delete categoryConfig.keywords[id];
      } else if (button.dataset.action === "up" && index > 1) {
        [categoryConfig.groups[index - 1], categoryConfig.groups[index]] = [categoryConfig.groups[index], categoryConfig.groups[index - 1]];
      } else if (button.dataset.action === "down" && index < categoryConfig.groups.length - 1) {
        [categoryConfig.groups[index + 1], categoryConfig.groups[index]] = [categoryConfig.groups[index], categoryConfig.groups[index + 1]];
      }

      categoryConfig.groups.forEach((group, groupIndex) => {
        group.order = groupIndex + 1;
      });
      renderCategoryManagerRows(list);
    });

    modal.append(header, body, footer);
    backdrop.appendChild(modal);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeCategoryManager();
    });
    document.body.appendChild(backdrop);
    renderCategoryManagerRows(list);
  }

  function applyTicketCategories() {
    if (!isCategoryTicketListPage()) {
      disableTicketCategories();
      return;
    }

    const table = findTicketTable();
    if (!table) return;

    addTicketCategoryStyles();
    ensureCategoryManageButton(table);

    const indexes = getIndexes(table);
    const tbody = table.querySelector("tbody");
    if (!tbody || indexes.case < 0) return;

    removeGroupHeaders(tbody);

    const rows = [...tbody.querySelectorAll("tr")]
      .filter((row) => !row.classList.contains("zh-group-header"));

    rows.forEach((row, index) => {
      if (!row.dataset.zhOriginalIndex) row.dataset.zhOriginalIndex = String(index);
    });

    const groups = getCategoryGroups();

    rows.forEach((row) => {
      decorateCaseCell(row, indexes);
      decorateAgeCell(row, indexes);

      const ticketId = getTicketId(row, indexes);
      const caseCell = row.querySelectorAll("td")[indexes.case];
      const effectiveCategory = getEffectiveCategory(row, indexes);
      const manualCategory = getManualCategory(ticketId);
      const group = groups.find((item) => item.id === effectiveCategory) || groups[0];

      const textColor = group.color ? getReadableTextColor(group.color) : "";
      setProtectedFill(caseCell, group.color);
      caseCell.style.fontWeight = "";
      caseCell.style.color = textColor;

      const badge = caseCell.querySelector(".zh-badge");
      const select = caseCell.querySelector(".zh-category-select");
      const noteButton = caseCell.querySelector(".zh-note-btn");
      const isAuto = manualCategory === null;

      if (badge) {
        const marker = isAuto && group.id ? " (Vorschlag)" : "";
        badge.textContent = (group.id ? group.short : "Keine") + marker;
        setProtectedFill(badge, group.color || "#eeeeee");
        badge.style.color = group.color ? getReadableTextColor(group.color) : "#111";
        badge.classList.toggle("zh-badge-auto", isAuto && Boolean(group.id));
        badge.title = isAuto
          ? "Automatisch erkannt - ungeprüfter Vorschlag. Zum Bestätigen/Ändern die Auswahl nutzen."
          : "Manuell gesetzt";
      }

      if (select) {
        select.value = isAuto ? "__auto" : manualCategory;
        select.title = isAuto ? "Auto-Erkennung aktiv (Vorschlag)" : "Manuell gesetzt";
      }

      if (noteButton) {
        const note = ticketState.notes[ticketId] || "";
        noteButton.classList.toggle("has-note", Boolean(note));
        noteButton.title = note ? `Notiz: ${note}` : "Lokale Notiz";
      }

      row.classList.toggle("zh-row-starred", isStarred(row, indexes));

      row.style.display = "";
    });

    rows.forEach((row) => tbody.appendChild(row));
  }

  function disableTicketCategories() {
    closeAllNotePopups();
    closeCategoryManager();
    removeStyle("zh-ticket-category-style");
    document.getElementById("zh-toolbar")?.remove();
    document.querySelectorAll(".zh-category-tools").forEach((element) => element.remove());

    const table = findTicketTable();
    const tbody = table?.querySelector("tbody");
    if (!tbody) return;

    removeGroupHeaders(tbody);

    [...tbody.querySelectorAll("tr")]
      .sort((a, b) => Number(a.dataset.zhOriginalIndex || 0) - Number(b.dataset.zhOriginalIndex || 0))
      .forEach((row) => {
        row.style.display = "";
        row.classList.remove("zh-row-starred");

        row.querySelectorAll(".zh-age-warn, .zh-age-hot, .zh-age-old").forEach((cell) => {
          cell.classList.remove("zh-age-warn", "zh-age-hot", "zh-age-old");
        });

        row.querySelectorAll(".zh-cat-ui, .zh-note-wrap").forEach((element) => element.remove());

        row.querySelectorAll("[data-zh-original-background]").forEach((cell) => {
          cell.style.background = cell.dataset.zhOriginalBackground || "";
          cell.style.backgroundImage = "";
          cell.style.fontWeight = cell.dataset.zhOriginalFontWeight || "";
          cell.style.color = "";
        });

        tbody.appendChild(row);
      });
  }

  let quickReplyPollTimer = null;

  function closeQuickReplyDrawer() {
    if (quickReplyPollTimer) {
      window.clearInterval(quickReplyPollTimer);
      quickReplyPollTimer = null;
    }
    document.getElementById("zh-quick-reply-drawer")?.remove();
  }

  function getQuickReplyIframeHref(iframe) {
    try {
      return iframe.contentWindow?.location?.href || "";
    } catch (error) {
      return "";
    }
  }

  function addQuickReplyStyles() {
    addStyle("zh-quick-reply-style", `
      #zh-quick-reply-drawer {
        position: fixed;
        right: 16px;
        bottom: 0;
        width: min(960px, 94vw);
        height: min(720px, 88vh);
        background: #fff;
        border-radius: 10px 10px 0 0;
        box-shadow: 0 10px 40px rgba(0,0,0,.35);
        z-index: 999998;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,.15);
        border-bottom: none;
      }
      .zh-quick-reply-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 12px;
        background: #f2f2f2;
        border-bottom: 1px solid rgba(0,0,0,.1);
        font-size: 13px;
        color: #222;
      }
      .zh-quick-reply-close {
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
        border: 1px solid #999;
        border-radius: 999px;
        background: #eee;
        color: #111;
        cursor: pointer;
      }
      .zh-quick-reply-close:hover { background: #fff; }
      .zh-quick-reply-frame {
        flex: 1;
        width: 100%;
        border: 0;
        background: #fff;
      }
    `);
  }

  function isRealQuickReplyHref(href) {
    return Boolean(href) && href !== "about:blank";
  }

  function findSubmitControlInDocument(doc) {
    const candidates = [...doc.querySelectorAll('button, input[type="submit"], input[type="button"]')]
      .filter(isVisibleFormControl);
    return candidates.find(isTransmitSubmitControl) || null;
  }

  function bindQuickReplyKeyboardShortcut(doc) {
    if (!doc || doc.__zhQuickReplyShortcutBound) return;

    try {
      doc.__zhQuickReplyShortcutBound = true;
      doc.addEventListener("keydown", (event) => {
        if (!settings.keyboardShortcuts) return;
        if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;

        const control = findSubmitControlInDocument(doc);
        if (!control) return;

        event.preventDefault();
        event.stopPropagation();
        control.click();
      }, true);

      doc.querySelectorAll("iframe").forEach((nestedFrame) => {
        try {
          if (nestedFrame.contentDocument) bindQuickReplyKeyboardShortcut(nestedFrame.contentDocument);
        } catch (error) {
          // Cross-origin nested frame; nothing to bind there.
        }
      });
    } catch (error) {
      // Cross-origin document access can fail; nothing to bind in that case.
    }
  }

  function bindQuickReplyCancelLink(doc) {
    doc.querySelectorAll(".CancelClosePopup").forEach((link) => {
      if (link.dataset.zhQuickReplyCancelBound === "1") return;
      link.dataset.zhQuickReplyCancelBound = "1";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeQuickReplyDrawer();
      });
    });
  }

  function getQuickReplyTitle(url) {
    if (/Action=AgentTicketOwner\b/i.test(url)) return "Besitzer ändern";
    if (/Action=AgentTicketNote\b/i.test(url)) return "Notiz hinzufügen";
    if (/Action=AgentTicketClose\b/i.test(url)) return "Ticket schließen";
    if (/Action=AgentTicketMerge\b/i.test(url)) return "Tickets zusammenfassen";
    if (/Action=AgentLinkObject\b/i.test(url)) return "Verknüpfen";
    return "Schnellantwort";
  }

  function openQuickReplyDrawer(url) {
    if (window.top !== window.self) return;

    closeQuickReplyDrawer();
    addQuickReplyStyles();

    const drawer = document.createElement("div");
    drawer.id = "zh-quick-reply-drawer";

    const header = document.createElement("div");
    header.className = "zh-quick-reply-header";

    const title = document.createElement("strong");
    title.textContent = getQuickReplyTitle(url);
    header.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "zh-quick-reply-close";
    closeButton.textContent = "Schliessen";
    closeButton.title = "Fenster schliessen, ohne zu übermitteln";
    closeButton.addEventListener("click", closeQuickReplyDrawer);
    header.appendChild(closeButton);

    drawer.appendChild(header);

    const iframe = document.createElement("iframe");
    iframe.className = "zh-quick-reply-frame";
    drawer.appendChild(iframe);

    document.body.appendChild(drawer);

    let actionPageSeen = false;

    const applyQuickReplyDocumentFeatures = () => {
      let doc = null;
      try {
        doc = iframe.contentDocument;
      } catch (error) {
        return;
      }
      if (!doc) return;

      bindQuickReplyKeyboardShortcut(doc);
      if (settings.pendingDateButtons) enablePendingDateQuickButtons(doc);
      if (settings.priorityTemplates) enablePriorityTemplates(doc);
      bindQuickReplyCancelLink(doc);
      expandArticleWidget(doc);
    };

    const refreshQuickReplyPendingDates = () => {
      if (!settings.pendingDateButtons) return;

      let doc = null;
      try {
        doc = iframe.contentDocument;
      } catch (error) {
        return;
      }
      if (!doc) return;

      bindQuickReplyKeyboardShortcut(doc);
      enablePendingDateQuickButtons(doc);
    };

    const retryDocumentFeatures = () => {
      applyQuickReplyDocumentFeatures();
      [150, 600, 1400].forEach((delay) => window.setTimeout(applyQuickReplyDocumentFeatures, delay));

      try {
        const doc = iframe.contentDocument;
        if (doc && !doc.__zhQuickReplyChangeBound) {
          doc.__zhQuickReplyChangeBound = true;
          // Reacts when the agent switches "Nächster Status" to a pending
          // state after the form has already loaded (e.g. the date fields
          // only appear once "warten auf ..." is selected).
          doc.addEventListener("change", applyQuickReplyDocumentFeatures, true);
        }
      } catch (error) {
        // Cross-origin document access can fail; nothing to bind in that case.
      }
    };

    const finishQuickReply = () => {
      closeQuickReplyDrawer();
      window.location.reload();
    };

    // Both a "load" listener and a poll watch for the iframe leaving the
    // tracked action (successful submit or a redirect back to the ticket);
    // the poll is a fallback in case a JS-driven redirect skips a "load" event.
    iframe.addEventListener("load", () => {
      const href = getQuickReplyIframeHref(iframe);
      if (!isRealQuickReplyHref(href)) return;

      if (QUICK_REPLY_ACTION_PATTERN.test(href)) {
        actionPageSeen = true;
        retryDocumentFeatures();
        return;
      }

      if (actionPageSeen) finishQuickReply();
    });

    quickReplyPollTimer = window.setInterval(() => {
      if (!actionPageSeen) return;

      const href = getQuickReplyIframeHref(iframe);
      if (!isRealQuickReplyHref(href)) return;
      if (QUICK_REPLY_ACTION_PATTERN.test(href)) {
        refreshQuickReplyPendingDates();
        return;
      }

      finishQuickReply();
    }, 700);

    iframe.src = url;
  }

  function handleOpenQuickReplyEvent(event) {
    if (!settings.quickReply) return;
    const url = event.detail?.url;
    if (!url) return;
    openQuickReplyDrawer(url);
  }

  function enableQuickReply() {
    if (window.top !== window.self) return;
    if (window.__znunyHelperQuickReplyBound === "1") return;
    window.__znunyHelperQuickReplyBound = "1";
    window.addEventListener("znuny-helper-open-quick-reply", handleOpenQuickReplyEvent);
  }

  function disableQuickReply() {
    closeQuickReplyDrawer();
    if (window.__znunyHelperQuickReplyBound === "1") {
      window.removeEventListener("znuny-helper-open-quick-reply", handleOpenQuickReplyEvent);
      delete window.__znunyHelperQuickReplyBound;
    }
    removeStyle("zh-quick-reply-style");
  }

  function runEnabledFeatures() {
    suppressMutationScanUntil = Date.now() + 500;
    dispatchPageSettings();

    if (settings.attachmentPreview) enableAttachmentPreview();
    else disableAttachmentPreview();

    if (settings.ticketNumberSearch) fixTicketNumberSearch();
    else restoreTicketNumberSearch();

    if (settings.ticketArticleSearch) enableTicketArticleSearch();
    else disableTicketArticleSearch();

    if (settings.ticketNumberCopy) enableTicketNumberCopy();
    else disableTicketNumberCopy();

    if (settings.ebHelper) enableEbHelper();
    else disableEbHelper();

    if (settings.priorityTemplates) enablePriorityTemplates();
    else disablePriorityTemplates();

    if (settings.quickReply) enableQuickReply();
    else disableQuickReply();

    if (settings.ticketCategories) applyTicketCategories();
    else disableTicketCategories();

    enableSearchResultLinksNewTabs();

    if (settings.ticketListInfiniteScroll) enableTicketListInfiniteScroll();
    else disableTicketListInfiniteScroll();

    enableCloseTabAfterSubmit();
    enableActionPopupCancelFallback();

    if (settings.attachmentReminder) enableAttachmentReminder();
    else disableAttachmentReminder();

    if (settings.pendingDateButtons) enablePendingDateQuickButtons();
    else disablePendingDateQuickButtons();

    enableSubmitShortcut();
    expandArticleWidget();
    enableLogoPongEasterEgg();
  }

  function findAgentAvatarElement() {
    const candidates = [...document.querySelectorAll("div, span, a")].filter((element) => {
      if (element.children.length > 0) return false;

      const text = normalizeText(element.textContent || "");
      if (!/^[A-ZÄÖÜ]{2,3}$/.test(text)) return false;

      const rect = element.getBoundingClientRect();
      if (rect.width < 16 || rect.width > 80) return false;
      if (Math.abs(rect.width - rect.height) > 12) return false;
      if (rect.top > 120 || rect.bottom < 0) return false;

      const style = window.getComputedStyle(element);
      const radius = Number.parseFloat(style.borderRadius) || 0;
      if (radius < rect.width * 0.3) return false;

      return elementIsVisible(element);
    });

    return candidates[0] || null;
  }

  function enableLogoPongEasterEgg() {
    const avatar = findAgentAvatarElement();
    if (!avatar || avatar.dataset.zhPongBound) return;

    avatar.dataset.zhPongBound = "1";
    avatar.style.cursor = "pointer";

    let hoverTimer = null;
    avatar.addEventListener("mouseenter", () => {
      hoverTimer = window.setTimeout(openLogoPongModal, 3000);
    });
    avatar.addEventListener("mouseleave", () => {
      window.clearTimeout(hoverTimer);
    });
  }

  const LOGO_PONG_COLORS = { left: "#2c2569", right: "#3f6fd8", ball: "#1c1b29", line: "#e2dfee" };

  function addLogoPongStyles() {
    addStyle("zh-pong-style", `
      .zh-pong-backdrop { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(20, 20, 30, .55); color-scheme: light; }
      .zh-pong-modal { width: min(640px, calc(100vw - 48px)); background: #fff; color: #1c1b29; border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.4); overflow: hidden; }
      .zh-pong-modal header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 16px 20px; border-bottom: 1px solid #e7e5ef; }
      .zh-pong-modal h2 { margin: 0 0 4px; font-size: 17px; }
      .zh-pong-modal header p { margin: 0; font-size: 12.5px; color: #6b6880; }
      .zh-pong-close { border: none; background: #efedf5; color: #1c1b29; border-radius: 999px; padding: 7px 16px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
      .zh-pong-close:hover { background: #e2dff0; }
      .zh-pong-legend { display: flex; gap: 20px; padding: 10px 20px; font-size: 12.5px; color: #4b4860; }
      .zh-pong-legend strong { color: #1c1b29; }
      .zh-pong-court { margin: 0 20px 20px; border: 1px solid #e7e5ef; border-radius: 12px; overflow: hidden; background: #fff; }
      .zh-pong-court canvas { display: block; width: 100%; height: 360px; touch-action: none; cursor: none; }
    `);
  }

  function drawLogoPongLeftPaddle(ctx, x, centerY, height, color) {
    const top = centerY - height / 2;
    const bottom = centerY + height / 2;
    const cornerY = top + height * 0.42;
    const reach = height * 0.34;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - reach, top);
    ctx.lineTo(x, cornerY);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  }

  function drawLogoPongRightPaddle(ctx, x, centerY, height, color) {
    const top = centerY - height / 2;
    const bottom = centerY + height / 2;
    const cornerY = top + height * 0.42;
    const reach = height * 0.34;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + reach, top);
    ctx.lineTo(x, cornerY);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.restore();
  }

  function startLogoPongGame(canvas) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const paddleHeight = 70;
    const paddleMargin = 26;
    const ballRadius = 7;

    const state = {
      leftY: height / 2,
      rightY: height / 2,
      targetLeftY: height / 2,
      ballX: width / 2,
      ballY: height / 2,
      ballVX: 4.2,
      ballVY: 2.4,
      leftScore: 0,
      rightScore: 0,
      running: true,
      frame: 0
    };

    function resetBall(direction) {
      state.ballX = width / 2;
      state.ballY = height / 2;
      state.ballVX = 4.2 * direction;
      state.ballVY = Math.random() * 4 - 2;
    }

    function onPointerMove(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleY = height / rect.height;
      state.targetLeftY = (event.clientY - rect.top) * scaleY;
    }

    canvas.addEventListener("pointermove", onPointerMove);

    function draw() {
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = LOGO_PONG_COLORS.line;
      ctx.setLineDash([6, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = "center";
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.fillStyle = LOGO_PONG_COLORS.left;
      ctx.fillText(String(state.leftScore), width / 2 - 60, 40);
      ctx.fillStyle = LOGO_PONG_COLORS.right;
      ctx.fillText(String(state.rightScore), width / 2 + 60, 40);

      drawLogoPongLeftPaddle(ctx, paddleMargin, state.leftY, paddleHeight, LOGO_PONG_COLORS.left);
      drawLogoPongRightPaddle(ctx, width - paddleMargin, state.rightY, paddleHeight, LOGO_PONG_COLORS.right);

      ctx.fillStyle = LOGO_PONG_COLORS.ball;
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    function step() {
      if (!state.running) return;

      state.leftY += (state.targetLeftY - state.leftY) * 0.25;
      state.leftY = Math.min(height - paddleHeight / 2, Math.max(paddleHeight / 2, state.leftY));

      state.rightY += (state.ballY - state.rightY) * 0.08;
      state.rightY = Math.min(height - paddleHeight / 2, Math.max(paddleHeight / 2, state.rightY));

      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballY < ballRadius || state.ballY > height - ballRadius) {
        state.ballVY *= -1;
        state.ballY = Math.min(height - ballRadius, Math.max(ballRadius, state.ballY));
      }

      const leftPaddleX = paddleMargin;
      const rightPaddleX = width - paddleMargin;

      if (
        state.ballVX < 0 &&
        state.ballX - ballRadius <= leftPaddleX + 6 &&
        state.ballX - ballRadius >= leftPaddleX - 12 &&
        Math.abs(state.ballY - state.leftY) <= paddleHeight / 2 + ballRadius
      ) {
        state.ballVX = Math.abs(state.ballVX) * 1.03;
        state.ballVY += (state.ballY - state.leftY) * 0.05;
      }

      if (
        state.ballVX > 0 &&
        state.ballX + ballRadius >= rightPaddleX - 6 &&
        state.ballX + ballRadius <= rightPaddleX + 12 &&
        Math.abs(state.ballY - state.rightY) <= paddleHeight / 2 + ballRadius
      ) {
        state.ballVX = -Math.abs(state.ballVX) * 1.03;
        state.ballVY += (state.ballY - state.rightY) * 0.05;
      }

      if (state.ballX < 0) {
        state.rightScore += 1;
        resetBall(1);
      } else if (state.ballX > width) {
        state.leftScore += 1;
        resetBall(-1);
      }

      draw();
      state.frame = window.requestAnimationFrame(step);
    }

    draw();
    state.frame = window.requestAnimationFrame(step);

    return {
      stop() {
        state.running = false;
        if (state.frame) window.cancelAnimationFrame(state.frame);
        canvas.removeEventListener("pointermove", onPointerMove);
      }
    };
  }

  function openLogoPongModal() {
    if (document.querySelector(".zh-pong-backdrop")) return;

    addLogoPongStyles();

    const backdrop = document.createElement("div");
    backdrop.className = "zh-pong-backdrop";

    const modal = document.createElement("div");
    modal.className = "zh-pong-modal";

    const header = document.createElement("header");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Logo Pong";
    heading.appendChild(title);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "zh-pong-close";
    closeButton.textContent = "Schließen";

    header.appendChild(heading);
    header.appendChild(closeButton);

    const legend = document.createElement("div");
    legend.className = "zh-pong-legend";

    const leftLegend = document.createElement("span");
    const leftLabel = document.createElement("strong");
    leftLabel.textContent = "Links:";
    leftLegend.appendChild(leftLabel);
    leftLegend.appendChild(document.createTextNode(" HSRW Indigo"));

    const rightLegend = document.createElement("span");
    const rightLabel = document.createElement("strong");
    rightLabel.textContent = "Rechts:";
    rightLegend.appendChild(rightLabel);
    rightLegend.appendChild(document.createTextNode(" Campus Blau"));

    legend.appendChild(leftLegend);
    legend.appendChild(rightLegend);

    const court = document.createElement("div");
    court.className = "zh-pong-court";
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 360;
    court.appendChild(canvas);

    modal.appendChild(header);
    modal.appendChild(legend);
    modal.appendChild(court);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const game = startLogoPongGame(canvas);

    function close() {
      game.stop();
      backdrop.remove();
      document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(event) {
      if (event.key === "Escape") close();
    }

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", onKeydown);
  }

  async function init() {
    const storedSettings = await syncGet("local", { [SETTINGS_KEY]: DEFAULT_SETTINGS });
    settings = { ...DEFAULT_SETTINGS, ...(storedSettings[SETTINGS_KEY] || {}) };
    consumeAutoCloseFlag();

    const storedTicketState = await syncGet("local", { [TICKET_STATE_KEY]: ticketState });
    ticketState = {
      categories: {},
      notes: {},
      ...(storedTicketState[TICKET_STATE_KEY] || {})
    };

    const storedCategoryConfig = await syncGet("local", {
      [CATEGORY_CONFIG_KEY]: { groups: DEFAULT_GROUPS, keywords: DEFAULT_KEYWORDS }
    });
    categoryConfig = normalizeCategoryConfig(storedCategoryConfig[CATEGORY_CONFIG_KEY]);

    const storedPriorityTemplateConfig = await syncGet("local", {
      [PRIORITY_TEMPLATE_CONFIG_KEY]: {
        templates: DEFAULT_PRIORITY_TEMPLATES
      }
    });
    priorityTemplateConfig = normalizePriorityTemplateConfig(storedPriorityTemplateConfig[PRIORITY_TEMPLATE_CONFIG_KEY]);

    const storedTicketSoundConfig = await syncGet("local", { [TICKET_SOUND_CONFIG_KEY]: ticketSoundConfig });
    ticketSoundConfig = normalizeTicketSoundConfig(storedTicketSoundConfig[TICKET_SOUND_CONFIG_KEY]);

    dispatchPageSettings();

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runEnabledFeatures, { once: true });
    } else {
      runEnabledFeatures();
    }

    const observer = new MutationObserver(handleDocumentMutation);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[SETTINGS_KEY]) {
        settings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
        runEnabledFeatures();
      }

      if (changes[TICKET_SOUND_CONFIG_KEY]) {
        ticketSoundConfig = normalizeTicketSoundConfig(changes[TICKET_SOUND_CONFIG_KEY].newValue);
      }
    });

    window.setTimeout(checkForAssignedTickets, 5000);
    window.setInterval(checkForAssignedTickets, TICKET_SOUND_CHECK_INTERVAL_MS);
  }

  init().catch((error) => console.warn("Znuny Helper failed to initialize:", error));
})();
