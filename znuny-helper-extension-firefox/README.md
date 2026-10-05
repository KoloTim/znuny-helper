# Znuny Helper

WebExtension that consolidates the former Tampermonkey helpers into one addon with
popup-based feature toggles. Both packages — `znuny-helper-extension` for Chrome/Edge
and `znuny-helper-extension-firefox` — are built from the same sources; they differ
only in `manifest.json` (and in this file's Firefox counterpart).

## Included features

- Open Znuny popup actions in new tabs, or in the quick-reply window over the ticket.
- Preview PDF, image, text, EML, DOCX and spreadsheet attachments in an overlay, and
  enlarge images that are already shown inside an article.
- Ticket number search with an automatic time range and quick range buttons.
- Search inside the article overview and inside the article text of an open ticket.
- Copy the case/ticket number from the ticket headline with one click.
- Categorise, highlight and annotate tickets locally in the ticket lists, including
  keyword-based suggestions, plus optional infinite scroll.
- Priority templates and pending-date quick buttons on the action pages.
- Ctrl+Enter submits the current form; the tab closes afterwards.
- Play a sound when a new ticket is locked to you.
- EB Helper prepares Empfangsbestätigungen from hardware tickets.

## Load in Chromium

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Choose "Load unpacked".
4. Select this folder: `znuny-helper-extension`.
5. Reload the Znuny tab afterwards — reloading the extension alone does not update
   content scripts in tabs that are already open.

The extension matches:

```text
https://otrs.staff.hsrw/otrs/index.pl*
```

Change the match pattern in `manifest.json` if the Znuny URL changes.

## Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on…".
3. Select `manifest.json` from the `znuny-helper-extension-firefox` folder.

Firefox supports `content_scripts[].world = "MAIN"`, which the popup and quick-reply
handling relies on — keep that entry when packaging. `README-FIREFOX.md` lists the
manifest differences.

## Diagnostics

With the DevTools console open, every Znuny page logs the running version and whether
the page is treated as a ticket list:

```text
Znuny Helper <Version> aktiv {seite: "…", ticketliste: false}
```

## Documentation and build

The full documentation, the changelog and the build/release scripts live in the parent
repository: `CHANGELOG.md`, `NETWIKI-Znuny-Helper.md` and `tools/`.
