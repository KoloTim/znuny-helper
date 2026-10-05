/* Regressionstest fuer den Infinite-Scroll-Bug (Znuny Helper).
 *
 * Der Test extrahiert die echten Funktionen aus
 *   znuny-helper-extension/src/content.js
 * und prueft sie gegen die Tabellen aus den betroffenen Ticketseiten:
 *   - Artikeluebersicht (dort tauchte die fremde "18" auf)
 *   - Widget "Verknuepft" (dort tauchte der Selbstverweis auf)
 *   - echte Ticketliste / Suchergebnisliste (muessen weiter funktionieren)
 *
 * Ausfuehren: node tools/tests/infinite-scroll-regression.test.js
 * Die Quelldateien werden relativ zu diesem Test aufgeloest (Repo-Root =
 * zwei Ebenen oberhalb), damit der Test aus jedem Arbeitsverzeichnis laeuft.
 * Es wird nichts geschrieben, nur gelesen und geprueft.
 */
"use strict";

const fs = require("fs");
const path = require("path");

/* Repo-Root ermitteln: tools/tests/ -> tools/ -> Repo-Root */
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const CONTENT_PATH = path.join(
  REPO_ROOT,
  "znuny-helper-extension",
  "src",
  "content.js"
);
const source = fs.readFileSync(CONTENT_PATH, "utf8");

/* ---------- Deklarationen aus content.js herausschneiden ---------- */
function extractDeclaration(name) {
  const fnIdx = source.indexOf(`function ${name}(`);
  const constIdx = source.indexOf(`const ${name} =`);

  let start = -1;
  let isConst = false;
  if (fnIdx >= 0 && (constIdx < 0 || fnIdx < constIdx)) {
    start = fnIdx;
  } else if (constIdx >= 0) {
    start = constIdx;
    isConst = true;
  }
  if (start < 0) throw new Error(`Deklaration nicht gefunden: ${name}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let seenBrace = false;
  let i = start;

  for (; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      seenBrace = true;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (seenBrace && depth === 0) {
        i += 1;
        break;
      }
      continue;
    }
    if (isConst && ch === ";" && depth === 0) {
      i += 1;
      break;
    }
  }

  const snippet = source.slice(start, i);
  if (!snippet.includes(name)) throw new Error(`Extraktion fehlgeschlagen: ${name}`);
  return snippet;
}

const NEEDED = [
  "normalizeText",
  "getElementText",
  "isArticleOverviewTable",
  "countTicketRowLinks",
  "NON_LIST_WIDGET_PATTERN",
  "isKnownWidgetTable",
  "tableLooksLikeTicketList",
  "decodeUrlSeparators",
  "getActionFromUrl",
  "QUICK_REPLY_DRAFT_LIMIT",
  "quickReplyDraftKey",
  "normalizeQuickReplyDrafts",
  "getSingleTemplateOptionValue",
  "looksLikeEditorMarkup",
  "TICKET_LIST_ACTION_PATTERN",
  "LIST_PAGER_ACTION_PATTERN",
  "isTicketListPage",
  "urlSupportsPageParam",
  "getStartHitFromUrl",
  "normalizeListUrl",
  "isTrustedNextPageUrl",
  "tableColumnSignature",
  "getTicketRowCellCount"
];

/* ---------- Minimale DOM-Attrappe ---------- */
const documentElement = { tagName: "HTML", className: "" };
const fakeDocument = { documentElement };
const fakeWindow = { location: { href: "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketQueue" } };

const LINK_SELECTOR =
  'a[href*="AgentTicketZoom"], a[href*="TicketID="], a[href*="TicketNumber="]';

const isLinkSelector = (selector) =>
  selector === LINK_SELECTOR ||
  (selector.includes("AgentTicketZoom") && selector.includes("TicketNumber"));

function makeAnchor(href) {
  return { tagName: "A", href, textContent: href, getAttribute: (n) => (n === "href" ? href : null) };
}

function makeRow(cellCount, links = []) {
  return {
    tagName: "TR",
    children: Array.from({ length: cellCount }, () => ({ tagName: "TD" })),
    links,
    textContent: links.map((link) => link.href).join(" "),
    querySelectorAll: (selector) => (isLinkSelector(selector) ? links : []),
    querySelector: (selector) => (isLinkSelector(selector) ? links[0] || null : null)
  };
}

function makeTable({ headers = [], rows = [], widgetHeader = "", widgetClass = "WidgetSimple", sidebar = false }) {
  const tableNode = {
    tagName: "TABLE",
    className: "Overview",
    textContent: `${headers.join(" ")} ${rows.map((row) => row.textContent).join(" ")}`,
    querySelectorAll(selector) {
      if (selector === "th") return headers.map((h) => ({ textContent: h, innerText: h }));
      if (selector === "tbody tr") return rows;
      if (isLinkSelector(selector)) return rows.flatMap((row) => row.links);
      return [];
    },
    querySelector(selector) {
      if (selector === "tbody tr") return rows[0] || null;
      if (selector === "th") return headers[0] ? { textContent: headers[0] } : null;
      return null;
    }
  };

  const emptyQuery = () => null;
  const content = {
    tagName: "DIV",
    className: "Content",
    parentElement: documentElement,
    querySelector: emptyQuery,
    querySelectorAll: () => []
  };

  if (widgetHeader || sidebar) {
    const headerNode = widgetHeader ? { textContent: widgetHeader, innerText: widgetHeader } : null;
    const widget = {
      tagName: "DIV",
      className: sidebar ? "WidgetSimple Sidebar" : widgetClass,
      parentElement: documentElement,
      querySelector: (selector) => (selector.startsWith(":scope > .Header") ? headerNode : null),
      querySelectorAll: () => []
    };
    content.parentElement = widget;
  }

  tableNode.parentElement = content;
  return tableNode;
}

/* ---------- Echte Funktionen laden ---------- */
const bundle = NEEDED.map(extractDeclaration).join("\n");
const build = new Function(
  "window",
  "document",
  `${bundle}\nreturn { ${NEEDED.filter((n) => !/^[A-Z_]+$/.test(n)).join(", ")} };`
);
const api = build(fakeWindow, fakeDocument);

/* ---------- Testgeruest ---------- */
let passed = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  OK   ${label}`);
  } else {
    failures.push(`${label}: erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`);
    console.log(`  FAIL ${label}: erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`);
  }
}

