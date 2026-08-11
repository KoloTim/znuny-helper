(function () {
  "use strict";

  const SETTINGS_KEY = "znunyHelperSettings";
  const TICKET_STATE_KEY = "znunyHelperTicketState";
  const SEARCH_HISTORY_KEY = "znunyHelperSearchHistory";
  const CATEGORY_CONFIG_KEY = "znunyHelperCategoryConfig";
  const PRIORITY_TEMPLATE_CONFIG_KEY = "znunyHelperPriorityTemplateConfig";
  const EB_BASE_URL = "https://digi-eb.staff.hsrw/new";
  const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;
  const SPREADSHEET_PREVIEW_MAX_ROWS = 1000;
  const SPREADSHEET_PREVIEW_MAX_COLS = 80;

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

  const DEFAULT_GROUPS = [
    { id: "", title: "Ohne Kategorie", short: "Keine", color: "", order: 1 },
    { id: "dringend", title: "Dringend", short: "Dringend", color: "#ffd6d6", order: 2 },
    { id: "warten", title: "Warten", short: "Warten", color: "#fff3b0", order: 3 },
    { id: "studis", title: "Studis / Externe", short: "Studis", color: "#d8ffd8", order: 4 },
    { id: "hardware", title: "Hardware / Abholung", short: "Hardware", color: "#d9ecff", order: 5 },
    { id: "software", title: "Software / Zugang", short: "Software", color: "#e5f0ff", order: 6 },
    { id: "langzeit", title: "Langzeit", short: "Langzeit", color: "#ead8ff", order: 7 },
    { id: "erledigt", title: "Erledigt", short: "Erledigt", color: "#d9d9d9", order: 8 }
  ];

  const DEFAULT_KEYWORDS = {
    warten: [
      "warten auf kunden", "warten auf kunde", "warten auf user", "warte auf",
      "rueckmeldung", "r\u00fcckmeldung", "antwort", "feedback", "nachfrage", "termin",
      "terminvereinbarung", "abstimmung", "pending", "on hold"
    ],
    dringend: [
      "dringend", "urgent", "sofort", "kritisch", "critical", "notfall",
      "ausfall", "stoerung", "st\u00f6rung", "funktioniert nicht", "geht nicht",
      "kein zugriff", "deadline", "pruefung", "pr\u00fcfung", "heute", "asap", "blockiert",
      "defekt"
    ],
    studis: [
      "student", "studi", "studierende", "studium", "studien", "bewerbung",
      "einschreibung", "matrikel", "semester", "praktikum", "thesis",
      "abschlussarbeit", "campus", "eduroam", "moodle", "pruefungs", "pr\u00fcfungs",
      "studentische"
    ],
    hardware: [
      "notebook", "laptop", "pc", "rechner", "computer", "drucker", "printer",
      "monitor", "bildschirm", "dock", "docking", "tastatur", "maus", "yubikey",
      "ubikey", "abholung", "abholen", "rueckgabe", "r\u00fcckgabe", "uebergabe", "\u00fcbergabe", "geraet", "ger\u00e4t",
      "hardware", "thinclient", "thin client", "headset", "kamera", "webcam",
      "scanner", "beschaffung", "bestellung", "lieferung"
    ],
    software: [
      "vpn", "cisco", "sophos", "windows", "office", "outlook", "teams",
      "webex", "lizenz", "license", "software", "passwort", "kennwort",
      "account", "zugang", "login", "installation", "installieren", "update",
      "endpoint", "client", "programm", "app", "mail", "e-mail", "email",
      "browser", "zertifikat", "sharepoint", "onedrive", "sap", "his", "qis",
      "ldap", "mfa", "2fa", "authenticator"
    ],
    langzeit: ["langzeit", "projekt", "sub case", "subcase", "dienstleister", "lieferant", "warten auf lieferung"],
    erledigt: ["erledigt", "geloest", "gel\u00f6st", "closed", "close", "schliessen", "schlie\u00dfen", "abgeschlossen", "fertig"]
  };

  const api = typeof browser !== "undefined" ? browser : chrome;
  const usesPromiseStorage = typeof browser !== "undefined";
  let settings = { ...DEFAULT_SETTINGS };
  let ticketState = { categories: {}, notes: {} };
  let categoryConfig = null;
  let priorityTemplateConfig = { templates: DEFAULT_PRIORITY_TEMPLATES };
  let openNoteTicketId = null;
  let scanQueued = false;
  let searchModalFixQueued = false;
  let suppressMutationScanUntil = 0;
  let infiniteScrollState = {
    enabledUrl: "",
    nextUrl: "",
    loading: false,
    done: false,
    bound: false
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
      categoryConfig = normalizeCategoryConfig({
        groups: DEFAULT_GROUPS,
        keywords: DEFAULT_KEYWORDS
      });
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

  function normalizePriorityTemplateConfig(config) {
    const sourceTemplates = Array.isArray(config?.templates) && config.templates.length
      ? config.templates
      : DEFAULT_PRIORITY_TEMPLATES;

    return {
      templates: sourceTemplates.map((template, index) => {
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
          fields
        };
      })
    };
  }

  function savePriorityTemplateConfig() {
    priorityTemplateConfig = normalizePriorityTemplateConfig(priorityTemplateConfig);
    syncSet("local", { [PRIORITY_TEMPLATE_CONFIG_KEY]: priorityTemplateConfig });
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
      api.storage[area]
        .set(value)
        .catch((error) => console.warn("Znuny Helper storage write failed:", error));
      return;
    }

    api.storage[area].set(value);
  }

  function dispatchPageSettings() {
    document.documentElement.dataset.zhPopupTabs = settings.popupTabs ? "1" : "0";
    document.documentElement.dataset.zhSearchResultsPopup = settings.searchResultsPopup ? "1" : "0";

    window.dispatchEvent(new CustomEvent("znuny-helper-settings", {
      detail: {
        popupTabs: settings.popupTabs,
        searchResultsPopup: settings.searchResultsPopup
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

  function isPriorityTicketPage() {
    return /Action=AgentTicketPriority/i.test(window.location.href);
  }

  function isOwnerTicketPage() {
    return /Action=AgentTicketOwner/i.test(window.location.href);
  }

  function isComposeTicketPage() {
    return /Action=AgentTicketCompose/i.test(window.location.href);
  }

  function isPriorityTemplatePage() {
    return isPriorityTicketPage() || isOwnerTicketPage();
  }

  function getFormControlValue(form, name) {
    return form?.querySelector?.(`[name="${name}"]`)?.value || "";
  }

  function isSubmittedZnunyActionForm(form) {
    if (!form || form.dataset.zhCloseAfterSubmitBound === "1") return false;

    const action = getFormControlValue(form, "Action");
    const subaction = getFormControlValue(form, "Subaction");
    const hasSubmitControl = Boolean(form.querySelector('button, input[type="submit"], input[type="button"]'));

    return /^AgentTicket/i.test(action) &&
      hasSubmitControl &&
      (!subaction || /store|send|submit/i.test(subaction));
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

  function enableCloseActionTabAfterSubmit() {
    if (window.top !== window.self || !settings.popupTabs) return;

    document.querySelectorAll("form").forEach((form) => {
      if (!isSubmittedZnunyActionForm(form)) return;

      form.dataset.zhCloseAfterSubmitBound = "1";
      form.addEventListener("click", (event) => {
        const control = event.target?.closest?.('button, input[type="submit"], input[type="button"]');
        if (!control || !form.contains(control)) return;

        if (isTransmitSubmitControl(control)) {
          form.dataset.zhCloseAfterSubmitIntent = "1";
        } else {
          delete form.dataset.zhCloseAfterSubmitIntent;
        }
      }, true);

      form.addEventListener("submit", (event) => {
        const shouldClose =
          isTransmitSubmitControl(event.submitter) ||
          form.dataset.zhCloseAfterSubmitIntent === "1";

        delete form.dataset.zhCloseAfterSubmitIntent;
        if (shouldClose && !event.defaultPrevented) requestCloseSubmittedTab();
      });
    });
  }

  function enableCloseComposeTabAfterMailSubmit() {
    if (window.top !== window.self || !settings.popupTabs || !isComposeTicketPage()) return;
    if (document.documentElement.dataset.zhComposeMailCloseBound === "1") return;

    document.documentElement.dataset.zhComposeMailCloseBound = "1";
    document.addEventListener("click", (event) => {
      const control = event.target?.closest?.('button, a, [role="button"], input[type="submit"], input[type="button"]');
      if (!control) return;

      const text = normalizeText(control.value || control.textContent || control.title || control.getAttribute?.("aria-label") || "");
      if (/entwurf|speichern/i.test(text)) return;
      if (!/e-?\s*mail\s+bermitteln/i.test(text) && !/bermitteln/i.test(text)) return;

      const form = control.closest?.("form");
      const action = getFormControlValue(form, "Action") || new URLSearchParams(window.location.search).get("Action") || "";
      if (action && !/^AgentTicketCompose/i.test(action)) return;

      window.setTimeout(() => requestCloseSubmittedTab(3000), 0);
    }, true);
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

  function renderDirectAttachmentPreview(content, href, fileName) {
    const type = guessAttachmentType(fileName || href, "");

    content.textContent = "";

    if (type === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.src = href;
      content.appendChild(iframe);
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
    const doc = document.implementation.createHTMLDocument("");
    doc.body.innerHTML = String(html || "");
    return normalizeText(doc.body.innerText || doc.body.textContent || "");
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

    const workbook = sheetApi.read(await blob.arrayBuffer(), {
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
      const blobUrl = URL.createObjectURL(blob);
      const type = guessAttachmentType(fileName, blob.type);

      content.textContent = "";

      if (type === "pdf" && blob.type.includes("html") && renderDirectAttachmentPreview(content, loadedHref || previewHref, fileName)) {
        return;
      }

      if (type === "pdf") {
        const iframe = document.createElement("iframe");
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
    `);

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

  function fillDefaultTicketTimeRange(form) {
    const containers = findDefaultTicketTimeFilterContainers(form);
    if (!containers.length) return false;

    const end = new Date();
    const start = getSameDateLastYear(end);
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

    const style = window.getComputedStyle(control);
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

  function findPriorityLabelCandidates(labels) {
    const wanted = labels.map((label) => cleanFieldLabel(label));
    return [...document.querySelectorAll("label, dt, th, td, div, span")]
      .filter((element) => {
        if (element.closest("#zh-priority-template-toolbar, .zh-priority-modal")) return false;
        const text = cleanFieldLabel(getElementText(element));
        return wanted.some((label) => text === label || text.endsWith(label));
      });
  }

  function getVisiblePriorityControls() {
    return [...document.querySelectorAll("input, select, textarea")]
      .filter((control) => !control.closest("#zh-priority-template-toolbar, .zh-priority-modal"))
      .filter(isVisibleFormControl);
  }

  function findPriorityControlNearLabel(labels) {
    const candidates = findPriorityLabelCandidates(labels);
    const controls = getVisiblePriorityControls();

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

  function findPriorityFieldRow(labels) {
    const candidates = findPriorityLabelCandidates(labels);

    for (const candidate of candidates) {
      let element = candidate;
      let fallback = null;
      while (element && element !== document.body) {
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

  function findPriorityFieldSection(labels) {
    const row = findPriorityFieldRow(labels);
    if (!row) return null;

    const section = row.closest("fieldset, .WidgetSimple, .Field, .Row, tr, li");
    return section || row;
  }

  function findPriorityControl(labels, ids = []) {
    for (const id of ids) {
      const direct = [
        document.getElementById(id),
        document.querySelector(`[name="${id}"]`),
        ...document.querySelectorAll(`[id^="${id}_"], [id$="_${id}"], [name^="${id}_"], [name$="_${id}"]`)
      ].find((control) => control && isVisibleFormControl(control));
      if (direct) return direct;
    }

    const nearLabel = findPriorityControlNearLabel(labels);
    if (nearLabel) return nearLabel;

    const row = findPriorityFieldRow(labels);
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
      control.focus();
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

  function setPriorityPlainField(labels, ids, value) {
    if (!value) return false;

    const control = findPriorityControl(labels, ids);
    if (!control) return false;

    return setControlValue(control, value, { blur: true });
  }

  function closePriorityAutocompleteDropdowns() {
    document.activeElement?.blur?.();

    document.querySelectorAll(".ui-autocomplete, .select2-drop, .select2-dropdown, .autocomplete-suggestions, .AutoCompleteResult")
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
    const field = select.closest(".Field") || select.parentElement;
    const searchInput = document.getElementById(`${select.id}_Search`) ||
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
      selection = document.createElement("div");
      selection.className = "InputField_Selection";
      selection.style.left = "5px";
      selection.style.display = "block";

      const text = document.createElement("div");
      text.className = "Text";
      selection.appendChild(text);

      inputContainer.appendChild(selection);
    }

    const textElement = selection?.querySelector(".Text");
    if (textElement) textElement.textContent = label;

    selection?.querySelector(".Remove")?.remove();
    if (selection) selection.style.display = "block";
  }

  function setPrioritySelectField(selectId, value) {
    const select = document.getElementById(selectId);
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

  function setPriorityRichText(value) {
    if (!value) return false;

    const row = findPriorityFieldSection(["Text"]);
    const textarea = [...(row?.querySelectorAll("textarea") || [])]
      .find((control) => {
        const signature = `${control.name || ""} ${control.id || ""}`.toLowerCase();
        return /richtext|body|article|text/.test(signature);
      });
    if (textarea) {
      setControlValue(textarea, value);
    }

    const html = escapeHtml(value).replace(/\n/g, "<br>");
    const editable =
      row?.querySelector?.("[contenteditable='true']") ||
      document.querySelector(".cke_editable[contenteditable='true'], [contenteditable='true']");

    if (editable) {
      editable.innerHTML = html;
      editable.dispatchEvent(new Event("input", { bubbles: true }));
      editable.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    const iframe = row?.querySelector?.("iframe") || document.querySelector(".cke_wysiwyg_frame, iframe");
    try {
      const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
      if (iframeDoc?.body) {
        iframeDoc.body.innerHTML = html;
        iframeDoc.body.dispatchEvent(new Event("input", { bubbles: true }));
        iframeDoc.body.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    } catch (error) {
      // Ignore cross-document editor access errors.
    }

    return Boolean(textarea);
  }

  function applyPriorityTemplate(template) {
    const fields = template.fields || {};

    setPrioritySelectField("TypeID", fields.type);
    const applyDependentFields = () => {
      setPrioritySelectField("NewQueueID", fields.queue);
      setPrioritySelectField("ServiceID", fields.service);
      setPrioritySelectField("NewOwnerID", fields.owner);
      setPrioritySelectField("DynamicField_Kategorie", fields.category);
      closePriorityAutocompleteDropdowns();
    };

    applyDependentFields();
    window.setTimeout(applyDependentFields, 180);
    window.setTimeout(applyDependentFields, 600);

    setPriorityPlainField(["Betreff"], ["Subject"], fields.subject);
    window.setTimeout(() => setPriorityRichText(fields.body), 50);
    window.setTimeout(closePriorityAutocompleteDropdowns, 80);
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
    notice.innerHTML = `<strong>EXTERN:</strong> ${escapeHtml(warningText)}`;
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

  function addPriorityTemplateStyles() {
    addStyle("zh-priority-template-style", `
      #zh-priority-template-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 12px 26px; padding: 8px 10px; border: 1px solid #d5d5d5; background: #f7f7f7; }
      #zh-priority-template-toolbar.zh-priority-template-side { float: right; width: 330px; max-width: calc(100% - 590px); margin: 12px 28px 10px 18px; align-items: flex-start; }
      #zh-priority-template-toolbar strong { margin-right: 4px; color: #333; }
      #zh-priority-template-toolbar.zh-priority-template-side strong { width: 100%; margin: 0 0 2px; }
      .zh-priority-template-button, .zh-priority-template-config { border: 1px solid rgba(0,0,0,.18); border-radius: 4px; padding: 5px 10px; cursor: pointer; font-weight: 700; line-height: 1.3; }
      .zh-priority-template-button { color: #fff; }
      .zh-priority-template-config { background: #fff; color: #333; }
      #zh-priority-external-customer-warning { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 7px 9px; border: 1px solid #d98200; border-left: 4px solid #ff9900; background: #fff4cf; color: #4b3400; font-size: 12px; line-height: 1.35; }
      #zh-priority-external-customer-warning strong { color: #8a3b00; margin: 0; width: auto; }
      #zh-priority-external-customer-bottom-warning { display: inline-block; margin: 0 0 0 12px; padding: 5px 9px; border: 1px solid #c30000; border-left: 5px solid #d40000; background: #ffe0e0; color: #8a0000; font-size: 12px; font-weight: 700; line-height: 1.3; vertical-align: middle; }
      .zh-priority-modal-backdrop { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
      .zh-priority-modal { width: min(1180px, calc(100vw - 48px)); max-height: calc(100vh - 48px); overflow: auto; background: #fff; border: 1px solid #aaa; box-shadow: 0 12px 40px rgba(0,0,0,.35); }
      .zh-priority-modal header, .zh-priority-modal footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; background: #f1f1f1; border-bottom: 1px solid #d6d6d6; }
      .zh-priority-modal footer { border-top: 1px solid #d6d6d6; border-bottom: 0; }
      .zh-priority-modal h2 { margin: 0; font-size: 16px; }
      .zh-priority-modal-body { padding: 12px; }
      .zh-priority-template-list { display: grid; gap: 10px; }
      .zh-priority-template-row { display: grid; gap: 10px; padding: 10px; border: 1px solid #d8d8d8; background: #fafafa; }
      .zh-priority-template-row-head { display: grid; grid-template-columns: minmax(190px, 1fr) 92px auto; gap: 10px; align-items: end; }
      .zh-priority-template-fields { display: grid; grid-template-columns: repeat(3, minmax(150px, 1fr)); gap: 10px; }
      .zh-priority-template-field { display: grid; gap: 3px; }
      .zh-priority-template-field label { color: #555; font-size: 11px; font-weight: 700; }
      .zh-priority-template-row input, .zh-priority-template-row textarea { width: 100%; box-sizing: border-box; font-size: 12px; padding: 4px 5px; border: 1px solid #aaa; background: #fff; }
      .zh-priority-template-row input[type="color"] { height: 28px; padding: 2px; }
      .zh-priority-template-row textarea { min-height: 54px; resize: vertical; font-family: inherit; }
      .zh-priority-template-remove { align-self: end; white-space: nowrap; }
      .zh-priority-modal button { cursor: pointer; }
      @media (max-width: 980px) {
        #zh-priority-template-toolbar.zh-priority-template-side { float: none; width: auto; max-width: none; margin: 10px 12px; }
        .zh-priority-template-row-head, .zh-priority-template-fields { grid-template-columns: 1fr; }
      }
    `);
  }

  function createPriorityTemplateField(name, label, value, multiline = false) {
    const wrapper = document.createElement("div");
    wrapper.className = "zh-priority-template-field";

    const labelElement = document.createElement("label");
    labelElement.textContent = label;
    wrapper.appendChild(labelElement);

    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    input.value = value || "";
    wrapper.appendChild(input);

    return wrapper;
  }

  function createPriorityTemplateEditorRow(template) {
    const row = document.createElement("div");
    row.className = "zh-priority-template-row";

    const head = document.createElement("div");
    head.className = "zh-priority-template-row-head";

    head.appendChild(createPriorityTemplateField("title", "Buttonname", template.title || ""));

    const colorField = createPriorityTemplateField("color", "Farbe", template.color || "#3976bb");
    const colorInput = colorField.querySelector("input");
    colorInput.type = "color";
    colorInput.value = template.color || "#3976bb";
    head.appendChild(colorField);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "zh-priority-template-remove";
    removeButton.textContent = "Entfernen";
    removeButton.addEventListener("click", () => row.remove());
    head.appendChild(removeButton);
    row.appendChild(head);

    const fields = document.createElement("div");
    fields.className = "zh-priority-template-fields";
    fields.append(
      createPriorityTemplateField("type", "Typ", template.fields?.type),
      createPriorityTemplateField("queue", "Queue", template.fields?.queue),
      createPriorityTemplateField("service", "Service", template.fields?.service),
      createPriorityTemplateField("owner", "Besitzer", template.fields?.owner),
      createPriorityTemplateField("category", "Kategorie", template.fields?.category),
      createPriorityTemplateField("subject", "Betreff", template.fields?.subject)
    );
    row.appendChild(fields);

    row.appendChild(createPriorityTemplateField("body", "Text", template.fields?.body, true));

    return row;
  }

  function readPriorityTemplateEditorRows(list) {
    const rows = [...list.querySelectorAll(".zh-priority-template-row")];

    return rows.map((row, index) => {
      const getValue = (name) => row.querySelector(`[name="${name}"]`)?.value?.trim() || "";
      const title = getValue("title") || `Vorlage ${index + 1}`;

      return {
        id: `priority-template-${index + 1}-${normalizeCategoryId(title) || Date.now()}`,
        title,
        color: getValue("color") || "#3976bb",
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

  function renderPriorityTemplateEditorRows(list) {
    list.innerHTML = "";
    getPriorityTemplates().forEach((template) => list.appendChild(createPriorityTemplateEditorRow(template)));
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
    const list = document.createElement("div");
    list.className = "zh-priority-template-list";
    body.appendChild(list);
    modal.appendChild(body);
    renderPriorityTemplateEditorRows(list);

    const footer = document.createElement("footer");
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = "Vorlage hinzufügen";
    addButton.addEventListener("click", () => {
      list.appendChild(createPriorityTemplateEditorRow({
        title: "Neue Vorlage",
        color: "#3976bb",
        fields: { type: "", queue: "", service: "", owner: "", category: "", subject: "", body: "" }
      }));
    });

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.textContent = "Standard wiederherstellen";
    resetButton.addEventListener("click", () => {
      priorityTemplateConfig = normalizePriorityTemplateConfig({ templates: DEFAULT_PRIORITY_TEMPLATES });
      renderPriorityTemplateEditorRows(list);
    });

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Speichern";
    saveButton.addEventListener("click", () => {
      priorityTemplateConfig = normalizePriorityTemplateConfig({ templates: readPriorityTemplateEditorRows(list) });
      savePriorityTemplateConfig();
      closePriorityTemplateManager();
      enablePriorityTemplates();
    });

    footer.append(addButton, resetButton, saveButton);
    modal.appendChild(footer);

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closePriorityTemplateManager();
    });

    document.body.appendChild(backdrop);
  }

  function getPriorityToolbarTarget() {
    const settingsWidget = [...document.querySelectorAll(".WidgetSimple")]
      .find((widget) => /ticket-einstellungen/i.test(normalizeText(getElementText(widget.querySelector(".Header") || widget))));
    const settingsContent = settingsWidget?.querySelector(".Content");
    if (settingsContent) {
      return { mode: "prepend-side", element: settingsContent };
    }

    const firstWidget = [...document.querySelectorAll(".WidgetSimple, fieldset")]
      .find((element) => /ticket-einstellungen|artikel hinzuf/i.test(normalizeText(getElementText(element))));
    if (firstWidget?.parentElement) {
      return { mode: "before", element: firstWidget };
    }

    return { mode: "prepend", element: document.querySelector("form") || document.body };
  }

  function enablePriorityTemplates() {
    if (window.top !== window.self || !isPriorityTemplatePage()) return;

    addPriorityTemplateStyles();
    document.getElementById("zh-priority-template-toolbar")?.remove();

    const toolbar = document.createElement("div");
    toolbar.id = "zh-priority-template-toolbar";

    const target = getPriorityToolbarTarget();
    if (target.mode === "prepend-side") {
      toolbar.classList.add("zh-priority-template-side");
    }

    const label = document.createElement("strong");
    label.textContent = "Vorlagen:";
    toolbar.appendChild(label);

    getPriorityTemplates().forEach((template) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "zh-priority-template-button";
      button.textContent = template.title;
      button.style.background = template.color || "#3976bb";
      button.title = "Felder mit dieser Vorlage befüllen";
      button.addEventListener("click", () => applyPriorityTemplate(template));
      toolbar.appendChild(button);
    });

    const configButton = document.createElement("button");
    configButton.type = "button";
    configButton.className = "zh-priority-template-config";
    configButton.textContent = "Vorlagen bearbeiten";
    configButton.addEventListener("click", openPriorityTemplateManager);
    toolbar.appendChild(configButton);
    if (isPriorityTicketPage()) schedulePriorityExternalCustomerBottomNotice();

    if (target.mode === "prepend-side") target.element.prepend(toolbar);
    else if (target.mode === "after") target.element.after(toolbar);
    else if (target.mode === "before") target.element.before(toolbar);
    else target.element.prepend(toolbar);
  }

  function disablePriorityTemplates() {
    closePriorityTemplateManager();
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

  function getSearchText(row, indexes) {
    return [
      getCellText(row, indexes.case),
      getCellText(row, indexes.sender),
      getCellText(row, indexes.title),
      getCellText(row, indexes.status),
      getCellText(row, indexes.customer)
    ].join(" ").toLowerCase();
  }

  function getAgeMinutes(row, indexes) {
    return parseAge(getCellText(row, indexes.age));
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

    const currentPage = Number((doc.body?.innerText || "").match(/Seite:\s*(\d+)/i)?.[1] || 0);
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

  function ensureInfiniteScrollStatus() {
    let status = document.getElementById("zh-infinite-scroll-status");
    if (status) return status;

    status = document.createElement("div");
    status.id = "zh-infinite-scroll-status";
    status.textContent = "";

    const table = findTicketTable();
    table?.parentElement?.appendChild(status);
    return status;
  }

  function addInfiniteScrollStyles() {
    addStyle("zh-infinite-scroll-style", `
      #zh-infinite-scroll-status { padding: 10px 12px; color: #555; font-size: 12px; text-align: center; background: #f4f4f4; border-top: 1px solid #ddd; }
      #zh-infinite-scroll-status:empty { display: none; }
    `);
  }

  function setInfiniteScrollStatus(text) {
    document.getElementById("zh-infinite-scroll-status")?.remove();
  }

  async function loadNextTicketListPage() {
    if (infiniteScrollState.loading || infiniteScrollState.done || !infiniteScrollState.nextUrl) return;

    const table = findTicketTable();
    const tbody = table?.querySelector("tbody");
    if (!table || !tbody) return;

    infiniteScrollState.loading = true;
    setInfiniteScrollStatus("");

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
        setInfiniteScrollStatus("");
        return;
      }

      const indexes = getIndexes(table);
      const nextIndexes = getIndexes(nextTable);
      const existingIds = getExistingTicketIds(table, indexes);
      let added = 0;

      [...nextBody.querySelectorAll("tr")].forEach((row) => {
        const ticketId = getTicketId(row, nextIndexes);
        if (ticketId && existingIds.has(ticketId)) return;

        const clone = document.importNode(row, true);
        tbody.appendChild(clone);
        if (ticketId) existingIds.add(ticketId);
        added += 1;
      });

      const loadedUrl = infiniteScrollState.nextUrl;
      const followingUrl = findNextTicketListUrl(nextDoc);
      infiniteScrollState.nextUrl =
        followingUrl && normalizeListUrl(followingUrl) !== normalizeListUrl(loadedUrl) ? followingUrl : "";
      infiniteScrollState.done = !infiniteScrollState.nextUrl;

      if (settings.ticketCategories && isCategoryTicketListPage()) {
        applyTicketCategories();
      }

      setInfiniteScrollStatus("");
    } catch (error) {
      console.warn("Znuny Helper infinite scroll failed:", error);
      setInfiniteScrollStatus("");
    } finally {
      infiniteScrollState.loading = false;
      window.setTimeout(maybeLoadNextTicketListPage, 80);
    }
  }

  function maybeLoadNextTicketListPage() {
    if (!settings.ticketListInfiniteScroll) return;
    if (infiniteScrollState.loading || infiniteScrollState.done) return;
    if (!infiniteScrollState.nextUrl) return;

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
    const nextUrl = findNextTicketListUrl();

    addInfiniteScrollStyles();

    if (infiniteScrollState.enabledUrl !== currentUrl) {
      infiniteScrollState = {
        enabledUrl: currentUrl,
        nextUrl,
        loading: false,
        done: !nextUrl,
        bound: infiniteScrollState.bound
      };
    } else if (!infiniteScrollState.nextUrl && nextUrl) {
      infiniteScrollState.nextUrl = nextUrl;
      infiniteScrollState.done = false;
    }

    setInfiniteScrollStatus("");

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
  }

  function autoDetectCategory(row, indexes) {
    const text = getSearchText(row, indexes);
    const age = getAgeMinutes(row, indexes);

    if (age >= 100 * 1440) return "langzeit";

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
      .zh-category-modal { width: min(980px, 92vw); max-height: 86vh; overflow: auto; background: #fff; border: 1px solid #777; border-radius: 4px; box-shadow: 0 8px 30px rgba(0,0,0,.35); color: #111; }
      .zh-category-modal header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #ddd; background: #f1f1f1; }
      .zh-category-modal h2 { margin: 0; font-size: 15px; }
      .zh-category-modal-body { padding: 12px; }
      .zh-category-editor-row { display: grid; grid-template-columns: 30px 1fr 90px 70px 1.5fr 130px; gap: 6px; align-items: start; margin-bottom: 7px; }
      .zh-category-editor-row input, .zh-category-editor-row textarea { width: 100%; box-sizing: border-box; font-size: 12px; }
      .zh-category-editor-row textarea { min-height: 48px; resize: vertical; }
      .zh-category-editor-head { font-weight: 700; font-size: 11px; color: #333; }
      .zh-category-editor-actions { display: flex; gap: 4px; flex-wrap: wrap; }
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
    autoOption.textContent = "Auto";
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

  function createCategoryEditorRow(group, keywords) {
    const row = document.createElement("div");
    row.className = "zh-category-editor-row";
    row.dataset.categoryId = group.id;

    const order = document.createElement("div");
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

    const actions = document.createElement("div");
    actions.className = "zh-category-editor-actions";

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "Hoch";
    up.dataset.action = "up";
    up.disabled = group.id === "";

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "Runter";
    down.dataset.action = "down";
    down.disabled = group.id === "";

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

    const header = document.createElement("div");
    header.className = "zh-category-editor-row zh-category-editor-head";
    ["#", "Titel", "Kurz", "Farbe", "Keywords für Auto", "Aktion"].forEach((text) => {
      const cell = document.createElement("div");
      cell.textContent = text;
      header.appendChild(cell);
    });
    list.appendChild(header);

    const groups = getCategoryGroups();
    const keywords = getCategoryKeywords();
    groups.forEach((group) => list.appendChild(createCategoryEditorRow(group, keywords)));
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
      current.keywords[nextId] = [];
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

    leftActions.append(addButton, resetButton);
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

      caseCell.style.background = group.color || "";
      caseCell.style.fontWeight = "";

      const badge = caseCell.querySelector(".zh-badge");
      const select = caseCell.querySelector(".zh-category-select");
      const noteButton = caseCell.querySelector(".zh-note-btn");

      if (badge) {
        const marker = manualCategory === null ? " A" : "";
        badge.textContent = group.id ? `${group.short}${marker}` : `Keine${marker}`;
        badge.style.background = group.color || "#eee";
        badge.title = manualCategory === null ? "Automatisch erkannt" : "Manuell gesetzt";
      }

      if (select) {
        select.value = manualCategory === null ? "__auto" : manualCategory;
        select.title = manualCategory === null ? "Auto-Erkennung aktiv" : "Manuell gesetzt";
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
          cell.style.fontWeight = cell.dataset.zhOriginalFontWeight || "";
        });

        tbody.appendChild(row);
      });
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

    if (settings.ebHelper) enableEbHelper();
    else disableEbHelper();

    if (settings.priorityTemplates) enablePriorityTemplates();
    else disablePriorityTemplates();

    if (settings.ticketCategories) applyTicketCategories();
    else disableTicketCategories();

    enableSearchResultLinksNewTabs();

    if (settings.ticketListInfiniteScroll) enableTicketListInfiniteScroll();
    else disableTicketListInfiniteScroll();

    enableCloseActionTabAfterSubmit();
    enableCloseComposeTabAfterMailSubmit();
  }

  async function init() {
    const storedSettings = await syncGet("local", { [SETTINGS_KEY]: DEFAULT_SETTINGS });
    settings = { ...DEFAULT_SETTINGS, ...(storedSettings[SETTINGS_KEY] || {}) };

    const storedTicketState = await syncGet("local", { [TICKET_STATE_KEY]: ticketState });
    ticketState = {
      categories: {},
      notes: {},
      ...(storedTicketState[TICKET_STATE_KEY] || {})
    };

    const storedCategoryConfig = await syncGet("local", {
      [CATEGORY_CONFIG_KEY]: {
        groups: DEFAULT_GROUPS,
        keywords: DEFAULT_KEYWORDS
      }
    });
    categoryConfig = normalizeCategoryConfig(storedCategoryConfig[CATEGORY_CONFIG_KEY]);

    const storedPriorityTemplateConfig = await syncGet("local", {
      [PRIORITY_TEMPLATE_CONFIG_KEY]: {
        templates: DEFAULT_PRIORITY_TEMPLATES
      }
    });
    priorityTemplateConfig = normalizePriorityTemplateConfig(storedPriorityTemplateConfig[PRIORITY_TEMPLATE_CONFIG_KEY]);

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
      if (areaName !== "local" || !changes[SETTINGS_KEY]) return;

      settings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
      runEnabledFeatures();
    });
  }

  init().catch((error) => console.warn("Znuny Helper failed to initialize:", error));
})();
