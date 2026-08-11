(function () {
  "use strict";

  const DEFAULT_SETTINGS = {
    popupTabs: true,
    searchResultsPopup: true
  };

  let settings = { ...DEFAULT_SETTINGS };
  const originalOpen = window.open;

  function readDomSettings() {
    const root = document.documentElement;

    if (root.dataset.zhPopupTabs) {
      settings.popupTabs = root.dataset.zhPopupTabs === "1";
    }

    if (root.dataset.zhSearchResultsPopup) {
      settings.searchResultsPopup = root.dataset.zhSearchResultsPopup === "1";
    }
  }

  function isZnunyUrl(url) {
    if (!url) return false;

    const value = String(url);

    return (
      value.includes("index.pl") ||
      value.startsWith("?") ||
      value.startsWith("/otrs/")
    );
  }

  function normalizeZnunyUrl(url) {
    const value = String(url);

    if (value.startsWith("?")) {
      return `${location.origin}${location.pathname}${value}`;
    }

    if (value.startsWith("/otrs/")) {
      return `${location.origin}${value}`;
    }

    return value;
  }

  function isSearchUrl(url) {
    return /Action=Agent(?:Ticket)?Search/i.test(String(url || ""));
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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

    const url = getSearchResultTicketUrl(event.target);
    if (!url) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    originalOpen.call(window, url, "_blank", "noopener");
  }

  function installSearchResultNewTabs() {
    prepareSearchResultLinksForNewTabs();

    if (window.__znunyHelperSearchResultTabs === "1") return;
    window.__znunyHelperSearchResultTabs = "1";
    document.addEventListener("click", handleSearchResultTicketClick, true);
  }

  function isVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function findSearchForm() {
    const forms = Array.from(document.querySelectorAll("#SearchForm"));
    return forms.find(isVisible) || forms[forms.length - 1] || null;
  }

  function findControl(form, selectors) {
    return selectors.map((selector) => form?.querySelector(selector)).find(Boolean) || null;
  }

  function isEmptySearchValue(value, placeholder) {
    const clean = normalizeText(value);
    const hint = normalizeText(placeholder);
    return !clean || clean === "*" || clean.toLowerCase() === hint.toLowerCase() || /^suchbegriff eingeben$/i.test(clean);
  }

  function ensureHidden(form, name, value) {
    let input = form.querySelector('input[type="hidden"][name="' + name + '"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      form.appendChild(input);
    }

    input.value = value;
    return input;
  }

  function prepareSearchFormNewTab(form) {
    if (!form) return;
    readDomSettings();

    if (!settings.searchResultsPopup) {
      form.removeAttribute("target");
      form.removeAttribute("rel");
      return;
    }

    form.target = "_blank";
    form.rel = "noopener noreferrer";
  }

  function prepareTicketNumberOnlySearch(form) {
    const ticket = findControl(form, ['[data-zh-ticketnumber-control="1"]', '[name="TicketNumber"]', '[name="TicketNumberRaw"]']);
    const fulltext = findControl(form, ['[name="Fulltext"]', '[name="FullText"]', '[name="FulltextSearch"]']);
    const ticketValue = normalizeText(ticket?.value);
    if (!ticketValue) return false;
    if (fulltext && !isEmptySearchValue(fulltext.value, fulltext.getAttribute("placeholder"))) return false;

    ticket.value = ticketValue;
    if (fulltext) {
      fulltext.value = "*";
      fulltext.dispatchEvent(new Event("input", { bubbles: true }));
      fulltext.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      ensureHidden(form, "Fulltext", "*");
    }

    const months = Number.parseInt(findControl(form, ['[data-zh-createdmonths-control="1"]'])?.value, 10) || 12;
    ensureHidden(form, "TicketCreateTimeNewerMinutes", String(Math.round(months * 365 / 12) * 24 * 60));
    return true;
  }

  function submitSearchDirectly(form) {
    if (form.dataset.zhDirectSearchSubmitting === "1") return;
    form.dataset.zhDirectSearchSubmitting = "1";
    prepareSearchFormNewTab(form);
    window.setTimeout(() => {
      delete form.dataset.zhDirectSearchSubmitting;
    }, 5000);
    HTMLFormElement.prototype.submit.call(form);
  }

  function isSearchSubmit(target) {
    const control = target?.closest?.('button, a, [role="button"], input[type="submit"], input[type="button"]');
    if (!control) return false;

    const text = normalizeText(control.value || control.innerText || control.textContent).toLowerCase();
    return text.includes("suche starten") || (control.tagName === "INPUT" && String(control.type || "").toLowerCase() === "submit");
  }

  function handleTicketNumberOnlySearch(event) {
    if (event.type !== "submit" && !isSearchSubmit(event.target)) return;

    const form = findSearchForm();
    prepareSearchFormNewTab(form);

    if (!form || !prepareTicketNumberOnlySearch(form)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    submitSearchDirectly(form);
  }

  function handleSearchFormNewTab(event) {
    if (event.type !== "submit" && !isSearchSubmit(event.target)) return;
    readDomSettings();

    const form = findSearchForm();
    if (!form) return;

    prepareSearchFormNewTab(form);
  }

  function installSearchFormNewTab() {
    prepareSearchFormNewTab(findSearchForm());

    if (window.__znunyHelperSearchFormNewTab === "1") return;
    window.__znunyHelperSearchFormNewTab = "1";

    ["pointerdown", "mousedown", "click", "submit"].forEach((eventName) => {
      document.addEventListener(eventName, handleSearchFormNewTab, true);
    });
  }

  function installTicketNumberSearchBypass() {
    if (window.__znunyHelperPageSearchBypass === "1") return;
    window.__znunyHelperPageSearchBypass = "1";

    ["pointerdown", "mousedown", "click", "submit"].forEach((eventName) => {
      document.addEventListener(eventName, handleTicketNumberOnlySearch, true);
    });

    const originalAlert = window.alert.bind(window);
    window.alert = (message) => {
      const text = normalizeText(message).toLowerCase();
      const form = findSearchForm();
      if (text.includes("zumindest einen suchbegriff") && text.includes("nach allem") && form && prepareTicketNumberOnlySearch(form)) {
        window.setTimeout(() => submitSearchDirectly(form), 0);
        return undefined;
      }

      return originalAlert(message);
    };
  }

  window.open = function (url, target, features) {
    readDomSettings();

    if (settings.popupTabs && isZnunyUrl(url)) {
      const normalizedUrl = normalizeZnunyUrl(url);

      if (!settings.searchResultsPopup && isSearchUrl(normalizedUrl)) {
        window.location.href = normalizedUrl;
        return window;
      }

      return originalOpen.call(window, normalizedUrl, "_blank");
    }

    return originalOpen.apply(window, arguments);
  };

  function patchZnunyPopupFunctions() {
    try {
      const popup = window.Core?.UI?.Popup;

      if (!popup?.OpenPopup || popup.OpenPopup.__znunyHelperPatched) {
        return;
      }

      const originalPopup = popup.OpenPopup;

      popup.OpenPopup = function (url) {
        if (settings.popupTabs && url) {
          window.open(url, "_blank");
          return false;
        }

        return originalPopup.apply(this, arguments);
      };

      popup.OpenPopup.__znunyHelperPatched = true;
      popup.OpenPopup.__znunyHelperOriginal = originalPopup;
    } catch (error) {
      console.warn("Znuny Helper popup patch failed:", error);
    }
  }

  function runPageEnhancements() {
    readDomSettings();
    installSearchResultNewTabs();
    installSearchFormNewTab();
    installTicketNumberSearchBypass();
  }

  window.addEventListener("znuny-helper-settings", (event) => {
    readDomSettings();
    settings = { ...settings, ...(event.detail || {}) };
    readDomSettings();
    patchZnunyPopupFunctions();
    runPageEnhancements();
  });

  document.addEventListener("DOMContentLoaded", patchZnunyPopupFunctions);
  document.addEventListener("DOMContentLoaded", runPageEnhancements);

  const patchTimer = window.setInterval(patchZnunyPopupFunctions, 500);
  window.setTimeout(() => window.clearInterval(patchTimer), 10000);

  const enhancementTimer = window.setInterval(runPageEnhancements, 500);
  window.setTimeout(() => window.clearInterval(enhancementTimer), 10000);
})();