const zoomLink = (id) => makeAnchor(`index.pl?Action=AgentTicketZoom;TicketID=${id}`);
const listLink = (id) => makeAnchor(`index.pl?Action=AgentTicketZoom;TicketID=${id}`);

console.log("\n1) Tabellenerkennung: Widgets duerfen keine Ticketliste sein");

// Artikeluebersicht wie im Screenshot: NR. | * | -> | SENDER | VIA | BETREFF | ERSTELLT
const articleOverview = makeTable({
  headers: ["NR.", "", "", "SENDER", "VIA", "BETREFF", "ERSTELLT"],
  rows: [5, 4, 3, 2, 1].map((nr) => makeRow(7, [makeAnchor(`index.pl?Action=AgentTicketZoom;TicketID=105218;ArticleID=${nr}`)])),
  widgetHeader: "Artikeluebersicht - 5 Artikel"
});
check("Artikeluebersicht ist Widget-Tabelle", api.isKnownWidgetTable(articleOverview), true);
check("Artikeluebersicht ist keine Ticketliste", api.tableLooksLikeTicketList(articleOverview), false);

// Widget "Verknuepft": CASE | TITEL | STATUS | QUEUE | ERSTELLT | VERKNÜPFT ALS
const linkedOne = makeTable({
  headers: ["CASE", "TITEL", "STATUS", "QUEUE", "ERSTELLT", "VERKNÜPFT ALS"],
  rows: [makeRow(6, [listLink("86132352")])],
  widgetHeader: "Verknüpft: Ticket (1)"
});
check("'Verknuepft' (1 Zeile) ist Widget-Tabelle", api.isKnownWidgetTable(linkedOne), true);
check("'Verknuepft' (1 Zeile) ist keine Ticketliste", api.tableLooksLikeTicketList(linkedOne), false);

// Derselbe Widget-Kasten nach dem Bug: zwei Zeilen, u. a. das Ticket selbst
const linkedTwo = makeTable({
  headers: ["CASE", "TITEL", "STATUS", "QUEUE", "ERSTELLT", "VERKNÜPFT ALS"],
  rows: [makeRow(6, [listLink("86132352")]), makeRow(6, [listLink("86132300")])],
  widgetHeader: "Verknüpft: Ticket (1)"
});
check("'Verknuepft' (2 Zeilen) ist keine Ticketliste", api.tableLooksLikeTicketList(linkedTwo), false);

const sidebarTable = makeTable({
  headers: ["CASE", "TITEL", "STATUS"],
  rows: [makeRow(3, [listLink("1")]), makeRow(3, [listLink("2")])],
  sidebar: true
});
check("Sidebar-Tabelle ist keine Ticketliste", api.tableLooksLikeTicketList(sidebarTable), false);

console.log("\n2) Tabellenerkennung: echte Listen muessen weiter erkannt werden");

const realList = makeTable({
  headers: ["CASE", "ALTER", "SENDER", "BETREFF", "STATUS"],
  rows: [1, 2, 3, 4, 5].map((id) => makeRow(5, [listLink(`10000${id}`)]))
});
check("Ticketliste (Queue/Sperr-Ansicht) wird erkannt", api.tableLooksLikeTicketList(realList), true);

const searchResults = makeTable({
  headers: ["Ticket", "Betreff", "Von", "Status"],
  rows: [1, 2, 3].map((id) => makeRow(4, [listLink(`20000${id}`)]))
});
check("Suchergebnisliste wird erkannt", api.tableLooksLikeTicketList(searchResults), true);

console.log("\n3) Seitenpruefung: nur echte Listenansichten");

function listPage(url) {
  fakeWindow.location.href = url;
  return api.isTicketListPage();
}

check("Ticketseite (Zoom) ist keine Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketZoom;TicketID=105218"), false);
check("Zoom mit kodierten Trennzeichen ist keine Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action%3DAgentTicketZoom%3BTicketID%3D105218"), false);
check("Queue-Ansicht ist Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketQueue;QueueID=1"), true);
check("Gesperrte Tickets sind Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketLockedView"), true);
check("Besitzer-Ansicht ist Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketOwnerView"), true);
check("Suchergebnisseite ist Liste",
  listPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketSearch;Subaction=Search"), true);

console.log("\n4) Nachladen: nur gleiche Aktion mit echtem Seitenparameter");

const queueUrl = "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketQueue;QueueID=1";
check("Queue Seite 1 -> Seite 2 erlaubt",
  api.isTrustedNextPageUrl(queueUrl, `${queueUrl};Page=2`), true);
check("Queue StartHit-Offset erlaubt",
  api.isTrustedNextPageUrl(queueUrl, `${queueUrl};StartHit=36`), true);
check("gleiche Seite wird abgelehnt",
  api.isTrustedNextPageUrl(queueUrl, queueUrl), false);
check("fremde Aktion wird abgelehnt",
  api.isTrustedNextPageUrl(queueUrl, "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketZoom;TicketID=5;Page=2"), false);
check("Aktionsformular wird abgelehnt",
  api.isTrustedNextPageUrl(queueUrl, "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketCompose;TicketID=5"), false);
check("ohne Seitenparameter abgelehnt (Fallback-Scan)",
  api.isTrustedNextPageUrl(queueUrl, "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketQueue;QueueID=1;SortBy=Age", true), false);
check("mit Seitenparameter erlaubt (Fallback-Scan)",
  api.isTrustedNextPageUrl(queueUrl, "https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketQueue;QueueID=1;Page=2", true), true);

console.log("\n5) Strukturvergleich: fremde Tabellen koennen nicht angehaengt werden");

check("Artikeluebersicht != Ticketliste (Signatur)",
  api.tableColumnSignature(articleOverview) === api.tableColumnSignature(realList), false);
check("gleiche Liste, gleiche Signatur",
  api.tableColumnSignature(realList) === api.tableColumnSignature(
    makeTable({ headers: ["CASE", "ALTER", "SENDER", "BETREFF", "STATUS"], rows: [makeRow(5, [listLink("100009")])] })
  ), true);
check("Sortierpfeil aendert Signatur nicht",
  api.tableColumnSignature(realList) === api.tableColumnSignature(
    makeTable({ headers: ["CASE", "Alter \u25b2", "SENDER", "BETREFF", "STATUS"], rows: [makeRow(5, [listLink("100009")])] })
  ), true);
check("Zellenzahl ignoriert Gruppen-Trennzeile",
  api.getTicketRowCellCount(makeTable({
    headers: ["CASE", "ALTER", "SENDER", "BETREFF", "STATUS"],
    rows: [makeRow(1, []), makeRow(5, [listLink("100001")]), makeRow(5, [listLink("100002")])]
  })), 5);

console.log("\n6) Schnellantwort: Aktionsmuster muss in beiden Welten gleich sein");

const BRIDGE_PATH = path.join(
  REPO_ROOT,
  "znuny-helper-extension",
  "src",
  "page-bridge.js"
);
const bridgeSource = fs.readFileSync(BRIDGE_PATH, "utf8");

function extractRegexLiteral(text, marker) {
  const slice = text.slice(text.indexOf(marker));
  const match = slice.match(/\/(?:[^/\\]|\\.)+\/[a-z]*/);
  return match ? match[0] : "";
}

function toRegExp(literal) {
  const end = literal.lastIndexOf("/");
  return new RegExp(literal.slice(1, end), literal.slice(end + 1));
}

const contentPattern = extractRegexLiteral(source, "QUICK_REPLY_ACTION_PATTERN =");
const bridgePattern = extractRegexLiteral(bridgeSource, "function isQuickReplyEligibleUrl");

check("Muster in content.js gefunden", contentPattern.length > 0, true);
check("Muster in page-bridge.js gefunden", bridgePattern.length > 0, true);
check("beide Muster identisch (Sync-Kommentar eingehalten)", contentPattern, bridgePattern);

const quickReply = toRegExp(contentPattern);
const eligible = [
  "index.pl?Action=AgentTicketCompose;TicketID=1",
  "index.pl?Action=AgentTicketForward;TicketID=1",
  "index.pl?Action=AgentTicketOwner;TicketID=1",
  "index.pl?Action=AgentTicketPriority;TicketID=1",
  "index.pl?Action=AgentTicketNote;TicketID=1",
  "index.pl?Action=AgentTicketClose;TicketID=1",
  "index.pl?Action=AgentTicketMerge;TicketID=1",
  "index.pl?Action=AgentLinkObject;TicketID=1"
];
eligible.forEach((url) => check(`Schnellantwort greift: ${url.split("Action=")[1].split(";")[0]}`, quickReply.test(url), true));

check("Ticketseite loest keine Schnellantwort aus", quickReply.test("index.pl?Action=AgentTicketZoom;TicketID=1"), false);
check("Telefon-Ticket loest keine Schnellantwort aus", quickReply.test("index.pl?Action=AgentTicketPhone;TicketID=1"), false);

console.log("\n7) Tab-Schliessen: nur vom Addon geoeffnete Aktions-Tabs");

function extractStringConstant(text, name) {
  const match = text.match(new RegExp(`const ${name} = "([^"]+)";`));
  return match ? match[1] : "";
}

const contentPrefix = extractStringConstant(source, "ACTION_TAB_NAME_PREFIX");
const bridgePrefix = extractStringConstant(bridgeSource, "ACTION_TAB_NAME_PREFIX");
const contentMarker = extractStringConstant(source, "ACTION_TAB_MARKER");
const bridgeMarker = extractStringConstant(bridgeSource, "ACTION_TAB_MARKER");
const contentStorageKey = extractStringConstant(source, "ACTION_TAB_STORAGE_KEY");
const contentClosePattern = extractRegexLiteral(source, "CLOSE_AFTER_SUBMIT_ACTION =");
const bridgeClosePattern = extractRegexLiteral(bridgeSource, "CLOSE_AFTER_SUBMIT_ACTION =");

check("Namensmarkierung in content.js vorhanden", contentPrefix.length > 0, true);
check("Namensmarkierung in page-bridge.js vorhanden", bridgePrefix.length > 0, true);
check("Namensmarkierung in beiden Welten identisch", contentPrefix, bridgePrefix);
check("Fragmentmarkierung in beiden Welten identisch", contentMarker, bridgeMarker);
check("Fragmentmarkierung ist nicht leer", contentMarker.length > 0, true);
check("Speicherschluessel der Markierung vorhanden", contentStorageKey.length > 0, true);
check("Aktionsmuster in beiden Welten identisch", contentClosePattern, bridgeClosePattern);

const closePattern = toRegExp(contentClosePattern);
["Compose", "Forward", "Owner", "Priority", "Note", "Close", "Merge"].forEach((action) => {
  check(`darf sich schliessen: AgentTicket${action}`, closePattern.test(`index.pl?Action=AgentTicket${action};TicketID=1`), true);
});
check("Ticketseite darf sich nicht schliessen", closePattern.test("index.pl?Action=AgentTicketZoom;TicketID=1"), false);
check("Listenansicht darf sich nicht schliessen", closePattern.test("index.pl?Action=AgentTicketQueue;QueueID=1"), false);

// Die echte Funktion aus content.js gegen ein Tab-Objekt mit veraenderlichem Namen und
// einem nachgebildeten sessionStorage.
function makeSessionStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
}

const tabWindow = { name: "" };
const tabStorage = makeSessionStorage();
const isExtensionActionTab = new Function(
  "window",
  "sessionStorage",
  "ACTION_TAB_NAME_PREFIX",
  "ACTION_TAB_STORAGE_KEY",
  `${extractDeclaration("isExtensionActionTab")}\nreturn isExtensionActionTab;`
)(tabWindow, tabStorage, contentPrefix, contentStorageKey);

tabWindow.name = `${contentPrefix}1712345678901`;
check("Tab mit Namensmarkierung darf schliessen", isExtensionActionTab(), true);

tabWindow.name = "OTRSPopup_123456";
check("Znuny-Popup ohne Markierung darf nicht schliessen", isExtensionActionTab(), false);

tabWindow.name = "";
check("normaler Tab ohne Markierung darf nicht schliessen", isExtensionActionTab(), false);

tabWindow.name = "zhActionTabWithoutDash";
check("aehnlicher Name ohne Trenner zaehlt nicht", isExtensionActionTab(), false);

// Znuny setzt auf Popup-Seiten selbst window.name - die Fragmentmarkierung muss
// unabhaengig davon greifen.
tabWindow.name = "OTRSPopup_2026";
tabStorage.setItem(contentStorageKey, "1");
check("Fragmentmarkierung allein genuegt (window.name von Znuny ueberschrieben)", isExtensionActionTab(), true);

tabStorage.removeItem(contentStorageKey);
check("ohne jede Markierung bleibt der Tab offen", isExtensionActionTab(), false);

// Die Herkunftspruefung fuer den Rueckfallweg nutzt dieselbe Aktionserkennung.
const isCloseAfterSubmitPage = new Function(
  "CLOSE_AFTER_SUBMIT_ACTION",
  `${extractDeclaration("isCloseAfterSubmitPage")}\nreturn isCloseAfterSubmitPage;`
)(closePattern);

check("Herkunft: Antwortseite erkannt",
  isCloseAfterSubmitPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketCompose;TicketID=1"), true);
check("Herkunft: Ticketseite nicht als Aktionsseite",
  isCloseAfterSubmitPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketZoom;TicketID=1"), false);
check("Herkunft: Liste nicht als Aktionsseite",
  isCloseAfterSubmitPage("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketLockedView"), false);

console.log("\n8) Schnellantwort-Entwuerfe: Schluessel und Begrenzung");

check("Schluessel aus Aktion und Ticket",
  api.quickReplyDraftKey("https://otrs.staff.hsrw/otrs/index.pl?Action=AgentTicketCompose;TicketID=105218"),
  "AgentTicketCompose|105218");
check("Schluessel auch mit kodierten Trennzeichen",
  api.quickReplyDraftKey("index.pl?Action%3DAgentTicketNote%3BTicketID%3D42"),
  "AgentTicketNote|42");
check("ohne Ticket wird nichts gespeichert",
  api.quickReplyDraftKey("index.pl?Action=AgentTicketCompose"), "");
check("ohne Aktion wird nichts gespeichert",
  api.quickReplyDraftKey("index.pl?TicketID=42"), "");

const draftProbe = {
  "b|2": { text: "   ", savedAt: 20 },
  "a|1": { text: "Antwort", savedAt: 10 },
  "c|3": { text: "Neuer", savedAt: 30 },
  "d|4": { text: null, savedAt: 40 }
};
const limitedDrafts = api.normalizeQuickReplyDrafts(draftProbe, 2);
check("leere Entwuerfe werden verworfen und Limit greift",
  Object.keys(limitedDrafts).sort(), ["a|1", "c|3"]);
check("Entwurfstext bleibt erhalten", limitedDrafts["a|1"].text, "Antwort");
check("Standardlimit verwirft nur Leeres",
  Object.keys(api.normalizeQuickReplyDrafts(draftProbe)).sort(), ["a|1", "c|3"]);
check("Nicht-Objekt ergibt leere Sammlung", api.normalizeQuickReplyDrafts(null), {});

console.log("\n9) Antworten/Weiterleiten: nur bei genau einer Vorlage eingreifen");

check("genau eine Vorlage wird gewaehlt",
  api.getSingleTemplateOptionValue([{ value: "" }, { value: "1" }]), "1");
check("Weiterleitungsvorlage wird erkannt",
  api.getSingleTemplateOptionValue([{ value: "" }, { value: "5" }]), "5");
check("mehrere Vorlagen: nichts wird vorausgewaehlt",
  api.getSingleTemplateOptionValue([{ value: "" }, { value: "1" }, { value: "5" }]), "");
check("nur der leere Platzhalter: nichts wird vorausgewaehlt",
  api.getSingleTemplateOptionValue([{ value: "" }]), "");
check("leere Liste bleibt leer", api.getSingleTemplateOptionValue([]), "");
check("fehlende Werte zaehlen nicht",
  api.getSingleTemplateOptionValue([{ value: "" }, { value: "   " }, { value: "2" }]), "2");

const RUN_ARTICLE_ACTION_EVENT = "znuny-helper-run-article-action";
check("Bruecken-Event in content.js vorhanden", source.includes(RUN_ARTICLE_ACTION_EVENT), true);
check("Bruecken-Event in page-bridge.js vorhanden", bridgeSource.includes(RUN_ARTICLE_ACTION_EVENT), true);

console.log("\n10) Entwuerfe: Editor-Quelltext darf nicht als Text zurueckkommen");

check("Editor-Markup wird erkannt (br)", api.looksLikeEditorMarkup("Hallo<br />Welt"), true);
check("Editor-Markup wird erkannt (Absatz)", api.looksLikeEditorMarkup("<p>Gruesse</p>"), true);
check("Editor-Markup wird erkannt (nbsp)", api.looksLikeEditorMarkup("Hallo&nbsp;Welt"), true);
check("normaler Text bleibt unberuehrt", api.looksLikeEditorMarkup("Mit freundlichen Grüßen"), false);
check("Kleiner-Zeichen allein ist kein Markup", api.looksLikeEditorMarkup("a < b und c > d"), false);
check("Sternchen/Zeilenumbrueche sind kein Markup", api.looksLikeEditorMarkup("Zeile 1\nZeile 2"), false);

const ARM_AUTO_CLOSE_MESSAGE = "znuny-helper-arm-auto-close";
const backgroundSource = fs.readFileSync(
  path.join(REPO_ROOT, "znuny-helper-extension", "src", "background.js"),
  "utf8"
);
check("Auftrag an den Hintergrund in content.js vorhanden", source.includes(ARM_AUTO_CLOSE_MESSAGE), true);
check("Auftrag im Hintergrund verarbeitet", backgroundSource.includes(ARM_AUTO_CLOSE_MESSAGE), true);

console.log("\n11) Popup: Bubble-Oberflaeche und Einstellungsnamen");

const POPUP_DIR = path.join(REPO_ROOT, "znuny-helper-extension", "popup");
const popupHtml = fs.readFileSync(path.join(POPUP_DIR, "popup.html"), "utf8");
const popupCss = fs.readFileSync(path.join(POPUP_DIR, "popup.css"), "utf8");
const popupJs = fs.readFileSync(path.join(POPUP_DIR, "popup.js"), "utf8");

/* Einstellungsnamen aus einem DEFAULT_SETTINGS-Block ziehen. */
function settingBlock(sourceText, fileLabel) {
  const start = sourceText.indexOf("const DEFAULT_SETTINGS = {");
  if (start < 0) throw new Error(`DEFAULT_SETTINGS nicht gefunden in ${fileLabel}`);
  const end = sourceText.indexOf("\n  };", start);
  const block = sourceText.slice(start, end < 0 ? undefined : end);
  if (!block.includes(":")) throw new Error(`Keine Einstellungen gelesen aus ${fileLabel}`);
  return block;
}

function settingKeysFrom(sourceText, fileLabel) {
  const keys = [...settingBlock(sourceText, fileLabel).matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):/gm)]
    .map((match) => match[1]);
  if (!keys.length) throw new Error(`Keine Einstellungen gelesen aus ${fileLabel}`);
  return keys.sort();
}

/* Nur die Schalter (true/false) - sie entsprechen den Kaestchen im Popup. */
function booleanSettingKeysFrom(sourceText, fileLabel) {
  const keys = [...settingBlock(sourceText, fileLabel)
    .matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*):\s*(?:true|false)\s*,?\s*$/gm)]
    .map((match) => match[1]);
  if (!keys.length) throw new Error(`Keine Schalter gelesen aus ${fileLabel}`);
  return keys.sort();
}

const htmlNames = [...popupHtml.matchAll(/name="([A-Za-z][A-Za-z0-9]*)"/g)]
  .map((match) => match[1])
  .filter((name, index, all) => all.indexOf(name) === index)
  .sort();

const popupKeys = settingKeysFrom(popupJs, "popup.js");
const contentKeys = settingKeysFrom(source, "content.js");

check("Popup-Schalter und Popup-Einstellungen stimmen ueberein",
  htmlNames, booleanSettingKeysFrom(popupJs, "popup.js"));
check("Popup und Content-Script kennen dieselben Einstellungen", popupKeys, contentKeys);
check("Werte-Einstellungen haben Felder im Popup",
  popupKeys.filter((key) => !booleanSettingKeysFrom(popupJs, "popup.js").includes(key)).length, 2);
check("Feld fuer die Tage der Schnellknoepfe", popupHtml.includes('id="pendingPresetsInput"'), true);
check("Feld fuer die Standard-Wartezeit", popupHtml.includes('id="pendingDefaultInput"'), true);
check("Bubble-Karten im Stylesheet", popupCss.includes(".bubble {"), true);
check("Warten-Schnellauswahl als Einheit mit Details", popupCss.includes(".toggle-stack") && popupHtml.includes('id="pendingDetails"'), true);
check("Abgeschaltete Details werden gedimmt", popupCss.includes(".bubble-details.is-disabled"), true);
check("Popup-Skript dimmt die Details", popupJs.includes('pendingDetails?.classList.toggle("is-disabled"'), true);
check("Versionsanzeige im Kopf vorhanden", popupHtml.includes('id="versionPill"') && popupJs.includes("api.runtime.getManifest().version"), true);
check("Feste Popup-Breite statt Inhaltsbreite", /body\s*\{[^}]*width:\s*360px/.test(popupCss), true);

/* Beide Varianten muessen dieselbe Oberflaeche haben (Firefox-Spiegel). */
["popup.html", "popup.css", "popup.js"].forEach((file) => {
  const chrome = fs.readFileSync(path.join(POPUP_DIR, file), "utf8");
  const firefox = fs.readFileSync(
    path.join(REPO_ROOT, "znuny-helper-extension-firefox", "popup", file),
    "utf8"
  );
  check(`Firefox-Spiegel identisch: ${file}`, firefox === chrome, true);
});

console.log("\n12) Artikelleiste: oranger Hover-Balken fuer Antworten/Weiterleiten");

const ARTICLE_ACTION_LABEL_PATTERN_SOURCE = source.match(/const ARTICLE_ACTION_LABEL_PATTERN = .*;/)[0];
const articleActionDocument = { querySelector: () => null };
const markLabel = new Function(
  "document",
  `${ARTICLE_ACTION_LABEL_PATTERN_SOURCE}
   ${extractDeclaration("isRenderableArticleActionElement")}
   ${extractDeclaration("markArticleActionLabel")}
   return markArticleActionLabel;`
)(articleActionDocument);

function makeLabelDouble(text, options = {}) {
  const classes = [];
  const { visible = true, insideHiddenContainer = false } = options;

  return {
    textContent: text,
    dataset: {},
    classes,
    classList: { add: (name) => classes.push(name), remove: () => {} },
    matches: (selector) => selector === "label",
    closest: (selector) =>
      (insideHiddenContainer && selector === '[data-zh-direct-action-hidden="1"]' ? {} : null),
    querySelector: () => null,
    getBoundingClientRect: () => (visible ? { width: 90, height: 16 } : { width: 0, height: 0 })
  };
}

function makeActionFormDouble(labels, forLabel) {
  return {
    querySelector: (selector) => (selector.startsWith("label[for=") ? forLabel || null : null),
    querySelectorAll: (selector) => (selector === "label" ? labels : [])
  };
}

const articleActionContainer = { previousElementSibling: null, nextElementSibling: null };
const articleActionSearchInput = {
  id: "ResponseID738340_Search",
  closest: (selector) => (selector === ".InputField_Container" ? articleActionContainer : null)
};

const replyLabel = makeLabelDouble("Antworten");
const markedLabel = markLabel(
  makeActionFormDouble([replyLabel, makeLabelDouble("Teilen")]),
  articleActionSearchInput
);
check("Label mit Aktionsnamen wird bevorzugt", markedLabel === replyLabel, true);
check("Label wird markiert", replyLabel.dataset.zhDirectActionLabel, "1");
check("Markierung setzt die CSS-Klasse", replyLabel.classes.includes("zh-direct-action-label"), true);

const forwardedLabel = makeLabelDouble("Weiterleiten");
check("Weiterleiten wird ebenfalls erkannt",
  markLabel(makeActionFormDouble(["x", forwardedLabel].map((entry) => (typeof entry === "string" ? makeLabelDouble(entry) : entry))), articleActionSearchInput) === forwardedLabel,
  true);

const forLabel = makeLabelDouble("Allen antworten");
check("Label ueber for-Attribut wird gefunden",
  markLabel(makeActionFormDouble([makeLabelDouble("Teilen")], forLabel), articleActionSearchInput) === forLabel,
  true);

check("unsichtbare Labels werden uebersprungen",
  markLabel(makeActionFormDouble([makeLabelDouble("Antworten", { visible: false })]), articleActionSearchInput),
  null);
check("Labels im ausgeblendeten Feld zaehlen nicht",
  markLabel(
    makeActionFormDouble([makeLabelDouble("Antworten", { insideHiddenContainer: true })]),
    articleActionSearchInput
  ),
  null);
check("ohne passendes Label bleibt es unveraendert",
  markLabel(makeActionFormDouble([]), articleActionSearchInput),
  null);

const labelPatternSource = source.match(/const ARTICLE_ACTION_LABEL_PATTERN = (\/.*\/[a-z]*);/)[1];
const labelPattern = new Function(`return ${labelPatternSource};`)();
check("Muster kennt die Aktionsnamen",
  ["Antworten", "Allen antworten", "Weiterleiten"].map((name) => labelPattern.test(name)),
  [true, true, true]);
check("Muster ignoriert andere Aktionen", labelPattern.test("Teilen"), false);

const styleCaptures = [];
const applyArticleActionStyles = new Function(
  "addStyleToDocument",
  `${extractDeclaration("addArticleActionStyles")}\nreturn addArticleActionStyles;`
)((doc, id, css) => styleCaptures.push({ id, css }));
applyArticleActionStyles({});
check("Stil wird unter eigener ID eingefuegt", styleCaptures[0]?.id, "zh-article-action-style");
check("Balken nutzt Znuny-Orange", styleCaptures[0]?.css.includes("#ff9900"), true);
check("Balken erscheint bei Hover und Fokus",
  Boolean(styleCaptures[0]?.css.includes(":hover::after") && styleCaptures[0]?.css.includes(":focus-within::after")),
  true);
check("Balken verschiebt das Layout nicht",
  Boolean(styleCaptures[0]?.css.includes("position: absolute") && styleCaptures[0]?.css.includes("pointer-events: none")),
  true);

const prepareSource = extractDeclaration("prepareArticleActionForm");
check("Vorbereitung setzt Stil und Markierung",
  Boolean(prepareSource.includes("addArticleActionStyles(") && prepareSource.includes("markArticleActionLabel(")),
  true);
check("Abschalten entfernt die Markierung",
  extractDeclaration("disableDirectArticleActions").includes("unmarkArticleActionLabels()"),
  true);

console.log(`\nErgebnis: ${passed} bestanden, ${failures.length} fehlgeschlagen`);
if (failures.length) {
  failures.forEach((failure) => console.log(`  - ${failure}`));
  process.exit(1);
}
console.log("Alle Pruefungen bestanden.");
